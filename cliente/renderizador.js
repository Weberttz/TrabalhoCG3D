import { obterObjetosMapa } from "./mapa.js";
import { criarDesenhadorGLB } from "./renderizadorGLB.js";
import { Mesh } from "./mesh.js";

const caminhosTexturas = {
  "office-desk.obj": "/texturas/office-desk_body_basecolor.jpg",
  "office-chair.obj": "/texturas/office-chair_body_basecolor.jpg",
  "ceiling-lamp.obj": "/texturas/ceiling-lamp_body_basecolor.jpg",
  "radio.obj": "/texturas/radio_textura.jpg",
  "lousa.obj": "/texturas/lousa_textura.jpg",
};

const ESCALA_V_RADIO = 15.9874773;

const UV_RADIO = {
  escala: [15.4639206, ESCALA_V_RADIO],
  deslocamento: [
    0.000523090363,
    1 - ESCALA_V_RADIO - 0.000523090363
  ]
};

const SHADER_VERTICE = `#version 300 es
precision highp float;

uniform vec2 uEscalaUV;
uniform vec2 uDeslocamentoUV;

in vec3 aPosicao;
in vec2 aTextura;
in vec3 aNormal;

uniform mat4 uMatrizMVP;
uniform mat4 uModelo;

uniform vec3 uPosicaoLuz;
uniform vec3 uPosicaoCamera;

out vec2 vTextura;
out vec3 vNormal;
out vec3 vDirecaoLuz;
out vec3 vDirecaoCamera;

void main() {
  vec4 posicaoMundo = uModelo * vec4(aPosicao, 1.0);

  vNormal = mat3(uModelo) * aNormal;
  vTextura = aTextura * uEscalaUV + uDeslocamentoUV;

  vDirecaoLuz = uPosicaoLuz - posicaoMundo.xyz;
  vDirecaoCamera = uPosicaoCamera - posicaoMundo.xyz;

  gl_Position = uMatrizMVP * vec4(aPosicao, 1.0);
}
`;

