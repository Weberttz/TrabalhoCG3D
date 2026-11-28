export const leitorMTL = {

    parseMapArgs(argumentos) {
        const partes = argumentos.trim().split(/\s+/);

        const escala = [1, 1];
        const deslocamento = [0, 0];

        let bumpMultiplier = 1;
        let possuiTransformacao = false;

        let indice = 0;

        function lerNumeros(maximo) {
            const valores = [];

            while (
                indice < partes.length &&
                valores.length < maximo
            ) {
                const valor = Number(partes[indice]);

                if (!Number.isFinite(valor)) {
                    break;
                }

                valores.push(valor);
                indice++;
            }

            return valores;
        }

        while (indice < partes.length) {
            const opcao = partes[indice];

            // Deslocamento UV
            if (opcao === '-o') {
                indice++;

                const valores = lerNumeros(3);

                if (valores.length === 0) {
                    throw new Error(
                        `Deslocamento UV inválido: ${argumentos}`
                    );
                }

                deslocamento[0] = valores[0];
                deslocamento[1] = valores[1] ?? 0;

                possuiTransformacao = true;
                continue;
            }

            // Escala UV
            if (opcao === '-s') {
                indice++;

                const valores = lerNumeros(3);

                if (valores.length === 0) {
                    throw new Error(
                        `Escala UV inválida: ${argumentos}`
                    );
                }

                escala[0] = valores[0];
                escala[1] = valores[1] ?? 1;

                possuiTransformacao = true;
                continue;
            }

            // Intensidade do bump mapping
            if (opcao === '-bm') {
                indice++;

                const valores = lerNumeros(1);

                if (valores.length !== 1) {
                    throw new Error(
                        `Intensidade de bump inválida: ${argumentos}`
                    );
                }

                bumpMultiplier = valores[0];
                continue;
            }

            // Nenhuma outra opção reconhecida:
            // o restante é interpretado como arquivo.
            break;
        }

        const arquivo = partes.slice(indice).join(' ');

        if (!arquivo) {
            throw new Error(
                `Arquivo de textura não informado: ${argumentos}`
            );
        }

        return {
            arquivo,

            uvTransform: possuiTransformacao
                ? {
                    escala,
                    deslocamento
                }
                : null,

            bumpMultiplier
        };
    },

    // Interpreta o conteúdo de um arquivo MTL.
    parseMTL(texto) {
        const materiais = {};

        let material = null;

        const keywords = {

            // Criação de um novo material.
            newmtl(partes, argumentos) {
                const nome = argumentos.trim();

                if (!nome) {
                    throw new Error(
                        'Material MTL sem nome.'
                    );
                }

                material = {
                    nome,

                    // Cores
                    diffuse: [1, 1, 1],
                    ambient: [0, 0, 0],
                    specular: [1, 1, 1],
                    emissive: [0, 0, 0],

                    // Mapas de textura
                    diffuseMap: null,
                    specularMap: null,
                    emissiveMap: null,
                    normalMap: null,

                    // Transformações de textura
                    uvTransform: null,

                    emissiveUVTransform: null,
                    specularUVTransform: null,
                    normalUVTransform: null,

                    // Configurações de bump
                    bumpMultiplier: 1,

                    // Propriedades do material
                    shininess: 400,
                    opacity: 1,
                    opticalDensity: 1,
                    illum: 2
                };

                materiais[nome] = material;
            },

            // Brilho do material.
            Ns(partes) {
                material.shininess = Number(partes[0]);
            },

            // Cor ambiente.
            Ka(partes) {
                material.ambient = partes
                    .slice(0, 3)
                    .map(Number);
            },

            // Cor difusa.
            Kd(partes) {
                material.diffuse = partes
                    .slice(0, 3)
                    .map(Number);
            },

            // Cor especular.
            Ks(partes) {
                material.specular = partes
                    .slice(0, 3)
                    .map(Number);
            },

            // Cor emissiva.
            Ke(partes) {
                material.emissive = partes
                    .slice(0, 3)
                    .map(Number);
            },

            // Textura difusa.
            map_Kd(partes, argumentos) {
                const resultado =
                    leitorMTL.parseMapArgs(argumentos);

                material.diffuseMap = resultado.arquivo;

                material.uvTransform =
                    resultado.uvTransform;
            },

            // Textura especular.
            map_Ns(partes, argumentos) {
                const resultado =
                    leitorMTL.parseMapArgs(argumentos);

                material.specularMap = resultado.arquivo;

                material.specularUVTransform =
                    resultado.uvTransform;
            },

            // Textura emissiva.
            map_Ke(partes, argumentos) {
                const resultado =
                    leitorMTL.parseMapArgs(argumentos);

                material.emissiveMap = resultado.arquivo;

                material.emissiveUVTransform =
                    resultado.uvTransform;
            },

            // Mapa de bump.
            map_Bump(partes, argumentos) {
                const resultado =
                    leitorMTL.parseMapArgs(argumentos);

                material.normalMap = resultado.arquivo;

                material.normalUVTransform =
                    resultado.uvTransform;

                material.bumpMultiplier =
                    resultado.bumpMultiplier;
            },

            // Variante da declaração de bump.
            bump(partes, argumentos) {
                const resultado =
                    leitorMTL.parseMapArgs(argumentos);

                material.normalMap = resultado.arquivo;

                material.normalUVTransform =
                    resultado.uvTransform;

                material.bumpMultiplier =
                    resultado.bumpMultiplier;
            },

            // Índice de refração.
            Ni(partes) {
                material.opticalDensity =
                    Number(partes[0]);
            },

            // Opacidade.
            d(partes) {
                material.opacity = Number(partes[0]);
            },

            // Transparência inversa.
            Tr(partes) {
                material.opacity =
                    1 - Number(partes[0]);
            },

            // Modelo de iluminação.
            illum(partes) {
                material.illum =
                    Number.parseInt(partes[0], 10);
            }
        };

        const linhas = texto.split(/\r?\n/);

        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i].trim();

            if (
                !linha ||
                linha.startsWith('#')
            ) {
                continue;
            }

            const partes = linha.split(/\s+/);

            const comando = partes[0];

            const argumentos = partes
                .slice(1)
                .join(' ');

            const handler = keywords[comando];

            // Ignora comandos não reconhecidos.
            if (!handler) {
                continue;
            }

            // Permite criar material, mas exige um
            // material existente para demais comandos.
            if (
                comando !== 'newmtl' &&
                !material
            ) {
                console.warn(
                    `[MTL] Comando ${comando} sem material, linha ${i + 1}`
                );

                continue;
            }

            try {
                handler(partes.slice(1), argumentos);

            } catch (erro) {
                console.error(
                    `[MTL] Erro na linha ${i + 1}:`,
                    linha,
                    erro
                );

                throw erro;
            }
        }

        return materiais;
    },

    // Carrega os arquivos MTL associados a um OBJ.
    async carregarMateriais(obj) {
        const baseHref = new URL(
            obj.caminho,
            window.location.href
        );

        const arquivosMTL = await Promise.all(
            obj.materialLibs.map(async nomeArquivo => {

                const caminhoMTL = new URL(
                    `../modelosMTL/${nomeArquivo}`,
                    baseHref
                );

                try {
                    const resposta = await fetch(caminhoMTL);

                    if (!resposta.ok) {
                        console.warn(
                            `[MTL] Arquivo não encontrado: ${nomeArquivo}`
                        );

                        return null;
                    }

                    return {
                        texto: await resposta.text(),
                        caminho: caminhoMTL
                    };

                } catch (erro) {
                    console.error(
                        `[MTL] Erro ao carregar ${nomeArquivo}:`,
                        erro
                    );

                    return null;
                }
            })
        );

        const arquivosValidos =
            arquivosMTL.filter(Boolean);

        const materiais = {};

        // Interpreta cada biblioteca separadamente.
        for (const arquivo of arquivosValidos) {
            const materiaisArquivo =
                this.parseMTL(arquivo.texto);

            Object.assign(
                materiais,
                materiaisArquivo
            );
        }

        return {
            materiais,

            caminhosMTL: arquivosValidos.map(
                arquivo => arquivo.caminho
            )
        };
    }
};
