
/**
 * cliente/animador.js
 *
 * Controla as animações de um modelo GLB com esqueleto.
 * Calcula as matrizes dos ossos para o renderizador WebGL2.
 */

function matrizIdentidade() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

function multiplicarMatrizes(a, b) {
    const resultado = new Float32Array(16);

    for (let coluna = 0; coluna < 4; coluna++) {
        for (let linha = 0; linha < 4; linha++) {
            let soma = 0;

            for (let k = 0; k < 4; k++) {
                soma += a[k * 4 + linha] * b[coluna * 4 + k];
            }

            resultado[coluna * 4 + linha] = soma;
        }
    }

    return resultado;
}

function matrizTRS(translacao, rotacao, escala) {
    const [x, y, z, w] = rotacao;
    const [sx, sy, sz] = escala;

    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    return new Float32Array([
        (1 - 2 * (yy + zz)) * sx,
        2 * (xy + wz) * sx,
        2 * (xz - wy) * sx,
        0,

        2 * (xy - wz) * sy,
        (1 - 2 * (xx + zz)) * sy,
        2 * (yz + wx) * sy,
        0,

        2 * (xz + wy) * sz,
        2 * (yz - wx) * sz,
        (1 - 2 * (xx + yy)) * sz,
        0,

        translacao[0],
        translacao[1],
        translacao[2],
        1
    ]);
}

function inverterMatrizAfim(m) {
    const a = m[0], b = m[4], c = m[8];
    const d = m[1], e = m[5], f = m[9];
    const g = m[2], h = m[6], i = m[10];

    const A = e * i - f * h;
    const B = c * h - b * i;
    const C = b * f - c * e;
    const D = f * g - d * i;
    const E = a * i - c * g;
    const F = c * d - a * f;
    const G = d * h - e * g;
    const H = b * g - a * h;
    const I = a * e - b * d;

    const determinante = a * A + b * D + c * G;

    if (Math.abs(determinante) < 1e-10) {
        throw new Error(
            'A matriz do nó da malha não é invertível.'
        );
    }

    const inv = 1 / determinante;

    const tx = m[12], ty = m[13], tz = m[14];

    const r00 = A * inv, r01 = B * inv, r02 = C * inv;
    const r10 = D * inv, r11 = E * inv, r12 = F * inv;
    const r20 = G * inv, r21 = H * inv, r22 = I * inv;

    return new Float32Array([
        r00, r10, r20, 0,
        r01, r11, r21, 0,
        r02, r12, r22, 0,

        -(r00 * tx + r01 * ty + r02 * tz),
        -(r10 * tx + r11 * ty + r12 * tz),
        -(r20 * tx + r21 * ty + r22 * tz),
        1
    ]);
}

function normalizarQuaternion(q) {
    const comprimento = Math.hypot(
        q[0], q[1], q[2], q[3]
    );

    if (comprimento < 1e-8) {
        return [0, 0, 0, 1];
    }

    return Array.from(
        q,
        valor => valor / comprimento
    );
}

function interpolarQuaternion(a, b, fator) {
    let produto =
        a[0] * b[0] +
        a[1] * b[1] +
        a[2] * b[2] +
        a[3] * b[3];

    const destino = [...b];

    if (produto < 0) {
        produto = -produto;

        for (let j = 0; j < 4; j++) {
            destino[j] = -destino[j];
        }
    }

    if (produto > 0.9995) {
        return normalizarQuaternion(
            a.map(
                (valor, j) =>
                    valor + fator * (destino[j] - valor)
            )
        );
    }

    const angulo = Math.acos(
        Math.max(-1, Math.min(1, produto))
    );

    const seno = Math.sin(angulo);

    const pesoA =
        Math.sin((1 - fator) * angulo) / seno;

    const pesoB =
        Math.sin(fator * angulo) / seno;

    return normalizarQuaternion(
        a.map(
            (valor, j) =>
                valor * pesoA + destino[j] * pesoB
        )
    );
}

