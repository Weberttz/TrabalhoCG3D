import { obterObjetosMapa } from "./mapa.js";
import { criarDesenhadorGLB } from "./renderizadorGLB.js";
import { Mesh } from "./mesh.js";

const caminhosTexturas = {
  "office-desk.obj": "/texturas/office-desk_body_basecolor.jpg",
  "office-chair.obj": "/texturas/office-chair_body_basecolor.jpg",
  "ceiling-lamp.obj": "/texturas/ceiling-lamp_body_basecolor.jpg",
};

const SHADER_VERTICE = `#version 300 es
precision highp float;

in vec3 aPosicao;
in vec2 aTextura;
in vec3 aNormal;

uniform mat4 uMatrizMVP;
uniform mat4 uModelo;

uniform vec3 uPosicaoLuz;
uniform vec3 uPosicaoCamera;

out vec2 vTextura;
out vec3 vNormal;
out vec3 vPosicaoMundo;
out vec3 vDirecaoLuz;
out vec3 vDirecaoCamera;

void main() {
  vec4 posicaoMundo = uModelo * vec4(aPosicao, 1.0);

  vPosicaoMundo = posicaoMundo.xyz;
  vNormal = mat3(uModelo) * aNormal;
  vTextura = aTextura;

  vDirecaoLuz = uPosicaoLuz - vPosicaoMundo;
  vDirecaoCamera = uPosicaoCamera - vPosicaoMundo;

  gl_Position = uMatrizMVP * vec4(aPosicao, 1.0);
}
`;

const SHADER_FRAGMENTO = `#version 300 es
precision highp float;

in vec2 vTextura;
in vec3 vNormal;
in vec3 vPosicaoMundo;
in vec3 vDirecaoLuz;
in vec3 vDirecaoCamera;

uniform sampler2D uTextura;
uniform bool uUsarTextura;

uniform vec3 uCor;
uniform vec3 uCorLuz;
uniform vec3 uDirecaoLuz;

out vec4 corFinal;
void main() {
    vec3 corMaterial = uCor;

    if (uUsarTextura) {
      corMaterial *= texture(uTextura, vTextura).rgb;
    }

    vec3 pToLight = normalize(vDirecaoLuz);
    vec3 pToCam = normalize(vDirecaoCamera);

    vec3 halfVec = normalize(pToCam + pToLight);

    vec3 v_normal_n = normalize(vNormal);
    vec3 lightDirection_n = normalize(-uDirecaoLuz);

    float lightd = dot(v_normal_n, lightDirection_n);
    float lightp = dot(v_normal_n, pToLight);
    float lighte = dot(v_normal_n, halfVec);

    float distanciaLuz = length(vDirecaoLuz);

    float a = 1.0;
    float b = 0.01;
    float c = 0.001;

    float atenuacao = 1.0 / (
      a + b * distanciaLuz + c * distanciaLuz * distanciaLuz
    );

    if (lightd < 0.0) lightd = 0.0;
    if (lightp < 0.0) lightp = 0.0;
    if (lighte < 0.0) lighte = 0.0;

    // Luz ambiente
    vec3 resultado = 0.3 * uCorLuz * corMaterial;

    // Luz distante - difusa
    resultado += 0.2 * uCorLuz * lightd * corMaterial;

    // Luz pontual - difusa
    resultado += 0.8 * uCorLuz * lightp * corMaterial * atenuacao;

    // Luz especular
    if (lightp > 0.0) {
      resultado += 0.15 * uCorLuz * pow(lighte, 100.0) * atenuacao;
    }

    corFinal = vec4(resultado, 1.0);
}
`;

const ALTURA_CAMERA = 1.55;

function compilarShader(gl, tipo, codigoFonte) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, codigoFonte);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const erro = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(erro);
  }

  return shader;
}

function criarPrograma(gl) {
  const programa = gl.createProgram();

  const shaderVertice = compilarShader(gl, gl.VERTEX_SHADER, SHADER_VERTICE);

  const shaderFragmento = compilarShader(
    gl,
    gl.FRAGMENT_SHADER,
    SHADER_FRAGMENTO,
  );

  gl.attachShader(programa, shaderVertice);
  gl.attachShader(programa, shaderFragmento);
  gl.linkProgram(programa);

  gl.deleteShader(shaderVertice);
  gl.deleteShader(shaderFragmento);

  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    const erro = gl.getProgramInfoLog(programa);
    gl.deleteProgram(programa);
    throw new Error(erro);
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
  const normalizar = (vetor) => {
    const comprimento = Math.hypot(...vetor);
    return vetor.map((valor) => valor / comprimento);
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
    eixoX[0],
    eixoY[0],
    eixoZ[0],
    0,
    eixoX[1],
    eixoY[1],
    eixoZ[1],
    0,
    eixoX[2],
    eixoY[2],
    eixoZ[2],
    0,
    -produtoEscalar(eixoX, olho),
    -produtoEscalar(eixoY, olho),
    -produtoEscalar(eixoZ, olho),
    1,
  ]);
}

