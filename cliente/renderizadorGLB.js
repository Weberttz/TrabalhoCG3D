import { GLSL_ILUMINACAO } from './iluminacao.js';

/**
 * Renderizador de personagens GLB.
 *
 * Suporta:
 * - Skinning com até 48 ossos
 * - Textura de cor incorporada ao GLB
 * - Coordenadas UV
 * - Materiais individuais
 * - Iluminação difusa
 * - Vários jogadores com animações independentes
 */

const MAX_OSSOS = 48;

// Vertex Shader

const VERTICE = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosicao;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aOssos;
layout(location = 3) in vec4 aPesos;
layout(location = 4) in vec2 aUV;

uniform mat4 uMVP;
uniform mat4 uModelo;
uniform mat4 uOssos[${MAX_OSSOS}];

out vec3 vNormal;
out vec3 vPosicaoMundo;
out vec2 vUV;

void main() {
    mat4 pele =
          aPesos.x * uOssos[int(aOssos.x)]
        + aPesos.y * uOssos[int(aOssos.y)]
        + aPesos.z * uOssos[int(aOssos.z)]
        + aPesos.w * uOssos[int(aOssos.w)];

    vec4 posicaoAnimada =
        pele * vec4(aPosicao, 1.0);

    gl_Position = uMVP * posicaoAnimada;

    vNormal = mat3(uModelo * pele) * aNormal;
    vPosicaoMundo = (uModelo * posicaoAnimada).xyz;

    vUV = aUV;
}
`;

// Fragment Shader

const FRAGMENTO = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPosicaoMundo;
in vec2 vUV;

uniform vec3 uCor;
uniform bool uUsarTextura;
uniform sampler2D uTextura;

out vec4 corFinal;

${GLSL_ILUMINACAO}

void main() {
    vec3 corBase = uCor;

    if (uUsarTextura) {
        corBase *= texture(
            uTextura,
            vUV
        ).rgb;
    }

    vec3 resultado = aplicarLuzes(vPosicaoMundo, normalize(vNormal), corBase,
        corBase, vec3(0.0), 32.0, vec3(0.25, 0.94, 0.22));
    corFinal = vec4(limitarAltasLuzes(resultado), 1.0);
}
`;

// Shaders e programa

function compilar(gl, tipo, fonte) {
    const shader = gl.createShader(tipo);

    gl.shaderSource(shader, fonte);
    gl.compileShader(shader);

    if (
        !gl.getShaderParameter(
            shader,
            gl.COMPILE_STATUS
        )
    ) {
        const erro = gl.getShaderInfoLog(shader);

        gl.deleteShader(shader);

        throw new Error(
            `Shader GLB: ${erro}`
        );
    }

    return shader;
}

function criarPrograma(gl) {
    const vs = compilar(
        gl,
        gl.VERTEX_SHADER,
        VERTICE
    );

    const fs = compilar(
        gl,
        gl.FRAGMENT_SHADER,
        FRAGMENTO
    );

    const programa = gl.createProgram();

    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);

    gl.linkProgram(programa);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (
        !gl.getProgramParameter(
            programa,
            gl.LINK_STATUS
        )
    ) {
        const erro = gl.getProgramInfoLog(
            programa
        );

        gl.deleteProgram(programa);

        throw new Error(
            `Programa GLB: ${erro}`
        );
    }

    return programa;
}

// Renderizador de glb

