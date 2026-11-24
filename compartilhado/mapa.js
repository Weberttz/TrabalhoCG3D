const LARGURA_SALA = 7.2;
const DESLOCAMENTO = 3;

export const MAPA = Object.freeze([
  {
    nome: "Sala001",
    modelo: "sala001.obj",

    x: 0,
    y: 0,
    z: 0,

    cor: [0.7, 0.7, 0.7],
    solido: true,

    objetos: [
    //   {
    //     nome: "mesa01",
    //     modelo: "mesa.obj",

    //     x: 27.4,
    //     y: 0,
    //     z: 9.5,

    //     cor: [0.65, 0.45, 0.3],
    //     rotacaoY: 0,
    //     solido: true,
    //   },
    //   {
    //     nome: "cadeira01",
    //     modelo: "cadeira.obj",

    //     x: 27.4,
    //     y: 0,
    //     z: 10.2,

    //     cor: [0.25, 0.4, 0.65],
    //     rotacaoY: 0,
    //     solido: true,
    //   },

      {
        nome: "mesaEscritorio",
        modelo: "office-desk.obj",
        x: 27,
        y: 0,
        z: 10,
        rotacaoY: 0,
        solido: true,
      },

      {
        nome: "cadeiraEscritorio",
        modelo: 'office-chair.obj',
        x: 27,
        y: 0,
        z: 11,
        rotacaoY: Math.PI,
        solido: true,
      },

      {
        nome: "lampada",
        modelo: "ceiling-lamp.obj",
        x: 30,
        y: 3,
        z: 8,
        rotacaoY: 0,
        solido: false,
      },


    ],
  },

  {
    nome: "Sala002",
    modelo: "sala001.obj",

    // Encostada à direita da Sala001.
    x: LARGURA_SALA + DESLOCAMENTO,
    y: 0,
    z: 0,

    cor: [0.7, 0.7, 0.7],
    solido: true,

    objetos: [
      {
        nome: "mesaEstudo01",
        modelo: "mesa.obj",

        x: 28.0,
        y: 0,
        z: 9.7,

        cor: [0.65, 0.45, 0.3],
        rotacaoY: 0,
        solido: true,
      },
      {
        nome: "lixeira01",
        modelo: "lixeira.obj",

        x: 31.7,
        y: 0,
        z: 10.8,

        cor: [0.3, 0.3, 0.3],
        rotacaoY: 0,
        solido: true,
      },
    ],
  },
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
      solido: sala.solido,
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
        cor: objeto.cor ?? [1, 1, 1],
      });
    }
  }

  return objetos;
}

export const COLISORES_QUARTO = obterObjetosMapa().filter(
  (objeto) => objeto.solido,
);