function translacao(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function rotacaoY(angulo) {
  const c = Math.cos(angulo);
  const s = Math.sin(angulo);

  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function verticesCubo() {
  const pontos = [
    [-0.4, -0.4, -0.4],
    [0.4, -0.4, -0.4],
    [0.4, 0.4, -0.4],
    [-0.4, 0.4, -0.4],
    [-0.4, -0.4, 0.4],
    [0.4, -0.4, 0.4],
    [0.4, 0.4, 0.4],
    [-0.4, 0.4, 0.4],
  ];

  const faces = [
    [0, 1, 2, 3],
    [5, 4, 7, 6],
    [4, 0, 3, 7],
    [1, 5, 6, 2],
    [3, 2, 6, 7],
    [4, 5, 1, 0],
  ];

  return new Float32Array(
    faces.flatMap(([a, b, c, d]) => [
      ...pontos[a],
      ...pontos[b],
      ...pontos[c],
      ...pontos[a],
      ...pontos[c],
      ...pontos[d],
    ]),
  );
}

// Mantemos uma única geometria-base, reutilizada por todos os móveis.
function modeloCaixa(x, y, z, largura, altura, profundidade) {
  return new Float32Array([
    largura / 0.8,
    0,
    0,
    0,
    0,
    altura / 0.8,
    0,
    0,
    0,
    0,
    profundidade / 0.8,
    0,
    x,
    y,
    z,
    1,
  ]);
}

function escalaUniforme(s) {
  return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
}

export function criarRenderizador(canvas, modelos, personagemGLB = null) {
  const gl = canvas.getContext("webgl2", { antialias: true });

  if (!gl) {
    throw new Error("WebGL2 não disponível neste navegador");
  }

  const programa = criarPrograma(gl);

  // pega a localização dos atributos que serão usados pela Mesh p/ conectar os buffers de posição, uv e normais
  const localAtributos = {
    attribLocations: {
      vertexPosition: gl.getAttribLocation(programa, "aPosicao"),
      textureCoord: gl.getAttribLocation(programa, "aTextura"),
      vertexNormal: gl.getAttribLocation(programa, "aNormal"),
    },
  };

  const uniformeMatriz = gl.getUniformLocation(programa, "uMatrizMVP");
  const uniformeCor = gl.getUniformLocation(programa, "uCor");
  const uniformeModelo = gl.getUniformLocation(programa, "uModelo");
  const uniformeTextura = gl.getUniformLocation(programa, "uTextura");
  const uniformeUsarTextura = gl.getUniformLocation(programa, "uUsarTextura");
  const uniformeCorLuz = gl.getUniformLocation(programa, "uCorLuz");
  const uniformeDirecaoLuz = gl.getUniformLocation(programa, "uDirecaoLuz");
  const uniformePosicaoLuz = gl.getUniformLocation(programa, "uPosicaoLuz");
  const uniformePosicaoCamera = gl.getUniformLocation(
    programa,
    "uPosicaoCamera",
  );

  const cubo = new Mesh(gl, verticesCubo(), null, null);

  const malhasOBJ = {};

  for (const [nome, modelo] of Object.entries(modelos)) {
    malhasOBJ[nome] = modelo.geometrias.map((geometria) => ({
      malha: new Mesh(
        gl,
        geometria.posicoes,
        geometria.texturas,
        geometria.normais,
      ),
      material: modelo.materiais?.[geometria.material] || null,
    }));
  }

  // carrega as texturas associadas manualmente aos .objs
  const texturasOBJ = {};

  for (const chave in caminhosTexturas) {
    texturasOBJ[chave] = carregarTextura(gl, caminhosTexturas[chave]);
  }

  // Geometria e cores do quarto são importadas, não ficam espalhadas aqui.
  const objetos = obterObjetosMapa();

  gl.useProgram(programa);
  gl.enable(gl.DEPTH_TEST);

  // configuracoes da iluminação
  gl.uniform3fv(uniformePosicaoLuz, [30.0, 3.0, 8.0]); // posição da luz pontual
  gl.uniform3fv(uniformeCorLuz, [1.0, 1.0, 1.0]); // cor da luz
  gl.uniform3fv(uniformeDirecaoLuz, [0.0, -1.0, 0.0]); // direção da luz direcional

  function desenharMalha(malha, matrizFinal, matrizModelo, cor, textura) {
    gl.uniformMatrix4fv(uniformeMatriz, false, matrizFinal);
    gl.uniformMatrix4fv(uniformeModelo, false, matrizModelo);
    gl.uniform3fv(uniformeCor, cor);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textura ?? null);
    gl.uniform1i(uniformeTextura, 0);

    // a textura so vai ser utilizada se existir e a malha tiver uvs
    gl.uniform1i(
      uniformeUsarTextura,
      textura !== undefined && textura !== null && malha.texCoordBuffer != null,
    );

    malha.desenhar(localAtributos);
  }

  function carregarTextura(gl, caminhoTextura) {
    const textura = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, textura);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const imagem = new Image();

    imagem.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, textura);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imagem,
      );
    };

    imagem.src = caminhoTextura;

    return textura;
  }

  function carregarTexturasMateriais(gl, modelo) {
    const caminhoMTL = modelo.caminhosMTL?.[0];

    if (!caminhoMTL) return;

    const cacheTexturas = {};
    const materiais = Object.values(modelo.materiais ?? {});

    for (const material of materiais) {
      for (const propriedade of ["diffuseMap", "normalMap"]) {
        const arquivo = material[propriedade];

        if (!arquivo) continue;

        let textura = cacheTexturas[arquivo];

        if (!textura) {
          const caminhoTextura = new URL(`../texturas/${arquivo}`, caminhoMTL);

          textura = carregarTextura(gl, caminhoTextura.href);
          cacheTexturas[arquivo] = textura;
        }

        material[propriedade] = textura;
      }
    }
  }

  for (const modelo of Object.values(modelos)) {
    carregarTexturasMateriais(gl, modelo);
  }

  const desenhadorPersonagem = personagemGLB
    ? criarDesenhadorGLB(gl, personagemGLB)
    : null;

  const matrizesOssosPorJogador = new Map();

  return {
    definirMatrizesOssos(id, matrizes) {
      matrizesOssosPorJogador.set(String(id), matrizes);
    },

    removerMatrizesOssos(id) {
      matrizesOssosPorJogador.delete(String(id));
    },

    desenhar(jogadores, meuId, orientacao) {
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

      const projecao = perspectiva(
        Math.PI / 4,
        canvas.width / canvas.height,
        0.1,
        100,
      );

      const meuJogador = jogadores.find(
        (jogador) => String(jogador.id) === String(meuId),
      );

      const olho = meuJogador
        ? [meuJogador.x, ALTURA_CAMERA, meuJogador.z]
        : [0, 2, 3];

      const { anguloHorizontal, anguloVertical } = orientacao;
      // limitar o yaw e o pitch
      const cosVertical = Math.cos(anguloVertical);

      gl.uniform3fv(uniformePosicaoCamera, olho);

      // olha + direção produz um alvo da câmera em primeira pessoa
      const alvo = [
        olho[0] + Math.sin(anguloHorizontal) * cosVertical,
        olho[1] + Math.sin(anguloVertical),
        olho[2] - Math.cos(anguloHorizontal) * cosVertical,
      ];

      const camera = multiplicar(projecao, olharPara(olho, alvo));

      for (const objeto of objetos) {
        const matrizTranslacao = translacao(objeto.x, objeto.y, objeto.z);

        const matrizRotacao = rotacaoY(objeto.rotacaoY ?? 0);

        const matrizModelo = multiplicar(matrizTranslacao, matrizRotacao);

        const matrizFinal = multiplicar(camera, matrizModelo);

        const textura = texturasOBJ[objeto.modelo] ?? null;

        const cor = textura ? [1.0, 1.0, 1.0] : (objeto.cor ?? [0.7, 0.7, 0.7]);

        const partes = malhasOBJ[objeto.modelo];

        for (const parte of partes) {
          const material = parte.material;

          const texturaMaterial = material?.diffuseMap || textura;
          const corMaterial = material?.diffuse || cor;

          desenharMalha(
            parte.malha,
            matrizFinal,
            matrizModelo,
            corMaterial,
            texturaMaterial,
          );
        }
      }

      for (const jogador of jogadores) {
        // Não desenha nosso próprio corpo na câmera FPS.
        if (jogador.id === meuId) continue;

        const matrizesJogador = matrizesOssosPorJogador.get(String(jogador.id));

        if (desenhadorPersonagem && matrizesJogador) {
          const escala = 0.85;

          // Usa a direção informada pelo servidor, se existir.
          let angulo = jogador.anguloHorizontal ?? 0;

          const posicao = translacao(
            jogador.x,
            desenhadorPersonagem.deslocamentoSolo * escala,
            jogador.z,
          );

          // subtrai de 180º o angulo e ajusta renderização frontal do personagem
          const rotacao = rotacaoY(Math.PI - angulo);

          const matrizModelo = multiplicar(
            posicao,
            multiplicar(rotacao, escalaUniforme(escala)),
          );

          const matrizMVP = multiplicar(camera, matrizModelo);

          desenhadorPersonagem.desenhar(
            matrizMVP,
            matrizModelo,
            matrizesJogador,
          );
        } else {
          // Cubo original enquanto o GLB não estiver disponível.
          const matrizModelo = translacao(jogador.x, 0.4, jogador.z);

          const cor =
            jogador.cubo === 0 ? [0.16, 0.76, 0.94] : [1.0, 0.57, 0.22];

          desenharMalha(
            cubo,
            multiplicar(camera, matrizModelo),
            matrizModelo,
            cor,
            null,
          );
        }
      }
    },
  };
}
