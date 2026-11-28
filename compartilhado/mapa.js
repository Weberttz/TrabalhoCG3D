import { gerarMobiliarioSala } from './mobiliarioNC2A.js';

// A face superior da laje fica um centímetro acima do topo das paredes do térreo.
const PISO_SUPERIOR = 4.01;

// Os limites X vêm das paredes laterais. No espaço local da sala,
// o eixo +Z sempre aponta do fundo para a porta.
function salaRetangular(nome, categoria, esquerda, direita, lado, y, configuracao = {}) {
    const margemParede = 0.12;
    return {
        nome,
        categoria,
        area: {
            minX: esquerda + margemParede,
            maxX: direita - margemParede,
            minZ: lado > 0 ? 4.1 : -11.9,
            maxZ: lado > 0 ? 11.9 : -4.1
        },
        ancora: {
            x: (esquerda + direita) / 2,
            y,
            z: lado * 8,
            rotacaoY: lado > 0 ? Math.PI : 0
        },
        ...configuracao
    };
}

function terreo(nome, categoria, esquerda, direita, lado, configuracao) {
    return salaRetangular(nome, categoria, esquerda, direita, lado, 0, configuracao);
}

function superior(nome, categoria, esquerda, direita, lado, configuracao) {
    return salaRetangular(nome, categoria, esquerda, direita, lado, PISO_SUPERIOR, configuracao);
}

export const PREDIO_NC2A = {
    nome: 'NC2A',
    modelo: 'nc2a.obj',

    andares: [
        {
            nome: 'Andar00',
            nivel: 0,

            salas: [
                { nome: 'Corredor', categoria: 'circulacao' },
                terreo('Recepcao', 'recepcao', -1, 7, 1, {
                    ancora: { x: 5.25, y: 0, z: 7.15, rotacaoY: Math.PI / 2 }
                }),
                terreo('CAIS', 'laboratorio', 20, 45, -1),
                terreo('Sala002', 'laboratorio', 24, 31, 1, {
                    layout: 'administrativo',
                    ancora: { x: 25.22, y: 0, z: 8.85, rotacaoY: Math.PI / 2 },
                    nomesMobiliario: {
                        mesa: 'mesaEscritorio01',
                        cadeira: 'cadeiraEscritorio01',
                        computador: 'computadorSala002'
                    },
                    objetos: [
                        {
                            id: 'apoio_radio',
                            modelo: 'mesa.obj',
                            dx: -2.05,
                            solido: true
                        },
                        {
                            nome: 'radio01',
                            modelo: 'radio.obj',
                            dx: -2.05,
                            dy: 0.964,
                            solido: true,
                            interativo: true
                        },
                        {
                            nome: 'lampada01',
                            modelo: 'ceiling-lamp.obj',
                            dx: 0.6,
                            // O topo da luminária encosta na face inferior da laje.
                            dy: 3.087,
                            dz: 2.28
                        },
                        {
                            nome: 'lixeira01',
                            modelo: 'lixeira.obj',
                            dx: -1.75,
                            dz: 5.28,
                            solido: true,
                            interativo: true
                        },
                        {
                            nome: 'blocoTeste01',
                            modelo: null,
                            dx: -0.15,
                            dy: 0.2,
                            dz: 3.78,
                            ehBloco: true,
                            tamanho: 0.4,
                            cor: [0.9, 0.2, 0.2],
                            item: true,
                            podePegar: true,
                            interativo: true
                        }
                    ],
                    interativos: ['mesa']
                }),
                // O OBJ repete o prefixo Sala002 no térreo. Os sufixos
                // abaixo identificam cada sala pela porta correspondente.
                terreo('Sala002.001', 'laboratorio', 31, 38, 1),
                terreo('Sala002.002', 'laboratorio', 38, 45, 1),
                terreo('Sala015', 'aula', -45, -34, 1, {
                    ancora: { x: -37.5, y: 0, z: 8, rotacaoY: Math.PI }
                }),
                terreo('Sala002.004', 'aula', -34, -27, 1),
                terreo('Sala002.013', 'aula', -27, -10, 1),
                terreo('Sala002.010', 'aula', 7, 24, 1),
                terreo('Sala002.016', 'laboratorio', -45, -38, -1),
                terreo('Sala002.007', 'laboratorio', -38, -31, -1),
                terreo('Sala002.008', 'laboratorio', -31, -24, -1),
                terreo('Sala002.009', 'laboratorio', -24, -9, -1),
                terreo('Sala002.011', 'laboratorio', -9, -2, -1),
                terreo('Sala002.012', 'laboratorio', -2, 5, -1),
                terreo('Sala002.014', 'laboratorio', 5, 20, -1)
            ]
        },
        {
            nome: 'Andar01',
            nivel: 1,

            salas: [
                { nome: 'Corredor', categoria: 'circulacao' },
                { nome: 'Escada', categoria: 'circulacao' },
                superior('Ladesc', 'laboratorio', -45, -38, -1),
                superior('Lamac', 'laboratorio', -38, -31, -1),
                superior('Incubauece', 'laboratorio', -31, -18.9, -1),
                superior('GesadPesquisa', 'laboratorio', -18.9, -9, -1),
                superior('LabChain', 'laboratorio', -45, -38, 1),
                superior('Lagic', 'laboratorio', -38, -31, 1),
                superior('Lasid', 'laboratorio', -31, -24, 1),
                superior('Larces', 'laboratorio', -24, -10, 1),
                superior('Embrapii', 'laboratorio', 7, 21.1, 1),
                superior('Secretaria', 'administrativo', -1, 7, 1, {
                    ancora: { x: 4.55, y: PISO_SUPERIOR, z: 10.6, rotacaoY: Math.PI },
                    objetos: [
                        { id: 'visita_1', modelo: 'cadeira.obj', dx: -0.85, dz: 2.95, rotacaoY: Math.PI, solido: true },
                        { id: 'visita_2', modelo: 'cadeira.obj', dx: 0.85, dz: 2.95, rotacaoY: Math.PI, solido: true }
                    ]
                }),
                superior('Copa', 'copa', 5.1, 15.1, -1, {
                    ancora: { x: 7.8, y: PISO_SUPERIOR, z: -9.55 },
                    objetos: [
                        { id: 'lixeira', modelo: 'lixeira.obj', dx: 6.3, dz: -1.65, solido: true }
                    ]
                }),
                superior('BanheiroFeminino', 'banheiro', -9, -2, -1, {
                    objetos: [
                        { id: 'lixeira', modelo: 'lixeira.obj', dx: 2.65, dz: 2.9, solido: true }
                    ]
                }),
                superior('BanheiroMasculino', 'banheiro', -2, 5.1, -1, {
                    objetos: [
                        { id: 'lixeira', modelo: 'lixeira.obj', dx: 2.7, dz: 2.9, solido: true }
                    ]
                }),
                superior('Sala104', 'aula', 15.1, 21.1, -1),
                superior('Sala105', 'aula', 21.1, 27.1, 1),
                superior('Sala106', 'aula', 21.1, 27.1, -1),
                superior('Sala107', 'aula', 27.1, 33.1, 1),
                superior('Sala108', 'aula', 27.1, 33.1, -1),
                superior('Sala109', 'aula', 33.1, 39.1, 1),
                superior('Sala110', 'aula', 33.1, 39.1, -1),
                superior('Sala111', 'aula', 39.1, 45, 1),
                superior('Sala112', 'aula', 39.1, 45, -1)
            ]
        }
    ]
};

