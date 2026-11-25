/**
 *  * Carregador de GLB
 *
 * Suporta:
 * - Geometria
 * - Normais
 * - Coordenadas UV
 * - Materiais
 * - Imagens incorporadas
 * - Esqueletos
 * - Pesos dos ossos
 * - Animações
 */

const COMPONENTES = {
    5120: 1, // BYTE
    5121: 1, // UNSIGNED_BYTE
    5122: 2, // SHORT
    5123: 2, // UNSIGNED_SHORT
    5125: 4, // UNSIGNED_INT
    5126: 4  // FLOAT
};

const TAMANHOS = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16
};

function lerComponente(view, offset, tipo) {
    switch (tipo) {
        case 5120:
            return view.getInt8(offset);

        case 5121:
            return view.getUint8(offset);

        case 5122:
            return view.getInt16(offset, true);

        case 5123:
            return view.getUint16(offset, true);

        case 5125:
            return view.getUint32(offset, true);

        case 5126:
            return view.getFloat32(offset, true);

        default:
            throw new Error(
                `Componente GLB inválido: ${tipo}`
            );
    }
}

function normalizar(valor, tipo) {
    switch (tipo) {
        case 5120:
            return Math.max(valor / 127, -1);

        case 5121:
            return valor / 255;

        case 5122:
            return Math.max(valor / 32767, -1);

        case 5123:
            return valor / 65535;

        case 5125:
            return valor / 4294967295;

        default:
            return valor;
    }
}

export async function carregarGLB(caminho) {
    const resposta = await fetch(caminho);

    if (!resposta.ok) {
        throw new Error(
            `Falha ao carregar ${caminho}: HTTP ${resposta.status}`
        );
    }

    const arquivo = await resposta.arrayBuffer();

    if (arquivo.byteLength < 20) {
        throw new Error('Arquivo GLB incompleto.');
    }

    const view = new DataView(arquivo);

    const magic = view.getUint32(0, true);
    const versao = view.getUint32(4, true);
    const tamanho = view.getUint32(8, true);

    if (
        magic !== 0x46546C67 ||
        versao !== 2 ||
        tamanho !== arquivo.byteLength
    ) {
        throw new Error('Formato GLB 2.0 inválido.');
    }

    let json = null;
    let binario = null;
    let offset = 12;

    // Lê os chunks JSON e BIN do GLB.
    while (offset + 8 <= tamanho) {
        const tamanhoChunk = view.getUint32(
            offset,
            true
        );

        const tipoChunk = view.getUint32(
            offset + 4,
            true
        );

        offset += 8;

        if (offset + tamanhoChunk > tamanho) {
            throw new Error(
                'Chunk GLB fora dos limites.'
            );
        }

        const conteudo = arquivo.slice(
            offset,
            offset + tamanhoChunk
        );

        // JSON
        if (tipoChunk === 0x4E4F534A) {
            json = JSON.parse(
                new TextDecoder()
                    .decode(conteudo)
                    .trim()
            );
        }

        // BIN
        if (tipoChunk === 0x004E4942) {
            binario = conteudo;
        }

        offset += tamanhoChunk;
    }

    if (
        !json ||
        !binario ||
        json.asset?.version !== '2.0'
    ) {
        throw new Error(
            'GLB sem dados válidos.'
        );
    }

    const dados = new DataView(binario);

    // Lê os dados numéricos de um accessor glTF.
    function lerAcessor(indice) {
        if (indice == null) {
            return null;
        }

        const acessor = json.accessors?.[indice];

        if (!acessor) {
            throw new Error(
                `Accessor ${indice} inexistente.`
            );
        }

        if (
            acessor.sparse ||
            acessor.bufferView == null
        ) {
            throw new Error(
                'Accessor sparse/sem bufferView não suportado.'
            );
        }

        const bloco =
            json.bufferViews[acessor.bufferView];

        if (!bloco || bloco.buffer !== 0) {
            throw new Error(
                'Somente buffer interno do GLB é suportado.'
            );
        }

        const quantidade = TAMANHOS[acessor.type];
        const bytes = COMPONENTES[acessor.componentType];

        if (!quantidade || !bytes) {
            throw new Error(
                'Formato de accessor inválido.'
            );
        }

        const tamanhoElemento =
            quantidade * bytes;

        const passo =
            bloco.byteStride ?? tamanhoElemento;

        const inicio =
            (bloco.byteOffset ?? 0) +
            (acessor.byteOffset ?? 0);

        if (
            acessor.count < 0 ||
            inicio < 0 ||
            (
                acessor.count > 0 &&
                inicio +
                    (acessor.count - 1) * passo +
                    tamanhoElemento > dados.byteLength
            )
        ) {
            throw new Error(
                'Accessor fora do buffer.'
            );
        }

        const resultado = new Float32Array(
            acessor.count * quantidade
        );

        for (
            let i = 0;
            i < acessor.count;
            i++
        ) {
            for (
                let j = 0;
                j < quantidade;
                j++
            ) {
                let valor = lerComponente(
                    dados,
                    inicio + i * passo + j * bytes,
                    acessor.componentType
                );

                if (acessor.normalized) {
                    valor = normalizar(
                        valor,
                        acessor.componentType
                    );
                }

                resultado[
                    i * quantidade + j
                ] = valor;
            }
        }

        return resultado;
    }

    // Malhas e seus atributos.
    const malhas = (json.meshes ?? []).map(
        malha => ({
            nome: malha.name ?? 'Sem nome',

            primitivas: malha.primitives.map(
                primitiva => ({
                    modo: primitiva.mode ?? 4,

                    material:
                        primitiva.material ?? null,

                    posicoes: lerAcessor(
                        primitiva.attributes.POSITION
                    ),

                    normais: lerAcessor(
                        primitiva.attributes.NORMAL
                    ),

                    uv: lerAcessor(
                        primitiva.attributes.TEXCOORD_0
                    ),

                    ossos: lerAcessor(
                        primitiva.attributes.JOINTS_0
                    ),

                    pesos: lerAcessor(
                        primitiva.attributes.WEIGHTS_0
                    ),

                    indices: lerAcessor(
                        primitiva.indices
                    )
                })
            )
        })
    );

    return {
        json,
        binario,
        malhas,
        nos: json.nodes ?? [],
        esqueletos: json.skins ?? [],
        animacoes: json.animations ?? [],
        lerAcessor
    };
}
