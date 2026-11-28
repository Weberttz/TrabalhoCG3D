// Coordenadas X/Z da planta anotada do térreo, com origem em (0, 0, 0).
const QUARTO_DE_VOLTA = Math.PI / 2;
const ALTURA_TAMPO = 0.78;

const CORES_ESTOFADO = [
    [0.12, 0.42, 0.96],
    [0.16, 0.73, 0.28],
    [1, 0.81, 0.16],
    [0.95, 0.19, 0.19]
];

function movel(id, modelo, dx, dz, rotacaoY = 0, opcoes = {}) {
    return { id, modelo, dx, dz, rotacaoY, solido: true, ...opcoes };
}

function cadeiraGamer(id, x, z, angulo) {
    return movel(id, 'office-chair-jogo.obj', x, z, angulo);
}

function notebook(id, x, z, angulo) {
    return movel(id, 'notebook.obj', x, z, angulo, { dy: ALTURA_TAMPO, solido: false });
}

function bancada(id, x, z, lado, lugares) {
    return [
        movel(id, 'bancada-laboratorio.obj', x, z, QUARTO_DE_VOLTA),
        ...lugares.flatMap((posicaoZ, i) => [
            cadeiraGamer(`${id}_cadeira_${i + 1}`, x + lado * 1.04, posicaoZ, -lado * QUARTO_DE_VOLTA),
            notebook(`${id}_notebook_${i + 1}`, x + lado * 0.04, posicaoZ, lado * QUARTO_DE_VOLTA)
        ])
    ];
}

function mesaReuniao(x, z) {
    const cadeiras = [
        [-0.46, -0.8, 0], [0.46, -0.8, 0],
        [-0.46, 0.8, Math.PI], [0.46, 0.8, Math.PI],
        [-1.38, 0, QUARTO_DE_VOLTA], [1.38, 0, -QUARTO_DE_VOLTA]
    ];

    return [
        movel('mesa_reuniao', 'mesa-reuniao.obj', x, z),
        ...cadeiras.map(([dx, dz, angulo], i) =>
            cadeiraGamer(`reuniao_cadeira_${i + 1}`, x + dx, z + dz, angulo)
        )
    ];
}

function mesaApoio(id, x, z, ladoNotebook) {
    return [
        movel(id, 'mesa-apoio-lab.obj', x, z),
        cadeiraGamer(`${id}_cadeira_1`, x - 0.39, z - 0.85, 0),
        cadeiraGamer(`${id}_cadeira_2`, x + 0.39, z - 0.85, 0),
        notebook(`${id}_notebook`, x + ladoNotebook * 0.38, z, Math.PI)
    ];
}

function mesaGrupo(id, x, z) {
    const lugares = [[-1, -0.37], [-1, 0.37], [1, -0.37], [1, 0.37]];
    return [
        movel(id, 'mesa-grupo.obj', x, z),
        ...lugares.map(([lado, dz], i) =>
            movel(`${id}_cadeira_${i + 1}`, 'cadeira.obj', x + lado * 1.08, z + dz, lado * QUARTO_DE_VOLTA,
                { corEstofado: CORES_ESTOFADO[i] })
        )
    ];
}

function mesaComPufes(id, x, z) {
    const lugares = [[1.04, 0], [-1.04, 0], [0, 1.04], [0, -1.04]];
    return [
        movel(id, 'mesa-google.obj', x - 0.18, z - 0.18, 0, { dy: 0.254, escala: 0.58 }),
        ...lugares.map(([dx, dz], i) =>
            movel(`${id}_pufe_${i + 1}`, 'pufe.obj', x + dx + 0.299, z + dz + 0.299, 0,
                { dy: 0.588, escala: 0.59 })
        )
    ];
}

