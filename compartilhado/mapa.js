const LARGURA_SALA = 7.2;
const DESLOCAMENTO = 3

export const MAPA = Object.freeze([
    {
        nome: 'Sala001',
        modelo: 'sala001.obj',

        x: 0,
        y: 0,
        z: 0,

        cor: [0.7, 0.7, 0.7],
        solido: true,

        objetos: [
            {
                nome: 'mesaEscritorio01',
                modelo: 'office-desk.obj',
                x: 27.4,
                y: 0,
                z: 9.5,
                cor: [1, 1, 1],
                rotacaoY: 0,
                solido: true,
                interativo: false,
            },
            {
                nome: 'computador01',
                modelo: 'computador2.obj',
                x: 27.8,
                y: 1.3,
                z: 9.5,
                cor: [1, 1, 1],
                rotacaoY: 0,
                solido: true,
                interativo: false,
            },
            {
                nome: 'cadeiraEscritorio01',
                modelo: 'office-chair.obj',
                x: 27.4,
                y: 0,
                z: 10.2,
                cor: [1, 1, 1],
                rotacaoY: Math.PI,
                solido: true,
                interativo: false,
            },

            {
                nome: 'lampada01',
                modelo: 'ceiling-lamp.obj',
                x: 30,
                y: 3,
                z: 9,
                cor: [1, 1, 1],
                rotacaoY: 0,
                solido: false,
                interativo: false,
            }
        ]
    },

    {
        nome: 'Sala002',
        modelo: 'sala001.obj',

        // Encostada à direita da Sala001.
        x: LARGURA_SALA + DESLOCAMENTO,
        y: 0,
        z: 0,

        cor: [0.7, 0.7, 0.7],
        solido: true,

        objetos: [
            {
                nome: 'mesaEscritorio02',
                modelo: 'office-desk.obj',
                x: 28.0,
                y: 0,
                z: 9.7,
                cor: [1, 1, 1],
                rotacaoY: 0,
                solido: true,
                interativo: false,
            },

            {
                nome: 'radio01',
                modelo: 'radio.obj',
                x: 28.0,
                y: 1,
                z: 9.7,
                cor: [0.5, 0.5, 0.5],
                rotacaoY: 0,
                solido: true,
                interativo: true,
            },
            {
                nome: 'lixeira01',
                modelo: 'lixeira.obj',
                x: 31.7,
                y: 0,
                z: 10.8,
                cor: [0.3, 0.3, 0.3],
                rotacaoY: 0,
                solido: true,
                interativo: true,
            },

            {
                nome: 'cadeiraEscritorio02',
                modelo: 'office-chair.obj',
                x: 28,
                y: 0,
                z: 10.5,
                cor: [1, 1, 1],
                rotacaoY: Math.PI,
                solido: true,
                interativo: false,
            },

            {
                nome: 'lampada02',
                modelo: 'ceiling-lamp.obj',
                x: 30,
                y: 3,
                z: 9,
                cor: [1, 1, 1],
                rotacaoY: 0,
                solido: false,
                interativo: false,
            },
        ]
    }
]);

export function obterObjetosMapa() {
    const objetos = [];

    for (const sala of MAPA) {
        objetos.push({
            nome: `${sala.nome}_estrutura`,
            sala: sala.nome,
            modelo: sala.modelo,

            x: sala.x,
            y: sala.y,
            z: sala.z,

            rotacaoY: sala.rotacaoY ?? 0,
            cor: sala.cor ?? [1, 1, 1],
            solido: sala.solido
        });

        for (const objeto of sala.objetos ?? []) {
            objetos.push({
                ...objeto,

                sala: sala.nome,

                // Aplica a posição global da sala.
                x: sala.x + objeto.x,
                y: sala.y + objeto.y,
                z: sala.z + objeto.z,

                rotacaoY: objeto.rotacaoY ?? 0,
                cor: objeto.cor ?? [1, 1, 1]
            });
        }
    }

    return objetos;
}

export const COLISORES_QUARTO =
    obterObjetosMapa().filter(objeto => objeto.solido);

// Retorna o objeto próximo ao jogador, se ele estiver olhando
export function obterObjetoInterativoProximo(
    jogador,
    objetos,
    direcaoOlhar,
    distanciaMaxima = 2,
    anguloMaximo = 35
) {
    if (!jogador || !direcaoOlhar) return null;

    const moduloOlhar = Math.hypot(
        direcaoOlhar.x,
        direcaoOlhar.z
    );

    if (moduloOlhar === 0) return null;

    // Normaliza o vetor de direção do olhar.
    const olharX = direcaoOlhar.x / moduloOlhar;
    const olharZ = direcaoOlhar.z / moduloOlhar;

    // Limite do produto escalar.
    const cosLimite = Math.cos(
        anguloMaximo * Math.PI / 180
    );

    let objetoProximo = null;
    let menorDistancia = Infinity;

    for (const objeto of objetos) {
        if (!objeto.interativo) continue;

        // Vetor do jogador até o objeto.
        const dx = objeto.x - jogador.x;
        const dz = objeto.z - jogador.z;

        const distancia = Math.hypot(dx, dz);

        const alcance =
            objeto.alcanceInteracao ?? distanciaMaxima;

        if (distancia > alcance) continue;

        // Produto escalar entre o olhar e o
        // vetor normalizado em direção ao objeto.
        const alinhamento = distancia > 0.000001
            ? (olharX * dx + olharZ * dz) / distancia
            : 1;

        // Objeto fora do cone de visão.
        if (alinhamento < cosLimite) continue;

        if (distancia < menorDistancia) {
            menorDistancia = distancia;
            objetoProximo = objeto;
        }
    }

    return objetoProximo;
}
