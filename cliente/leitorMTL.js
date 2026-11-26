export const leitorMTL = {
  parseMTL(texto) {
    const materiais = {};
    let materialAtual = null;

    const linhas = texto.split("\n");

    for (const linha of linhas) {
      const partes = linha.trim().split(/\s+/);
      const comando = partes[0];

      if (comando === "newmtl") {
        const nome = partes.slice(1).join(" ");

        materialAtual = {
          nome,
          diffuse: [1, 1, 1],
          diffuseMap: null,
          normalMap: null,
        };

        materiais[nome] = materialAtual;
      } else if (materialAtual && comando === "Kd") {
        materialAtual.diffuse = partes.slice(1, 4).map(Number);
      } else if (materialAtual && comando === "map_Kd") {
        materialAtual.diffuseMap = partes.slice(1).pop();
      } else if (materialAtual && comando === "map_Bump") {
        materialAtual.normalMap = partes.slice(1).pop();
      } else if (materialAtual && comando === "bump") {
        materialAtual.normalMap = partes.slice(1).pop();
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