function avaliarCanal(canal, tempo) {
    const {
        tempos,
        valores,
        interpolacao,
        tamanho,
        caminho
    } = canal;

    const total = tempos.length;

    if (total === 0) {
        throw new Error('Canal de animação vazio.');
    }

    let indice = 0;

    if (tempo >= tempos[total - 1]) {
        indice = total - 1;

    } else if (tempo > tempos[0]) {
        // Busca binária pelo keyframe anterior.
        let inicio = 0;
        let fim = total - 1;

        while (inicio + 1 < fim) {
            const meio = (inicio + fim) >>> 1;

            if (tempos[meio] <= tempo) {
                inicio = meio;
            } else {
                fim = meio;
            }
        }

        indice = inicio;
    }

    const cubico =
        interpolacao === 'CUBICSPLINE';

    const deslocamento = (
        indice * (cubico ? 3 : 1) +
        (cubico ? 1 : 0)
    ) * tamanho;

    const atual = Array.from(
        valores.subarray(
            deslocamento,
            deslocamento + tamanho
        )
    );

    if (
        indice === total - 1 ||
        tempo <= tempos[0] ||
        interpolacao === 'STEP'
    ) {
        return caminho === 'rotation'
            ? normalizarQuaternion(atual)
            : atual;
    }

    const proximoIndice = indice + 1;

    const duracao =
        tempos[proximoIndice] - tempos[indice];

    if (duracao <= 0) {
        return atual;
    }

    const t =
        (tempo - tempos[indice]) / duracao;

    if (cubico) {
        const proximoDeslocamento =
            (proximoIndice * 3 + 1) * tamanho;

        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const resultado = [];

        for (let j = 0; j < tamanho; j++) {
            const tangenteSaida =
                valores[
                    (indice * 3 + 2) * tamanho + j
                ];

            const tangenteEntrada =
                valores[
                    proximoIndice * 3 * tamanho + j
                ];

            resultado.push(
                h00 * atual[j] +
                h10 * duracao * tangenteSaida +
                h01 * valores[proximoDeslocamento + j] +
                h11 * duracao * tangenteEntrada
            );
        }

        return caminho === 'rotation'
            ? normalizarQuaternion(resultado)
            : resultado;
    }

    const proximoDeslocamento =
        proximoIndice * tamanho;

    const proximo = Array.from(
        valores.subarray(
            proximoDeslocamento,
            proximoDeslocamento + tamanho
        )
    );

    if (caminho === 'rotation') {
        return interpolarQuaternion(
            atual,
            proximo,
            t
        );
    }

    return atual.map(
        (valor, j) =>
            valor + (proximo[j] - valor) * t
    );
}

/**
 * Cria uma instância independente de animação.
 *
 * @param {Object} modelo - Retorno de carregarGLB().
 * @param {number} indiceEsqueleto - Índice do skin no GLB.
 */
