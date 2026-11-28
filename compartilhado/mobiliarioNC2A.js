const mesa = (id, dx, dz) => ({
    id, modelo: 'mesa.obj', dx, dz, solido: true
});

const cadeira = (id, dx, dz, rotacaoY = 0) => ({
    id, modelo: 'cadeira.obj', dx, dz, rotacaoY, solido: true
});

function estacaoLaboratorio(id, dx) {
    return [
        mesa(`mesa_${id}`, dx, -2.8),
        cadeira(`cadeira_${id}`, dx, -1.8),
        {
            id: `computador_${id}`,
            modelo: 'computador.obj',
            dx,
            dy: 0.79,
            dz: -2.82
        }
    ];
}

const escritorio = [
    { id: 'mesa', modelo: 'office-desk.obj', solido: true },
    {
        id: 'cadeira',
        modelo: 'office-chair.obj',
        dz: 1.02,
        rotacaoY: Math.PI,
        solido: true
    },
    { id: 'computador', modelo: 'computador.obj', dy: 0.74, dz: -0.03 }
];

function pufe(id, dx, dz) {
    // A origem do OBJ fica acima e ao lado do assento.
    return {
        id,
        modelo: 'pufe.obj',
        dx: dx + 0.5075,
        dy: 0.997,
        dz: dz + 0.5065,
        solido: true
    };
}

function aula() {
    return [
        {
            id: 'lousa',
            modelo: 'lousa.obj',
            dx: -0.96,
            dy: 1.42,
            dz: -3.878,
            escala: 0.5,
            solido: true
        },
        ...[-1.88, -0.16, 1.56].flatMap((dz, fila) =>
            [-1.38, 1.38].map((dx, lado) => ({
                id: `cadeira_${fila}_${lado}`,
                modelo: 'cadeira-aula-jogo.obj',
                dx,
                dz,
                rotacaoY: Math.PI,
                solido: true
            }))
        )
    ];
}

function laboratorio(sala) {
    const largura = sala.area ? sala.area.maxX - sala.area.minX : 0;
    const postos = largura >= 20
        ? [-8.5, -2.9, 2.9, 8.5]
        : largura >= 9 ? [-2.15, 2.15] : [0];

    return postos.flatMap((dx, indice) => estacaoLaboratorio(indice + 1, dx));
}

const MOBILIARIO = {
    laboratorio,
    aula,
    administrativo: () => escritorio,
    recepcao: () => [
        ...escritorio,
        pufe('pufe_1', 0.05, -5.09),
        pufe('pufe_2', -2.1, -5.09)
    ],
    copa: () => [
        {
            id: 'mesa',
            modelo: 'mesa-google.obj',
            dx: -0.18,
            dy: 0.254,
            dz: -0.18,
            escala: 0.58,
            solido: true
        },
        cadeira('cadeira_1', 0, 0.95),
        cadeira('cadeira_2', 0, -0.95, Math.PI)
    ]
};

export function gerarMobiliarioSala(sala, nomeAndar) {
    const ancora = sala.ancora;
    if (!ancora) return [];

    const layout = sala.layout ?? sala.categoria;
    const modelos = sala.gerarMobiliario === false
        ? []
        : (MOBILIARIO[layout]?.(sala) ?? []);
    const componentes = [
        ...modelos,
        ...(sala.objetos ?? [])
    ];

    const angulo = ancora.rotacaoY ?? 0;
    const c = Math.cos(angulo);
    const s = Math.sin(angulo);

    return componentes.map(componente => {
        const dx = componente.dx ?? 0;
        const dy = componente.dy ?? 0;
        const dz = componente.dz ?? 0;

        const nome =
            componente.nome ??
            sala.nomesMobiliario?.[componente.id] ??
            `${nomeAndar}_${sala.nome}_${componente.id}`;

        return {
            nome,
            modelo: componente.modelo ?? null,

            andar: nomeAndar,
            sala: sala.nome,

            x: ancora.x + dx * c + dz * s,
            y: ancora.y + dy,
            z: ancora.z - dx * s + dz * c,

            rotacaoY: angulo + (componente.rotacaoY ?? 0),
            escala: componente.escala ?? 1,

            cor: componente.cor ?? [1, 1, 1],

            solido: componente.solido ?? false,
            interativo: componente.interativo ??
                (sala.interativos ?? []).includes(componente.id),

            item: componente.item ?? false,
            podePegar: componente.podePegar ?? false,

            ehBloco: componente.ehBloco ?? false,
            tamanho: componente.tamanho ?? 0.8
        };
    });
}
