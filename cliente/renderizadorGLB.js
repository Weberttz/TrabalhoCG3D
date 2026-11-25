
const MAX_OSSOS = 48;

const VERTICE = `#version 300 es
precision highp float;

layout(location=0) in vec3 aPosicao;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aOssos;
layout(location=3) in vec4 aPesos;

uniform mat4 uMVP;
uniform mat4 uModelo;
uniform mat4 uOssos[48];

out vec3 vNormal;

void main() {
    mat4 pele =
          aPesos.x * uOssos[int(aOssos.x)]
        + aPesos.y * uOssos[int(aOssos.y)]
        + aPesos.z * uOssos[int(aOssos.z)]
        + aPesos.w * uOssos[int(aOssos.w)];

    gl_Position = uMVP * pele * vec4(aPosicao, 1.0);
    vNormal = mat3(uModelo * pele) * aNormal;
}
`;

const FRAGMENTO = `#version 300 es
precision highp float;

in vec3 vNormal;
uniform vec3 uCor;

out vec4 corFinal;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 luz = normalize(vec3(0.35, 0.9, 0.45));

    float intensidade =
        0.45 + 0.55 * max(dot(normal, luz), 0.0);

    corFinal = vec4(uCor * intensidade, 1.0);
}
`;

function compilar(gl, tipo, fonte) {
    const shader = gl.createShader(tipo);

    gl.shaderSource(shader, fonte);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const erro = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader GLB: ${erro}`);
    }

    return shader;
}

function criarPrograma(gl) {
    const vs = compilar(gl, gl.VERTEX_SHADER, VERTICE);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTO);

    const programa = gl.createProgram();

    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);

    gl.linkProgram(programa);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
        const erro = gl.getProgramInfoLog(programa);
        gl.deleteProgram(programa);
        throw new Error(`Programa GLB: ${erro}`);
    }

    return programa;
}

export function criarDesenhadorGLB(gl, modeloGLB) {
    const skin = modeloGLB.esqueletos?.[0];

    if (!skin?.joints?.length) {
        throw new Error('GLB sem esqueleto válido.');
    }

    if (skin.joints.length > MAX_OSSOS) {
        throw new Error('Quantidade de ossos excedida.');
    }

    const programa = criarPrograma(gl);

    const uMVP = gl.getUniformLocation(programa, 'uMVP');
    const uModelo = gl.getUniformLocation(programa, 'uModelo');
    const uOssos = gl.getUniformLocation(programa, 'uOssos[0]');
    const uCor = gl.getUniformLocation(programa, 'uCor');

    const recursos = [];
    let menorY = Infinity;

    function atributo(local, dados, componentes) {
        const buffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            dados,
            gl.STATIC_DRAW
        );

        gl.enableVertexAttribArray(local);
        gl.vertexAttribPointer(
            local, componentes,
            gl.FLOAT, false, 0, 0
        );

        return buffer;
    }

    for (const malha of modeloGLB.malhas) {
        for (const primitiva of malha.primitivas) {
            if (primitiva.modo !== 4) {
                throw new Error(
                    'O renderizador aceita apenas triângulos.'
                );
            }

            if (!primitiva.posicoes ||
                !primitiva.ossos ||
                !primitiva.pesos) {
                throw new Error(
                    'Malha sem atributos de skinning.'
                );
            }

            const quantidade = primitiva.posicoes.length / 3;

            if (primitiva.ossos.length !== quantidade * 4 ||
                primitiva.pesos.length !== quantidade * 4) {
                throw new Error(
                    'Quantidade de pesos ou ossos inválida.'
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

            buffers.push(
                atributo(0, primitiva.posicoes, 3)
            );

            buffers.push(
                atributo(
                    1,
                    primitiva.normais ??
                        new Float32Array(primitiva.posicoes.length),
                    3
                )
            );

            buffers.push(
                atributo(2, primitiva.ossos, 4)
            );

            buffers.push(
                atributo(3, primitiva.pesos, 4)
            );

            let totalIndices = 0;

            if (primitiva.indices) {
                // O leitorGLB retorna índices como Float32Array.
                const indices = Uint32Array.from(
                    primitiva.indices
                );

                const bufferIndices = gl.createBuffer();

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

            const material =
                modeloGLB.json.materials?.[primitiva.material];

            const cor = (
                material?.pbrMetallicRoughness?.baseColorFactor
                ?? [0.78, 0.8, 0.84, 1]
            ).slice(0, 3);

            recursos.push({
                vao,
                buffers,
                quantidade,
                totalIndices,
                cor
            });
        }
    }

    gl.bindVertexArray(null);

    return {
        deslocamentoSolo: Number.isFinite(menorY)
            ? -menorY
            : 0,

        desenhar(mvp, matrizModelo, matrizesOssos) {
            if (
                !matrizesOssos ||
                matrizesOssos.length !== skin.joints.length * 16
            ) {
                throw new Error(
                    'Matrizes dos ossos inválidas.'
                );
            }

            const programaAnterior =
                gl.getParameter(gl.CURRENT_PROGRAM);

            const vaoAnterior =
                gl.getParameter(gl.VERTEX_ARRAY_BINDING);

            const cullingAnterior =
                gl.isEnabled(gl.CULL_FACE);

            gl.disable(gl.CULL_FACE);
            gl.useProgram(programa);

            gl.uniformMatrix4fv(
                uMVP, false, mvp
            );

            gl.uniformMatrix4fv(
                uModelo, false, matrizModelo
            );

            gl.uniformMatrix4fv(
                uOssos, false, matrizesOssos
            );

            for (const parte of recursos) {
                gl.bindVertexArray(parte.vao);
                gl.uniform3fv(uCor, parte.cor);

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

            gl.bindVertexArray(vaoAnterior);
            gl.useProgram(programaAnterior);

            if (cullingAnterior) {
                gl.enable(gl.CULL_FACE);
            }
        },

        destruir() {
            for (const parte of recursos) {
                for (const buffer of parte.buffers) {
                    gl.deleteBuffer(buffer);
                }

                gl.deleteVertexArray(parte.vao);
            }

            gl.deleteProgram(programa);
        }
    };
}
