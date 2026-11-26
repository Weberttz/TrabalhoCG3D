export const leitorMTL = {
  //interpreta os dados do mtl e guarda os materiais
  parseMTL(texto) {
    const materiais = {};
    let material = null;

    function parseMapArgs(argumentos) {
      return argumentos.trim();
    }
    //funcoes p/ interpretar cada keyword do mtl
    const keywords = {
      newmtl(partes, argumentos) {
        const nome = argumentos;

        material = {
          diffuse: [1, 1, 1],
          diffuseMap: null,
          normalMap: null,
          ambient: [0, 0, 0],
          specular: [1, 1, 1],
          specularMap: null,
          shininess: 400,
          opacity: 1,
        };
        materiais[nome] = material;
      },

      Ns(partes) {
        material.shininess = Number(partes[0]);
      },

      Ka(partes) {
        material.ambient = partes.slice(0, 3).map(Number);
      },

      Kd(partes) {
        material.diffuse = partes.slice(0, 3).map(Number);
      },

      Ks(partes) {
        material.specular = partes.slice(0, 3).map(Number);
      },

      Ke(partes) {
        material.emissive = partes.slice(0, 3).map(Number);
      },

      map_Kd(partes, argumentos) {
        material.diffuseMap = parseMapArgs(argumentos);
      },

      map_Ns(partes, argumentos) {
        material.specularMap = parseMapArgs(argumentos);
      },

      map_Bump(partes, argumentos) {
        material.normalMap = parseMapArgs(argumentos);
      },

      bump(partes, argumentos) {
        material.normalMap = parseMapArgs(argumentos);
      },

      Ni(partes) {
        material.opticalDensity = Number(partes[0]);
      },

      d(partes) {
        material.opacity = Number(partes[0]);
      },

      illum(partes) {
        material.illum = Number.parseInt(partes[0], 10);
      },
    };

    const linhas = texto.split("\n");

    for (const linhaTexto of linhas) {
      const linha = linhaTexto.trim();

      if (!linha || linha.startsWith("#")) continue;

      const partes = linha.split(/\s+/);
      const comando = partes[0];
      const argumentos = partes.slice(1).join(" ");

      const handler = keywords[comando];

      if (handler && (comando === "newmtl" || material)) {
        handler(partes.slice(1), argumentos);
      }
    }

    return materiais;
  },

  async carregarMateriais(obj) {
    const baseHref = new URL(obj.caminho, window.location.href);

    const arquivosMTL = await Promise.all(
      obj.materialLibs.map(async (nomeArquivo) => {
        const caminhoMTL = new URL(`../modelosMTL/${nomeArquivo}`, baseHref);
        const resposta = await fetch(caminhoMTL);
        if (!resposta.ok) {
          console.warn(`Arquivo .mtl não encontrado: ${nomeArquivo}`);
          return null;
        }
        return {
          texto: await resposta.text(),
          caminho: caminhoMTL,
        };
      }),
    );

    const arquivosValidos = arquivosMTL.filter(Boolean);
    const materiais = this.parseMTL(
      arquivosValidos.map((arquivo) => arquivo.texto).join("\n"),
    );

    return {
      materiais,
      caminhosMTL: arquivosValidos.map((arquivo) => arquivo.caminho),
    };
  },
};