export function criarAnimadorGLB(
    modelo,
    indiceEsqueleto = 0
) {
    const nos = modelo.nos;

    const esqueleto =
        modelo.esqueletos[indiceEsqueleto];

    if (
        !esqueleto ||
        !Array.isArray(esqueleto.joints) ||
        !esqueleto.joints.length
    ) {
        throw new Error(
            'O GLB não possui esqueleto com ossos.'
        );
    }

    const indiceNoMalha = nos.findIndex(
        no =>
            no.skin === indiceEsqueleto &&
            no.mesh != null
    );

    if (indiceNoMalha < 0) {
        throw new Error(
            'Não foi encontrado um nó de malha associado ao esqueleto.'
        );
    }

    // Registra o pai de cada nó.
    const pais = new Array(nos.length).fill(-1);

    for (let i = 0; i < nos.length; i++) {
        for (const filho of nos[i].children ?? []) {
            pais[filho] = i;
        }
    }

    // Guarda a pose original do modelo.
    const poseOriginal = nos.map(no => ({
        translation: [
            ...(no.translation ?? [0, 0, 0])
        ],

        rotation: [
            ...(no.rotation ?? [0, 0, 0, 1])
        ],

        scale: [
            ...(no.scale ?? [1, 1, 1])
        ],

        matrix: no.matrix
            ? new Float32Array(no.matrix)
            : null
    }));

    const matrizesInversas =
        esqueleto.inverseBindMatrices != null
            ? modelo.lerAcessor(
                esqueleto.inverseBindMatrices
            )
            : null;

    if (
        matrizesInversas &&
        matrizesInversas.length !==
            esqueleto.joints.length * 16
    ) {
        throw new Error(
            'Quantidade inválida de matrizes inversas.'
        );
    }

    // Prepara os clipes de animação.
    const animacoes = new Map();

    for (
        let i = 0;
        i < modelo.animacoes.length;
        i++
    ) {
        const animacao = modelo.animacoes[i];

        const nome =
            animacao.name || `Animacao_${i}`;

        const canais = [];
        let duracao = 0;

        for (const entrada of animacao.channels) {
            const alvo = entrada.target;

            if (
                ![
                    'translation',
                    'rotation',
                    'scale'
                ].includes(alvo.path)
            ) {
                throw new Error(
                    `Animação de ${alvo.path} não suportada.`
                );
            }

            const sampler =
                animacao.samplers[entrada.sampler];

            const tempos =
                modelo.lerAcessor(sampler.input);

            const valores =
                modelo.lerAcessor(sampler.output);

            const tamanho =
                alvo.path === 'rotation' ? 4 : 3;

            const interpolacao =
                sampler.interpolation ?? 'LINEAR';

            const multiplicador =
                interpolacao === 'CUBICSPLINE'
                    ? 3
                    : 1;

            if (
                valores.length !==
                tempos.length *
                tamanho *
                multiplicador
            ) {
                throw new Error(
                    `Keyframes inválidos no canal ${alvo.path}.`
                );
            }

            if (
                ![
                    'LINEAR',
                    'STEP',
                    'CUBICSPLINE'
                ].includes(interpolacao)
            ) {
                throw new Error(
                    `Interpolação não suportada: ${interpolacao}`
                );
            }

            if (tempos.length) {
                duracao = Math.max(
                    duracao,
                    tempos[tempos.length - 1]
                );
            }

            canais.push({
                no: alvo.node,
                caminho: alvo.path,
                tempos,
                valores,
                tamanho,
                interpolacao
            });
        }

        animacoes.set(nome, {
            nome,
            canais,
            duracao
        });
    }

    let animacaoAtual = null;
    let tempoAtual = 0;
    let repetir = true;

    // Uma matriz 4x4 para cada osso.
    const paleta = new Float32Array(
        esqueleto.joints.length * 16
    );

    function calcularPose() {
        // Reinicia os nós à pose original.
        const pose = poseOriginal.map(no => ({
            translation: [...no.translation],
            rotation: [...no.rotation],
            scale: [...no.scale],
            matrix: no.matrix
        }));

        // Aplica os canais da animação atual.
        if (animacaoAtual) {
            for (const canal of animacaoAtual.canais) {
                pose[canal.no][canal.caminho] =
                    avaliarCanal(
                        canal,
                        tempoAtual
                    );
            }
        }

        const globais =
            new Array(nos.length);

        // Calcula transformações hierárquicas.
        function obterMatrizGlobal(indice) {
            if (globais[indice]) {
                return globais[indice];
            }

            const estado = pose[indice];

            const local =
                estado.matrix ??
                matrizTRS(
                    estado.translation,
                    estado.rotation,
                    estado.scale
                );

            globais[indice] = pais[indice] < 0
                ? local
                : multiplicarMatrizes(
                    obterMatrizGlobal(pais[indice]),
                    local
                );

            return globais[indice];
        }

        const inversaMalha = inverterMatrizAfim(
            obterMatrizGlobal(indiceNoMalha)
        );

        // Calcula a matriz final de cada osso.
        for (
            let i = 0;
            i < esqueleto.joints.length;
            i++
        ) {
            const globalOsso = obterMatrizGlobal(
                esqueleto.joints[i]
            );

            const inversaBind = matrizesInversas
                ? matrizesInversas.subarray(
                    i * 16,
                    (i + 1) * 16
                )
                : matrizIdentidade();

            const matrizOsso =
                multiplicarMatrizes(
                    multiplicarMatrizes(
                        inversaMalha,
                        globalOsso
                    ),
                    inversaBind
                );

            paleta.set(
                matrizOsso,
                i * 16
            );
        }
    }

    function tocar(nome, opcoes = {}) {
        const animacao = animacoes.get(nome);

        if (!animacao) {
            throw new Error(
                `Animação "${nome}" não encontrada. ` +
                `Disponíveis: ${[
                    ...animacoes.keys()
                ].join(', ')}`
            );
        }

        if (
            animacaoAtual?.nome !== nome ||
            opcoes.reiniciar === true
        ) {
            tempoAtual = 0;
        }

        animacaoAtual = animacao;
        repetir = opcoes.repetir !== false;

        calcularPose();
    }

    function atualizar(deltaSegundos) {
        if (
            animacaoAtual &&
            Number.isFinite(deltaSegundos)
        ) {
            const duracao =
                animacaoAtual.duracao;

            tempoAtual = duracao > 0
                ? (
                    repetir
                        ? (
                            (
                                tempoAtual +
                                Math.max(0, deltaSegundos)
                            ) % duracao
                        )
                        : Math.min(
                            duracao,
                            tempoAtual +
                            Math.max(0, deltaSegundos)
                        )
                )
                : 0;
        }

        calcularPose();
    }

    // Calcula a pose inicial.
    calcularPose();

    return {
        tocar,
        atualizar,

        listarAnimacoes: () => [
            ...animacoes.keys()
        ],

        obterMatrizesOssos: () => paleta,

        obterQuantidadeOssos: () =>
            esqueleto.joints.length,

        obterTempo: () => tempoAtual,

        obterAnimacaoAtual: () =>
            animacaoAtual?.nome ?? null
    };
}