// Formato de compatibilidade com o código atual.
//
// Existe uma única instância da geometria do NC2A.
// As outras entradas representam salas e mobília.
export const MAPA = [
    {
        nome: 'nc2a',
        andar: 'Andar00',
        categoria: 'estrutura',
        modelo: PREDIO_NC2A.modelo,

        x: 0,
        y: 0,
        z: 0,

        solido: true,
        objetos: []
    },

    ...PREDIO_NC2A.andares.flatMap(andar =>
        andar.salas.map(sala => ({
            nome: sala.nome,
            andar: andar.nome,
            categoria: sala.categoria,
            ancora: sala.ancora ?? null,
            area: sala.area ?? null,

            // Não replica a geometria estrutural.
            modelo: null,

            objetos: gerarMobiliarioSala(
                sala,
                andar.nome
            )
        }))
    )
];

export function obterObjetosMapa() {
    const objetos = [];

    for (const sala of MAPA) {
        // A geometria principal só é registrada uma vez.
        if (sala.modelo) {
            objetos.push({
                nome: `${sala.nome}_estrutura`,
                andar: sala.andar,
                sala: sala.nome,
                modelo: sala.modelo,

                x: sala.x ?? 0,
                y: sala.y ?? 0,
                z: sala.z ?? 0,

                cor: [1, 1, 1],
                rotacaoY: 0,
                solido: sala.solido ?? true,
                interativo: false,
                item: false
            });
        }

        // Os objetos da sala já estão em coordenadas globais.
        for (const objeto of sala.objetos ?? []) {
            objetos.push({
                ...objeto,
                andar: sala.andar,
                sala: sala.nome
            });
        }
    }

    return objetos;
}

// Determina a sala lógica do jogador em áreas
// que já possuem limites configurados.
export function obterSalaEmPosicao(andar, x, z) {
    const descricaoAndar = PREDIO_NC2A.andares.find(
        item => item.nome === andar
    );

    if (!descricaoAndar) return 'Corredor';

    for (const sala of descricaoAndar.salas) {
        const area = sala.area;
        if (!area) continue;

        if (
            x >= area.minX &&
            x <= area.maxX &&
            z >= area.minZ &&
            z <= area.maxZ
        ) {
            return sala.nome;
        }
    }

    return 'Corredor';
}

export const COLISORES_QUARTO =
    obterObjetosMapa().filter(objeto => objeto.solido);


export function obterAlvosPorta(porta, jogador) {
    if (!jogador || Math.abs((jogador.y ?? 0) + 1.25 - porta.y) > 1.75) return [];

    const alvo = { ...porta, porta: true, interativo: true };
    const alvos = [alvo];

    if (porta.centroPar) {
        alvos.push({ ...alvo, ...porta.centroPar });
    }

    if (porta.aberta) {
        alvos.push({ ...alvo, ...porta.centroAberto });
    }

    return alvos;
}

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
        if (objeto.visivel === false) continue;
        if (objeto.item && objeto.podePegar === false) continue;
        if (!objeto.interativo && !objeto.item) continue;

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
