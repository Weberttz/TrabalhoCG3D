export const leitorOBJ = {
    async carregarArquivo(caminho) {
        const resposta = await fetch(caminho);

        if (!resposta.ok) {
            throw new Error(`Erro ao carregar OBJ: ${caminho}`);
        }

        const texto = await resposta.text();
        const obj = this.parseOBJ(texto);

        obj.caminho = caminho;

        return obj;
    },

    parseOBJ(texto) {
        const objPosicoes = [];
        const objCoordTextura = [];
        const objNormais = [];

        const materialLibs = [];
        const geometrias = [];

        let geometria;
        let materialAtual = null;

        function iniciarGeometria() {
            geometria = {
                material: materialAtual,
                posicoes: [],
                texturas: [],
                normais: []
            };

            geometrias.push(geometria);
        }

        function adicionarVertice(referencia) {
            const indices = referencia.split("/");

            const indicePosicao = parseInt(indices[0], 10);
            const indiceTextura = indices[1]
                ? parseInt(indices[1], 10)
                : null;
            const indiceNormal = indices[2]
                ? parseInt(indices[2], 10)
                : null;

            function resolverIndice(indice, lista) {
                return indice > 0
                    ? indice - 1
                    : lista.length + indice;
            }

            const posicao = objPosicoes[
                resolverIndice(indicePosicao, objPosicoes)
            ];

            if (!posicao) {
                throw new Error(`Índice de posição inválido: ${indicePosicao}`);
            }

            geometria.posicoes.push(...posicao);

            if (indiceTextura !== null) {
                const textura = objCoordTextura[
                    resolverIndice(indiceTextura, objCoordTextura)
                ];

                geometria.texturas.push(...textura);
            } else {
                geometria.texturas.push(0, 0);
            }

            if (indiceNormal !== null) {
                const normal = objNormais[
                    resolverIndice(indiceNormal, objNormais)
                ];

                geometria.normais.push(...normal);
            } else {
                geometria.normais.push(0, 0, 0);
            }
        }

        const keywords = {
            v(partes) {
                objPosicoes.push(partes.map(Number));
            },

            vt(partes) {
                objCoordTextura.push(partes.map(Number));
            },

            vn(partes) {
                objNormais.push(partes.map(Number));
            },

            mtllib(partes) {
                materialLibs.push(...partes);
            },

            usemtl(partes) {
                materialAtual = partes.join(" ");
                iniciarGeometria();
            },

            o() {},

            g() {},

            f(partes) {
                if (!geometria) {
                    iniciarGeometria();
                }

                // Triangulação em leque.
                for (let i = 1; i < partes.length - 1; i++) {
                    adicionarVertice(partes[0]);
                    adicionarVertice(partes[i]);
                    adicionarVertice(partes[i + 1]);
                }
            }
        };

        const linhas = texto.split("\n");

        for (const linhaOriginal of linhas) {
            const linha = linhaOriginal.trim();

            if (!linha || linha.startsWith("#")) continue;

            const partes = linha.split(/\s+/);
            const keyword = partes[0];
            const argumentos = partes.slice(1);

            const handler = keywords[keyword];

            if (handler) {
                handler(argumentos);
            }
        }

        const geometriasValidas = geometrias.filter(
            geometria => geometria.posicoes.length > 0
        );

        return {
            materialLibs,
            geometrias: geometriasValidas
        };
    }
};