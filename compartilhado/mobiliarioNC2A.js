const MOBILIARIO = {
    laboratorio: [
        {
            id: 'mesa',
            modelo: 'office-desk.obj',
            dx: 0,
            dy: 0,
            dz: 0,
            solido: true
        },
        {
            id: 'cadeira',
            modelo: 'office-chair.obj',
            dx: 0,
            dy: 0,
            dz: 0.7,
            rotacaoY: Math.PI,
            solido: true
        },
        {
            id: 'computador',
            modelo: 'computador2.obj',
            dx: 0,
            dy: 0.8,
            dz: 0,
            solido: false
        },
        {
            id: 'lampada',
            modelo: 'ceiling-lamp.obj',
            dx: 2.6,
            dy: 3,
            dz: -0.5,
            solido: false
        }
    ],

    administrativo: [
        {
            id: 'mesa',
            modelo: 'office-desk.obj',
            dx: 0,
            dy: 0,
            dz: 0,
            solido: true
        },
        {
            id: 'cadeira',
            modelo: 'office-chair.obj',
            dx: 0,
            dy: 0,
            dz: 0.7,
            rotacaoY: Math.PI,
            solido: true
        }
    ],

    recepcao: [],
    copa: [],
    banheiro: [],
    circulacao: [],
    generica: []
};

export function gerarMobiliarioSala(sala, nomeAndar) {
    const ancora = sala.ancora;

    // Sem uma posição validada, não geramos móveis
    // automaticamente para evitar atravessar paredes.
    if (!ancora) {
        return [];
    }

    const modelos = sala.gerarMobiliario === false
        ? []
        : (MOBILIARIO[sala.categoria] ?? []);

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

            rotacaoY:
                angulo + (componente.rotacaoY ?? 0),

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