const SHADER_FRAGMENTO = `#version 300 es
precision highp float;

in vec2 vTextura;
in vec3 vNormal;
in vec3 vDirecaoLuz;
in vec3 vDirecaoCamera;

uniform sampler2D uTextura;
uniform sampler2D uMapaEspecular;
uniform sampler2D uMapaEmissivo;
uniform bool uUsarMapaEmissivo;

uniform bool uUsarTextura;
uniform bool uUsarMapaEspecular;

uniform vec3 uCor;
uniform vec3 uCorAmbiente;
uniform vec3 uCorEspecular;
uniform vec3 uCorEmissiva;

uniform float uBrilho;

uniform vec3 uCorLuz;
uniform vec3 uDirecaoLuz;

out vec4 corFinal;

void main() {
    vec3 corTextura = vec3(1.0);

    if (uUsarTextura) {
      corTextura = texture(uTextura, vTextura).rgb;
    }

    vec3 corDifusa = uCor * corTextura;
    vec3 corAmbiente = uCorAmbiente * corTextura;
    vec3 corEspecular = uCorEspecular;

    if (uUsarMapaEspecular) {
      corEspecular *= texture(uMapaEspecular, vTextura).rgb;
    }

    vec3 pToLight = normalize(vDirecaoLuz);
    vec3 pToCam = normalize(vDirecaoCamera);
    vec3 halfVec = normalize(pToCam + pToLight);

    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(-uDirecaoLuz);

    float lightd = max(dot(normal, lightDirection), 0.0);
    float lightp = max(dot(normal, pToLight), 0.0);
    float lighte = max(dot(normal, halfVec), 0.0);

    float distanciaLuz = length(vDirecaoLuz);

    float a = 1.0;
    float b = 0.01;
    float c = 0.001;

    float atenuacao = 1.0 / (
      a + b * distanciaLuz + c * distanciaLuz * distanciaLuz
    );

    // Luz ambiente
    vec3 resultado = 0.3 * uCorLuz * corAmbiente;

    // Luz distante - difusa
    resultado += 0.2 * uCorLuz * lightd * corDifusa;

    // Luz pontual - difusa
    resultado += 0.8 * uCorLuz * lightp * corDifusa * atenuacao;

    // Luz especular
    if (lightp > 0.0) {
      resultado += 0.15 * uCorLuz
        * corEspecular
        * pow(lighte, max(uBrilho, 1.0))
        * atenuacao;
    }
    // Cor emissiva
    vec3 emissao = uCorEmissiva;

    if (uUsarMapaEmissivo) {
        emissao += texture(uMapaEmissivo, vTextura).rgb;
    }

    resultado += emissao;

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
    SHADER_FRAGMENTO
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

function rotacaoY(angulo, escala = 1) {
  const c = Math.cos(angulo) * escala;
  const s = Math.sin(angulo) * escala;

  return new Float32Array([
    c, 0, -s, 0,
    0, escala, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

function esferaModelo(posicoes) {
  const minimo = [Infinity, Infinity, Infinity];
  const maximo = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < posicoes.length; i += 3) {
    for (let eixo = 0; eixo < 3; eixo++) {
      const coordenada = posicoes[i + eixo];
      minimo[eixo] = Math.min(minimo[eixo], coordenada);
      maximo[eixo] = Math.max(maximo[eixo], coordenada);
    }
  }

  return {
    centro: minimo.map((valor, eixo) => (valor + maximo[eixo]) / 2),
    raio: Math.hypot(...maximo.map((valor, eixo) => valor - minimo[eixo])) / 2
  };
}

function planosCamera(matriz) {
  return [0, 1, 2].flatMap(eixo => [-1, 1].map(sinal => {
    const x = matriz[3] + sinal * matriz[eixo];
    const y = matriz[7] + sinal * matriz[4 + eixo];
    const z = matriz[11] + sinal * matriz[8 + eixo];
    const d = matriz[15] + sinal * matriz[12 + eixo];
    const comprimento = Math.hypot(x, y, z);
    return [x / comprimento, y / comprimento, z / comprimento, d / comprimento];
  }));
}

function verticesCubo() {
  const pontos = [
    [-0.4, -0.4, -0.4], [0.4, -0.4, -0.4],
    [0.4, 0.4, -0.4], [-0.4, 0.4, -0.4],
    [-0.4, -0.4, 0.4], [0.4, -0.4, 0.4],
    [0.4, 0.4, 0.4], [-0.4, 0.4, 0.4],
  ];

  const faces = [
    [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
    [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
  ];

  return new Float32Array(
    faces.flatMap(([a, b, c, d]) => [
      ...pontos[a], ...pontos[b], ...pontos[c],
      ...pontos[a], ...pontos[c], ...pontos[d],
    ])
  );
}

// Mantemos uma única malha-base, reutilizada por todos os móveis.
function modeloCaixa(x, y, z, largura, altura, profundidade) {
  return new Float32Array([
    largura / 0.8, 0, 0, 0,
    0, altura / 0.8, 0, 0,
    0, 0, profundidade / 0.8, 0,
    x, y, z, 1,
  ]);
}

function escalaUniforme(s) {
  return new Float32Array([
    s, 0, 0, 0,
    0, s, 0, 0,
    0, 0, s, 0,
    0, 0, 0, 1,
  ]);
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
    "uPosicaoCamera"
  );
  const uniformeCorAmbiente = gl.getUniformLocation(programa, "uCorAmbiente");
  const uniformeCorEspecular = gl.getUniformLocation(programa, "uCorEspecular");
  const uniformeCorEmissiva = gl.getUniformLocation(programa, "uCorEmissiva");
  const uniformeBrilho = gl.getUniformLocation(programa, "uBrilho");
  const uniformeMapaEspecular = gl.getUniformLocation(programa, "uMapaEspecular");
  const uniformeUsarMapaEspecular = gl.getUniformLocation(programa, "uUsarMapaEspecular");
  const uniformeEscalaUV = gl.getUniformLocation(programa, "uEscalaUV");
  const uniformeDeslocamentoUV = gl.getUniformLocation(programa, "uDeslocamentoUV");
  const uniformeMapaEmissivo = gl.getUniformLocation(programa, "uMapaEmissivo");
  const uniformeUsarMapaEmissivo = gl.getUniformLocation(programa, "uUsarMapaEmissivo");
  const cubo = new Mesh(gl, verticesCubo(), null, null);

  const malhasOBJ = {};

  for (const [nome, modelo] of Object.entries(modelos)) {
    malhasOBJ[nome] = modelo.malhas.map((malha) => ({
      nomeObjeto: malha.nomeObjeto,
      malha: new Mesh(gl, malha.posicoes, malha.texturas, malha.normais),
      material: modelo.materiais?.[malha.material] || null,
    }));
  }

  // carrega as texturas associadas manualmente aos .objs
  const texturasOBJ = {};

  for (const [modelo, caminho] of Object.entries(caminhosTexturas)) {
    if (malhasOBJ[modelo]) texturasOBJ[modelo] = carregarTextura(gl, caminho);
  }

  const esferas = new Map(
    Object.entries(modelos)
      .filter(([nome]) => nome !== 'nc2a.obj')
      .map(([nome, modelo]) => [nome, esferaModelo(modelo.posicoes)])
  );

  const objetos = obterObjetosMapa()
    .filter(objeto => !objeto.item && malhasOBJ[objeto.modelo])
    .map(objeto => {
      const matrizModelo = multiplicar(
        translacao(objeto.x, objeto.y, objeto.z),
        rotacaoY(objeto.rotacaoY ?? 0, objeto.escala ?? 1)
      );

      const esfera = esferas.get(objeto.modelo);
      if (!esfera) return { ...objeto, matrizModelo };

      const [x, y, z] = esfera.centro;
      return {
        ...objeto,
        matrizModelo,
        centro: [
          matrizModelo[0] * x + matrizModelo[8] * z + objeto.x,
          matrizModelo[5] * y + objeto.y,
          matrizModelo[2] * x + matrizModelo[10] * z + objeto.z
        ],
        raio: esfera.raio * (objeto.escala ?? 1)
      };
    });

  gl.useProgram(programa);
  gl.enable(gl.DEPTH_TEST);

  // configuracoes da iluminação
  gl.uniform3fv(uniformePosicaoLuz, [30.0, 3.0, 8.0]); // posição da luz pontual
  gl.uniform3fv(uniformeCorLuz, [1.0, 1.0, 1.0]); // cor da luz
  gl.uniform3fv(uniformeDirecaoLuz, [0.0, -1.0, 0.0]); // direção da luz direcional

  function desenharMalha(
    malha,
    matrizFinal,
    matrizModelo,
    cor,
    textura,
    material = null,
    transformacaoUV = null,
    corAmbiente = material?.ambient ?? cor,
  ) {
    gl.uniform2fv(
      uniformeEscalaUV,
      transformacaoUV?.escala ?? [1, 1]
    );

    gl.uniform2fv(
      uniformeDeslocamentoUV,
      transformacaoUV?.deslocamento ?? [0, 0]
    );

    gl.uniformMatrix4fv(uniformeMatriz, false, matrizFinal);
    gl.uniformMatrix4fv(uniformeModelo, false, matrizModelo);
    gl.uniform3fv(uniformeCor, cor);

    gl.uniform3fv(uniformeCorAmbiente, corAmbiente);
    gl.uniform3fv(uniformeCorEspecular, material?.specular ?? [1, 1, 1]);
    gl.uniform3fv(uniformeCorEmissiva, material?.emissive ?? [0, 0, 0]);
    gl.uniform1f(uniformeBrilho, material?.shininess ?? 400);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textura ?? null);
    gl.uniform1i(uniformeTextura, 0);

    const usarTextura = textura != null && malha.texCoordBuffer != null;
    gl.uniform1i(uniformeUsarTextura, usarTextura);

    const mapaEspecular = material?.specularMap ?? null;

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mapaEspecular);
    gl.uniform1i(uniformeMapaEspecular, 1);

    gl.uniform1i(
      uniformeUsarMapaEspecular,
      mapaEspecular != null && malha.texCoordBuffer != null
    );

    const mapaEmissivo = material?.emissiveMap ?? null;

    gl.activeTexture(gl.TEXTURE2);

    gl.bindTexture(
      gl.TEXTURE_2D,
      mapaEmissivo
    );

    gl.uniform1i(uniformeMapaEmissivo, 2);

    gl.uniform1i(
      uniformeUsarMapaEmissivo,
      mapaEmissivo != null &&
      malha.texCoordBuffer != null
    );

    malha.desenhar(localAtributos);
  }

  function carregarTextura(gl, caminhoTextura, repetir = false) {
    const textura = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, textura);

    const usarRepeticao = repetir ||
      String(caminhoTextura).includes("radio_textura.jpg");

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      usarRepeticao ? gl.REPEAT : gl.CLAMP_TO_EDGE
    );

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      usarRepeticao ? gl.REPEAT : gl.CLAMP_TO_EDGE
    );

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
        imagem
      );
    };

    imagem.src = caminhoTextura;

    return textura;
  }

  function carregarTexturasMateriais(gl, modelo) {
    const caminhoMTL = modelo.caminhosMTL?.[0];

    if (!caminhoMTL) return;

    const cacheTexturas = new Map();

    const propriedades = [
      ['diffuseMap', 'uvTransform'],
      ['specularMap', 'specularUVTransform'],
      ['emissiveMap', 'emissiveUVTransform'],
      ['normalMap', 'normalUVTransform']
    ];

    for (const material of Object.values(modelo.materiais ?? {})) {
      for (const [propriedade, campoUV] of propriedades) {
        const arquivo = material[propriedade];

        if (!arquivo) continue;

        const repetir = material[campoUV] != null;

        const caminhoTextura = new URL(
          `../texturas/${arquivo}`,
          caminhoMTL
        );

        const chave = `${caminhoTextura.href}:${repetir}`;

        if (!cacheTexturas.has(chave)) {
          const textura = carregarTextura(
            gl,
            caminhoTextura.href,
            repetir
          );

          cacheTexturas.set(chave, textura);
        }

        material[propriedade] = cacheTexturas.get(chave);
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
  const angulosPortas = new Map();
  let ultimoQuadroPortas = performance.now();

  return {
    definirMatrizesOssos(id, matrizes) {
      matrizesOssosPorJogador.set(String(id), matrizes);
    },

    removerMatrizesOssos(id) {
      matrizesOssosPorJogador.delete(String(id));
    },

    desenhar(jogadores, meuId, orientacao, itens = [], portas = []) {
      const escalaTela = Math.min(window.devicePixelRatio || 1, 2);
      const largura = Math.floor(canvas.clientWidth * escalaTela);
      const altura = Math.floor(canvas.clientHeight * escalaTela);

      const agoraPortas = performance.now();

      const deltaPortas = Math.min(
        (agoraPortas - ultimoQuadroPortas) / 1000,
        0.05
      );

      ultimoQuadroPortas = agoraPortas;

      const portasPorNome = new Map(
        portas.map(porta => [porta.nome, porta])
      );

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
        100
      );

      const meuJogador = jogadores.find(
        (jogador) => String(jogador.id) === String(meuId)
      );

      const olho = meuJogador
        ? [
          meuJogador.x,
          (meuJogador.y ?? 0) + ALTURA_CAMERA,
          meuJogador.z
        ]
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

      const planos = planosCamera(camera);

      for (const objeto of objetos) {
        // Evita enviar malhas de mobília fora do campo de visão à GPU.
        if (objeto.centro) {
          const [x, y, z] = objeto.centro;
          if (planos.some(([a, b, c, d]) => a * x + b * y + c * z + d < -objeto.raio)) {
            continue;
          }
        }

        const partes = malhasOBJ[objeto.modelo];
        const matrizModelo = objeto.matrizModelo;
        const matrizFinal = multiplicar(camera, matrizModelo);

        const textura = texturasOBJ[objeto.modelo] ?? null;

        const cor = textura ? [1.0, 1.0, 1.0] : (objeto.cor ?? [0.7, 0.7, 0.7]);

        for (const parte of partes) {
          const material = parte.material;

          const texturaMaterial = material?.diffuseMap || textura;
          const corEstofado = material?.nome.startsWith('tecido_') ? objeto.corEstofado : null;
          const corMaterial = corEstofado ?? material?.diffuse ?? cor;

          let matrizModeloParte = matrizModelo;

          // Portas são partes individuais do nc2a.obj.
          const porta = objeto.modelo === 'nc2a.obj'
            ? portasPorNome.get(parte.nomeObjeto)
            : null;

          if (porta) {
            const anguloAtual =
              angulosPortas.get(porta.nome) ?? 0;

            const anguloAlvo = porta.aberta
              ? porta.sentido * Math.PI / 2
              : 0;

            // Animação gradual, aproximadamente 0,5 segundo.
            const diferenca = anguloAlvo - anguloAtual;
            const passoMaximo = Math.PI * deltaPortas;

            const novoAngulo = anguloAtual +
              Math.sign(diferenca) *
              Math.min(Math.abs(diferenca), passoMaximo);

            angulosPortas.set(porta.nome, novoAngulo);

            // Translada até a dobradiça, gira e retorna.
            const matrizPorta = multiplicar(
              translacao(porta.pivoX, 0, porta.pivoZ),
              multiplicar(
                rotacaoY(novoAngulo),
                translacao(-porta.pivoX, 0, -porta.pivoZ)
              )
            );

            matrizModeloParte = multiplicar(
              matrizModelo,
              matrizPorta
            );
          }

          const matrizFinalParte = porta
            ? multiplicar(camera, matrizModeloParte)
            : matrizFinal;

          const transformacaoUV =
            material?.uvTransform ??
            (
              objeto.modelo === 'radio.obj' ||
                objeto.modelo === 'computador2.obj'
                ? UV_RADIO
                : null
            );

          desenharMalha(
            parte.malha,
            matrizFinalParte,
            matrizModeloParte,
            corMaterial,
            texturaMaterial,
            material,
            transformacaoUV,
            corEstofado ?? material?.ambient ?? corMaterial
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
            jogador.z
          );

          // subtrai de 180º o angulo e ajusta renderização frontal do personagem
          const rotacao = rotacaoY(Math.PI - angulo);

          const matrizModelo = multiplicar(
            posicao,
            multiplicar(rotacao, escalaUniforme(escala))
          );

          const matrizMVP = multiplicar(camera, matrizModelo);

          desenhadorPersonagem.desenhar(
            matrizMVP,
            matrizModelo,
            matrizesJogador
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
            null
          );
        }
      }

      for (const item of itens) {
        if (!item.visivel) continue;

        if (item.ehBloco) {
          const escala = (item.tamanho ?? 0.8) / 0.8;
          const matrizModelo = multiplicar(
            translacao(item.x, item.y, item.z),
            escalaUniforme(escala)
          );
          const matrizFinal = multiplicar(camera, matrizModelo);

          desenharMalha(
            cubo,
            matrizFinal,
            matrizModelo,
            item.cor ?? [0.9, 0.2, 0.2],
            null
          );
        } else if (item.modelo && malhasOBJ[item.modelo]) {
          const matrizModelo = translacao(item.x, item.y, item.z);
          const matrizFinal = multiplicar(camera, matrizModelo);
          const textura = texturasOBJ[item.modelo] ?? null;

          for (const parte of malhasOBJ[item.modelo]) {
            const material = parte.material;
            desenharMalha(
              parte.malha,
              matrizFinal,
              matrizModelo,
              material?.diffuse || (textura ? [1, 1, 1] : (item.cor ?? [0.7, 0.7, 0.7])),
              material?.diffuseMap || textura,
              material
            );
          }
        }
      }
    },
  };
}