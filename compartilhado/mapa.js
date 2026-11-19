export const OBJETOS_QUARTO = Object.freeze([
    {
        nome: 'salagenerica',
        modelo: 'SalaGenerica.obj',
        x: 0,
        y: 0,
        z: 0,
        cor: [0.39, 0.56, 0.71],
        solido: false
    },
    {
        nome: 'mesa',
        modelo: 'mesa.obj',
        x: 28,
        y: 0,
        z: 10,
        cor: [0.55, 0.35, 0.20],
        solido: true
    },
    {
        nome: 'cadeira',
        modelo: 'cadeira.obj',
        x: 28,
        y: 0,
        z: 8.5,
        cor: [0.20, 0.45, 0.85],
        solido: true
    },
    {
        nome: 'computador',
        modelo: 'computador.obj',
        x: 28,
        y: 0.8,
        z: 10,
        cor: [0.25, 0.75, 0.35],
        solido: false
    },
    {
        nome: 'lixeira',
        modelo: 'lixeira.obj',
        x: 31.5,
        y: 0,
        z: 10,
        cor: [0.65, 0.65, 0.70],
        solido: true
    }
]);

export const COLISORES_QUARTO =
    OBJETOS_QUARTO.filter(objeto => objeto.solido);