export function criarDesenhadorGLB(
    gl,
    modeloGLB,
    iluminacao
) {
    const skin =
        modeloGLB.esqueletos?.[0];

    if (!skin?.joints?.length) {
        throw new Error(
            'O GLB não possui um esqueleto válido.'
        );
    }

    if (skin.joints.length > MAX_OSSOS) {
        throw new Error(
            `O GLB tem ${skin.joints.length} ossos; ` +
            `o shader admite até ${MAX_OSSOS}.`
        );
    }

    const programa = criarPrograma(gl);
    const programaAnterior = gl.getParameter(gl.CURRENT_PROGRAM);
    gl.useProgram(programa);
    iluminacao.configurarPrograma(programa);
    gl.useProgram(programaAnterior);

    const uMVP = gl.getUniformLocation(
        programa,
        'uMVP'
    );

    const uModelo = gl.getUniformLocation(
        programa,
        'uModelo'
    );

    const uOssos = gl.getUniformLocation(
        programa,
        'uOssos[0]'
    );

    const uCor = gl.getUniformLocation(
        programa,
        'uCor'
    );

    const uUsarTextura = gl.getUniformLocation(
        programa,
        'uUsarTextura'
    );

    const uTextura = gl.getUniformLocation(
        programa,
        'uTextura'
    );

    const texturas = new Map();
    const recursos = [];

    let menorY = Infinity;
    let destruido = false;

    // Buffers

    function atributo(
        local,
        dados,
        componentes
    ) {
        const buffer = gl.createBuffer();

        gl.bindBuffer(
            gl.ARRAY_BUFFER,
            buffer
        );

        gl.bufferData(
            gl.ARRAY_BUFFER,
            dados,
            gl.STATIC_DRAW
        );

        gl.enableVertexAttribArray(local);

        gl.vertexAttribPointer(
            local,
            componentes,
            gl.FLOAT,
            false,
            0,
            0
        );

        return buffer;
    }

    // Texturar incorporadas no arquivo glb

    function carregarTextura(indiceTextura) {
        if (indiceTextura == null) {
            return null;
        }

        if (texturas.has(indiceTextura)) {
            return texturas.get(indiceTextura);
        }


        const definicaoTextura =
            modeloGLB.json.textures?.[indiceTextura];

        // Suporta referências padrão e EXT_texture_webp.
        const indiceImagem =
            definicaoTextura?.source ??
            definicaoTextura?.extensions
                ?.EXT_texture_webp?.source;

        const definicaoImagem =
            indiceImagem != null
                ? modeloGLB.json.images?.[indiceImagem]
                : null;

        if (
            !definicaoImagem ||
            definicaoImagem.bufferView == null ||
            !modeloGLB.binario
        ) {
            console.warn(
                'Imagem interna não disponível:',
                indiceTextura
            );

            return null;
        }

        const vista =
            modeloGLB.json.bufferViews[
            definicaoImagem.bufferView
            ];

        if (!vista) {
            return null;
        }

        const textura = gl.createTexture();

        const recurso = {
            textura,
            pronta: false
        };

        texturas.set(
            indiceTextura,
            recurso
        );

        // Guarda o estado da textura atual.
        const unidadeAnterior = gl.getParameter(
            gl.ACTIVE_TEXTURE
        );

        gl.activeTexture(gl.TEXTURE0);

        const texturaAnterior = gl.getParameter(
            gl.TEXTURE_BINDING_2D
        );

        gl.bindTexture(
            gl.TEXTURE_2D,
            textura
        );

        // Pixel temporário branco.
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([
                255, 255, 255, 255
            ])
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_S,
            gl.REPEAT
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_T,
            gl.REPEAT
        );

        // Usa filtro linear antes do mipmap.
        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            gl.LINEAR
        );

        gl.bindTexture(
            gl.TEXTURE_2D,
            texturaAnterior
        );

        gl.activeTexture(unidadeAnterior);

        // Lê os bytes da imagem no buffer BIN.
        const inicio = vista.byteOffset ?? 0;

        const bytes = modeloGLB.binario.slice(
            inicio,
            inicio + vista.byteLength
        );

        const blob = new Blob(
            [bytes],
            {
                type:
                    definicaoImagem.mimeType ??
                    'image/png'
            }
        );

        // Decodifica a imagem incorporada.
        createImageBitmap(blob)
            .then(imagem => {
                if (destruido) {
                    imagem.close();
                    return;
                }

                const unidadeAtiva =
                    gl.getParameter(
                        gl.ACTIVE_TEXTURE
                    );

                gl.activeTexture(gl.TEXTURE0);

                const texturaVinculada =
                    gl.getParameter(
                        gl.TEXTURE_BINDING_2D
                    );

                gl.bindTexture(
                    gl.TEXTURE_2D,
                    textura
                );

                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    imagem
                );

                gl.generateMipmap(
                    gl.TEXTURE_2D
                );

                gl.texParameteri(
                    gl.TEXTURE_2D,
                    gl.TEXTURE_MIN_FILTER,
                    gl.LINEAR_MIPMAP_LINEAR
                );

                gl.bindTexture(
                    gl.TEXTURE_2D,
                    texturaVinculada
                );

                gl.activeTexture(
                    unidadeAtiva
                );

                imagem.close();

                recurso.pronta = true;
            })
            .catch(erro => {
                console.error(
                    'Falha ao carregar textura GLB:',
                    erro
                );
            });

        return recurso;
    }

    // Preparação das malhas

    for (const malha of modeloGLB.malhas) {
        for (const primitiva of malha.primitivas) {
            if (primitiva.modo !== 4) {
                throw new Error(
                    'São aceitos apenas triângulos.'
                );
            }

            if (
                !primitiva.posicoes ||
                !primitiva.ossos ||
                !primitiva.pesos
            ) {
                throw new Error(
                    'Malha GLB sem atributos de skinning.'
                );
            }

            const quantidade =
                primitiva.posicoes.length / 3;

            if (
                primitiva.ossos.length !==
                quantidade * 4 ||
                primitiva.pesos.length !==
                quantidade * 4
            ) {
                throw new Error(
                    'Quantidade inválida de pesos ou ossos.'
                );
            }

            for (
                let i = 1;
                i < primitiva.posicoes.length;
                i += 3
            ) {
                menorY = Math.min(
                    menorY,
                    primitiva.posicoes[i]
                );
            }

            const vao = gl.createVertexArray();

            gl.bindVertexArray(vao);

            const buffers = [];

            // Posições.
            buffers.push(
                atributo(
                    0,
                    primitiva.posicoes,
                    3
                )
            );

            // Normais.
            buffers.push(
                atributo(
                    1,
                    primitiva.normais ??
                    new Float32Array(
                        primitiva.posicoes.length
                    ),
                    3
                )
            );

            // Índices dos ossos.
            buffers.push(
                atributo(
                    2,
                    primitiva.ossos,
                    4
                )
            );

            // Pesos dos ossos.
            buffers.push(
                atributo(
                    3,
                    primitiva.pesos,
                    4
                )
            );

            // Coordenadas UV.
            buffers.push(
                atributo(
                    4,
                    primitiva.uv ??
                    new Float32Array(
                        quantidade * 2
                    ),
                    2
                )
            );

            let totalIndices = 0;

            if (primitiva.indices) {
                const indices = Uint32Array.from(
                    primitiva.indices
                );

                const bufferIndices =
                    gl.createBuffer();

                gl.bindBuffer(
                    gl.ELEMENT_ARRAY_BUFFER,
                    bufferIndices
                );

                gl.bufferData(
                    gl.ELEMENT_ARRAY_BUFFER,
                    indices,
                    gl.STATIC_DRAW
                );

                buffers.push(bufferIndices);

                totalIndices = indices.length;
            }

            // Material associado à primitiva.
            const material =
                modeloGLB.json.materials?.[
                primitiva.material
                ];

            const cor = (
                material?.pbrMetallicRoughness
                    ?.baseColorFactor ??
                [1, 1, 1, 1]
            ).slice(0, 3);

            const indiceTextura =
                material?.pbrMetallicRoughness
                    ?.baseColorTexture?.index;

            const texturaCor = carregarTextura(
                indiceTextura
            );

            recursos.push({
                vao,
                buffers,
                quantidade,
                totalIndices,
                cor,
                texturaCor
            });
        }
    }

    gl.bindVertexArray(null);

    // Interface do renderizador

    return {
        deslocamentoSolo:
            Number.isFinite(menorY)
                ? -menorY
                : 0,

        desenhar(
            mvp,
            matrizModelo,
            matrizesOssos
        ) {
            if (destruido) {
                return;
            }

            const quantidadeEsperada =
                skin.joints.length * 16;

            if (
                !matrizesOssos ||
                matrizesOssos.length !==
                quantidadeEsperada
            ) {
                throw new Error(
                    'Matrizes dos ossos inválidas.'
                );
            }

            // Preserva o estado WebGL do cenário.
            const programaAnterior =
                gl.getParameter(
                    gl.CURRENT_PROGRAM
                );

            const vaoAnterior =
                gl.getParameter(
                    gl.VERTEX_ARRAY_BINDING
                );

            const cullingAnterior =
                gl.isEnabled(
                    gl.CULL_FACE
                );

            const unidadeAnterior =
                gl.getParameter(
                    gl.ACTIVE_TEXTURE
                );

            gl.activeTexture(gl.TEXTURE0);

            const texturaAnterior =
                gl.getParameter(
                    gl.TEXTURE_BINDING_2D
                );

            gl.disable(gl.CULL_FACE);

            gl.useProgram(programa);

            gl.uniform1i(
                uTextura,
                0
            );

            gl.uniformMatrix4fv(
                uMVP,
                false,
                mvp
            );

            gl.uniformMatrix4fv(
                uModelo,
                false,
                matrizModelo
            );

            gl.uniformMatrix4fv(
                uOssos,
                false,
                matrizesOssos
            );

            // Desenha cada parte do personagem.
            for (const parte of recursos) {
                gl.bindVertexArray(
                    parte.vao
                );

                gl.uniform3fv(
                    uCor,
                    parte.cor
                );

                const pronta =
                    parte.texturaCor?.pronta === true;

                gl.uniform1i(
                    uUsarTextura,
                    pronta ? 1 : 0
                );

                gl.bindTexture(
                    gl.TEXTURE_2D,
                    pronta
                        ? parte.texturaCor.textura
                        : null
                );

                if (parte.totalIndices > 0) {
                    gl.drawElements(
                        gl.TRIANGLES,
                        parte.totalIndices,
                        gl.UNSIGNED_INT,
                        0
                    );
                } else {
                    gl.drawArrays(
                        gl.TRIANGLES,
                        0,
                        parte.quantidade
                    );
                }
            }

            // Restaura o estado anterior.
            gl.bindVertexArray(vaoAnterior);

            gl.bindTexture(
                gl.TEXTURE_2D,
                texturaAnterior
            );

            gl.activeTexture(
                unidadeAnterior
            );

            gl.useProgram(
                programaAnterior
            );

            if (cullingAnterior) {
                gl.enable(gl.CULL_FACE);
            }
        },

        destruir() {
            destruido = true;

            for (const parte of recursos) {
                for (const buffer of parte.buffers) {
                    gl.deleteBuffer(buffer);
                }

                gl.deleteVertexArray(
                    parte.vao
                );
            }

            for (const recurso of texturas.values()) {
                gl.deleteTexture(
                    recurso.textura
                );
            }

            gl.deleteProgram(programa);
        }
    };
}