function salaAula(esquerda, xProfessor, zProfessor, colunas, fileiras, mesa = {}) {
    return [
        movel('lousa', 'lousa-terreo.obj', esquerda + 0.225, zProfessor, -QUARTO_DE_VOLTA, { dy: 1.02 }),
        movel('mesa_professor', 'mesa.obj', xProfessor, zProfessor, QUARTO_DE_VOLTA, mesa),
        movel('cadeira_professor', 'cadeira-aula-jogo.obj', xProfessor - 1, zProfessor, QUARTO_DE_VOLTA),
        ...fileiras.flatMap((z, fila) =>
            colunas.map((x, coluna) =>
                movel(`cadeira_${fila + 1}_${coluna + 1}`, 'cadeira-aula-jogo.obj', x, z, -QUARTO_DE_VOLTA)
            )
        )
    ];
}

const FILEIRAS_SALA = [7.47, 8.93, 10.42];

export const MOBILIARIO_TERREO_NC2A = {
    Recepcao: [movel('sofa', 'sofa-recepcao.obj', 6.2, 8.27, -QUARTO_DE_VOLTA)],
    CAIS: [movel('mesa_central', 'mesa-cais.obj', 33.5, -8.08)],
    Sala002: [
        ...salaAula(24, 26.92, 9.12, [28.48, 29.94], FILEIRAS_SALA,
            { nome: 'mesaEscritorio01', interativo: true }),
        // As interações existentes ficam na mesa do professor e na lateral da sala.
        movel('computador', 'computador.obj', 26.95, 8.84, -QUARTO_DE_VOLTA,
            { nome: 'computadorSala002', dy: 0.79, solido: false }),
        movel('radio', 'radio.obj', 26.92, 9.64, -QUARTO_DE_VOLTA,
            { nome: 'radio01', dy: 0.964, interativo: true }),
        movel('lixeira', 'lixeira.obj', 30.47, 11.34, 0,
            { nome: 'lixeira01', interativo: true }),
        {
            nome: 'blocoTeste01',
            dx: 27.17,
            dy: 0.2,
            dz: 11.02,
            ehBloco: true,
            tamanho: 0.4,
            cor: [0.9, 0.2, 0.2],
            item: true,
            podePegar: true,
            interativo: true
        }
    ],
    'Sala002.001': salaAula(31, 33.98, 9.15, [35.59, 37.04], FILEIRAS_SALA),
    'Sala002.002': salaAula(38, 41.0, 9.16, [42.63, 44.07], FILEIRAS_SALA),
    'Sala002.007': [
        ...mesaReuniao(-34.9, -10.69),
        ...bancada('bancada_oeste', -37.08, -6.98, 1, [-8.68, -7.52, -6.36, -5.20]),
        ...mesaApoio('mesa_norte', -32.23, -8.23, -1),
        ...mesaApoio('mesa_sul', -32.23, -6.07, 1)
    ],
    'Sala002.009': [
        ...bancada('bancada_oeste', -22.87, -8.74, 1, [-10.37, -9.23, -8.09, -6.95]),
        ...bancada('bancada_central', -16.62, -8.60, -1, [-10.31, -9.16, -8.01, -6.86]),
        ...bancada('bancada_leste', -10.13, -8.62, -1, [-10.35, -9.19, -8.03, -6.87])
    ],
    'Sala002.010': salaAula(7, 10.32, 8.75,
        [13.2, 14.58, 15.96, 17.34, 18.72, 20.1, 21.48, 22.86],
        [5.15, 6.57, 8, 9.43, 10.85]),
    'Sala002.014': [
        ...mesaGrupo('grupo_noroeste', 7.02, -9.83),
        ...mesaGrupo('grupo_sudoeste', 6.76, -6.69),
        ...mesaGrupo('grupo_nordeste', 17.63, -10.14),
        ...mesaGrupo('grupo_sudeste', 17.72, -6.52),
        ...mesaComPufes('mesa_redonda_norte', 12.39, -9.83),
        ...mesaComPufes('mesa_redonda_sul', 12.51, -6.65)
    ]
};
