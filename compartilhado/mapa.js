import { gerarMobiliarioSala } from './mobiliarioNC2A.js';

export const PREDIO_NC2A = {
    nome: 'NC2A',
    modelo: 'nc2a.obj',

    andares: [
        {
            nome: 'Andar00',
            nivel: 0,

            salas: [
                {
                    nome: 'Corredor',
                    categoria: 'circulacao'
                },
                {
                    nome: 'Recepcao',
                    categoria: 'recepcao'
                },
                {
                    nome: 'CAIS',
                    categoria: 'laboratorio'
                },
                {
                    nome: 'Sala002',
                    categoria: 'laboratorio',

                    // Ponto onde a mobília é posicionada.
                    ancora: {
                        x: 27.4,
                        y: 0,
                        z: 9.5,
                        rotacaoY: 0
                    },

                    // Área aproximada utilizada para
                    // identificar a sala do jogador.
                    area: {
                        minX: 24.5,
                        maxX: 31.0,
                        minZ: 4.4,
                        maxZ: 11.8
                    },

                    // Mantém os nomes já utilizados no jogo.
                    nomesMobiliario: {
                        mesa: 'mesaEscritorio01',
                        cadeira: 'cadeiraEscritorio01',
                        computador: 'computadorSala002',
                        lampada: 'lampada01'
                    },

                    objetos: [
                        {
                            nome: 'radio01',
                            modelo: 'radio.obj',
                            dx: 0.4,
                            dy: 0.9,
                            dz: 0,
                            solido: true,
                            interativo: true
                        },
                        {
                            nome: 'lixeira01',
                            modelo: 'lixeira.obj',
                            dx: 3.1,
                            dy: 0,
                            dz: 1.1,
                            solido: true,
                            interativo: true
                        },
                        {
                            nome: 'lixo01',
                            modelo: null,
                            dx: 1.6,
                            dy: 0.2,
                            dz: -0.5,
                            ehBloco: true,
                            tamanho: 0.1,
                            cor: [0.9, 0.2, 0.2],
                            item: true,
                            podePegar: true,
                            interativo: true,
                            solido: false
                        }
                    ],
                    interativos: ['mesa'],
                }
            ]
        },
        {
            nome: 'Andar01',
            nivel: 1,

            salas: [
                {
                    nome: 'Corredor',
                    categoria: 'circulacao'
                },
                {
                    nome: 'Ladesc',
                    categoria: 'laboratorio',
                    ancora: {
                        x: -41.5,
                        y: 4,
                        z: -8,
                        rotacaoY: 0
                    },
                    area: {
                        minX: -44.5,
                        maxX: -38.5,
                        minZ: -11.8,
                        maxZ: -4.4
                    }
                },
                {
                    nome: 'GesadPesquisa',
                    categoria: 'laboratorio',
                    ancora: {
                        x: -12.5,
                        y: 4,
                        z: -8,
                        rotacaoY: 0
                    },
                    area: {
                        minX: -15.5,
                        maxX: -9.5,
                        minZ: -11.8,
                        maxZ: -4.4
                    }
                },
                {
                    nome: 'Secretaria',
                    categoria: 'administrativo',
                    ancora: {
                        x: 1.5,
                        y: 4,
                        z: 8,
                        rotacaoY: 0
                    },
                    area: {
                        minX: -1.5,
                        maxX: 4.5,
                        minZ: 4.4,
                        maxZ: 11.8
                    }
                },
                {
                    nome: 'Copa',
                    categoria: 'copa'
                }
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
