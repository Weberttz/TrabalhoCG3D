import { OBJETOS_QUARTO } from '/mapa.js';
const SHADER_VERTICE = `#version 300 es
in vec3 aPosicao;
uniform mat4 uMatrizMVP;
void main() { gl_Position = uMatrizMVP * vec4(aPosicao, 1.0); }
`;
const SHADER_FRAGMENTO = `#version 300 es
precision highp float;
uniform vec3 uCor;
out vec4 corFinal;
void main() { corFinal = vec4(uCor, 1.0); }
`;

function compilarShader(gl, tipo, codigoFonte) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, codigoFonte);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function criarPrograma(gl) {
  const programa = gl.createProgram();
  gl.attachShader(programa, compilarShader(gl, gl.VERTEX_SHADER, SHADER_VERTICE));
  gl.attachShader(programa, compilarShader(gl, gl.FRAGMENT_SHADER, SHADER_FRAGMENTO));
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(programa));
  }
  return programa;
}

// Matrizes 4 × 4, com elementos armazenados por coluna (padrão WebGL).
function multiplicar(matrizA, matrizB) {
  const resultado = new Float32Array(16);
  for (let coluna = 0; coluna < 4; coluna++) {
    for (let linha = 0; linha < 4; linha++) {
      for (let indice = 0; indice < 4; indice++) {
        resultado[coluna * 4 + linha] +=
          matrizA[indice * 4 + linha] * matrizB[coluna * 4 + indice];
      }
    }
  }
  return resultado;
}

function perspectiva(campoVisao, proporcao, perto, longe) {
  const fator = 1 / Math.tan(campoVisao / 2);
  const matriz = new Float32Array(16);
  matriz[0] = fator / proporcao;
  matriz[5] = fator;
  matriz[10] = (longe + perto) / (perto - longe);
  matriz[11] = -1;
  matriz[14] = (2 * longe * perto) / (perto - longe);
  return matriz;
}

function olharPara(olho, alvo) {
  const normalizar = vetor => {
    const comprimento = Math.hypot(...vetor);
    return vetor.map(valor => valor / comprimento);
  };
  const produtoVetorial = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const produtoEscalar = (a, b) =>
    a.reduce((soma, valor, indice) => soma + valor * b[indice], 0);
  const eixoZ = normalizar(olho.map((valor, indice) => valor - alvo[indice]));
  const eixoX = normalizar(produtoVetorial([0, 1, 0], eixoZ));
  const eixoY = produtoVetorial(eixoZ, eixoX);
  return new Float32Array([
    eixoX[0], eixoY[0], eixoZ[0], 0,
    eixoX[1], eixoY[1], eixoZ[1], 0,
    eixoX[2], eixoY[2], eixoZ[2], 0,
    -produtoEscalar(eixoX, olho),
    -produtoEscalar(eixoY, olho),
    -produtoEscalar(eixoZ, olho), 1,
  ]);
}

function translacao(x, y, z) {
  return new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, x, y, z, 1,
  ]);
}

function verticesCubo() {
  const pontos = [
    [-.4, -.4, -.4], [.4, -.4, -.4], [.4, .4, -.4], [-.4, .4, -.4],
    [-.4, -.4, .4],  [.4, -.4, .4],  [.4, .4, .4],  [-.4, .4, .4],
  ];
  const faces = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
    [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];
  return new Float32Array(faces.flatMap(([a, b, c, d]) =>
    [...pontos[a], ...pontos[b], ...pontos[c],
      ...pontos[a], ...pontos[c], ...pontos[d]]));
}

// Mantemos uma única geometria-base, reutilizada por todos os móveis.
function modeloCaixa(x, y, z, largura, altura, profundidade) {
  return new Float32Array([
    largura / 0.8, 0, 0, 0,
    0, altura / 0.8, 0, 0,
    0, 0, profundidade / 0.8, 0,
    x, y, z, 1,
  ]);
}

export function criarRenderizador(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw new Error('WebGL2 não disponível neste navegador');

  const programa = criarPrograma(gl);
  const atributoPosicao = gl.getAttribLocation(programa, 'aPosicao');
  const uniformeMatriz = gl.getUniformLocation(programa, 'uMatrizMVP');
  const uniformeCor = gl.getUniformLocation(programa, 'uCor');

  function enviarVertices(vertices) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    return { buffer, quantidade: vertices.length / 3 };
  }

  const cubo = enviarVertices(verticesCubo());
  // Geometria e cores do quarto são importadas, não ficam espalhadas aqui.
  const objetos = OBJETOS_QUARTO;
  gl.useProgram(programa);
  gl.enableVertexAttribArray(atributoPosicao);
  gl.enable(gl.DEPTH_TEST);

  function desenharMalha(malha, modo, matriz, cor) {
    gl.bindBuffer(gl.ARRAY_BUFFER, malha.buffer);
    gl.vertexAttribPointer(atributoPosicao, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(uniformeMatriz, false, matriz);
    gl.uniform3fv(uniformeCor, cor);
    gl.drawArrays(modo, 0, malha.quantidade);
  }

  return {
    desenhar(jogadores, meuId) {
      const escalaTela = Math.min(window.devicePixelRatio || 1, 2);
      const largura = Math.floor(canvas.clientWidth * escalaTela);
      const altura = Math.floor(canvas.clientHeight * escalaTela);

      if (canvas.width !== largura || canvas.height !== altura) {
        canvas.width = Math.max(1, largura);
        canvas.height = Math.max(1, altura);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.055, 0.09, 0.15, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const projecao = perspectiva(Math.PI / 4,
        canvas.width / canvas.height, 0.1, 100);
      const meuJogador = jogadores.find(jogador => jogador.id === meuId);
      // Primeira pessoa: câmera está na posição do cubo local e olha para -Z.
      // Nesta versão o mouse ainda não gira a câmera.
      const olho = meuJogador ? [meuJogador.x, 0.65, meuJogador.z] : [0, 2, 3];
      const alvo = [olho[0], olho[1], olho[2] - 1];
      const camera = multiplicar(projecao, olharPara(olho, alvo));
      for (const objeto of objetos) {
        const modelo = modeloCaixa(objeto.x, objeto.y, objeto.z,
          objeto.largura, objeto.altura, objeto.profundidade);
        desenharMalha(cubo, gl.TRIANGLES, multiplicar(camera, modelo), objeto.cor);
      }

      for (const jogador of jogadores) {
        if (jogador.id === meuId) continue;
        const modelo = translacao(jogador.x, 0.4, jogador.z);
        const cor = jogador.cubo === 0
          ? [0.16, 0.76, 0.94] : [1.0, 0.57, 0.22];
        desenharMalha(cubo, gl.TRIANGLES, multiplicar(camera, modelo), cor);
      }
    },
  };
}