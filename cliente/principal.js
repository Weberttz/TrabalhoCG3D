import { obterObjetosMapa, obterObjetoInterativoProximo } from "./mapa.js";
import { lerTeclas, configurarInteracao, configurarDrop } from "./teclado.js";
import { enviarTeclas, enviarInteracao, obterSessao, enviarTrocaRadio, enviarDrop } from "./rede.js";
import { criarRenderizador } from './renderizador.js';
import { iniciarMouse, obterOrientacao } from './mouse.js';
import { leitorOBJ } from './leitorOBJ.js';
import { carregarGLB } from './leitorGLB.js';
import { criarHUD } from './hud.js';
import { criarAnimadorGLB } from './animador.js';
import { criarRadio } from './radio.js';
import { leitorMTL } from "./leitorMTL.js";

// Carregamento dos modelos obj 

async function carregarModelos() {
  const nomesModelos = [
    "sala001.obj",
    "mesa.obj",
    "lixeira.obj",
    "cadeira.obj",
    "radio.obj",
    "personagem.obj",
    "office-desk.obj",
    "office-chair.obj",
    "ceiling-lamp.obj", 
    "computador2.obj",
    "nc2a.obj"
  ];

  const modelos = {};

  for (const nome of nomesModelos) {
    const modelo = await leitorOBJ.carregarArquivo(`./modelosOBJ/${nome}`);

    const resultadoMTL = await leitorMTL.carregarMateriais(modelo);
    modelo.materiais = resultadoMTL.materiais;
    modelo.caminhosMTL = resultadoMTL.caminhosMTL;

    modelos[nome] = modelo;
  }

  return modelos;
}

// Missões

function obterNomeMissao(task) {
  const nomes = {
    task_lixo_sala002: "Recolher o lixo da Sala 002",
    task_energia_1: "Restaurar a energia",
  };

  return (
    nomes[task.id] ??
    (task.nome && task.nome !== task.id
      ? task.nome
      : String(task.id)
        .replace(/^task_/, "")
        .replaceAll("_", " "))
  );
}

// Animações

function escolherAnimacao(teclas = {}) {
  const frente = Number(!!teclas.w) - Number(!!teclas.s);

  const lateral = Number(!!teclas.d) - Number(!!teclas.a);

  if (frente > 0) return "Walking";
  if (frente < 0) return "WalkingBackwards";

  if (lateral < 0) return "StrafeLeft";
  if (lateral > 0) return "StrafeRight";

  return "Idle";
}

// Inicialização

async function iniciarJogo() {
  const estadoAnteriorMissoes = new Map();
  let idsMissoesAnteriores = new Set();

  const hud = criarHUD();

  // Carrega modelos estáticos.
  const modelos = await carregarModelos();

  // Carrega personagem animado.
  const personagemGLB = await carregarGLB(
    "./modelosGLB/personagem_textura.glb",
  );

  console.log(
    "Animações disponíveis:",
    personagemGLB.animacoes.map((animacao) => animacao.name),
  );

  // Um animador por jogador remoto.
  const animadores = new Map();

  const canvas = document.getElementById("jogo");

  const renderizador = criarRenderizador(canvas, modelos, personagemGLB);

  // Inicializa os controles apenas uma vez.
  const radio = criarRadio(
    '/audios/Reflections.mp3',
    '/audios/DoIWannaKnow.mp3',
    '/audios/DarkRed.mp3',
  );

  let objetoInterativoAtual = null;

  iniciarMouse(canvas);

  // O clique no jogo libera a reprodução de áudio
  // mesmo quando outro jogador ligou o rádio.
  canvas.addEventListener('click', () => {
    radio.habilitarAudio();
  });

  // E continua sendo a tecla de interação geral.
  configurarInteracao(() => {
    radio.habilitarAudio();

    // O servidor decide qual objeto foi acionado.
    enviarInteracao();

    configurarDrop(() => {
      enviarDrop();
    });
  });

  // T solicita a próxima música ao servidor.
  window.addEventListener('keydown', evento => {
    if (
      evento.code !== 'KeyT' ||
      evento.repeat
    ) {
      return;
    }

    if (evento.target?.closest?.(
      'input, textarea, select, [contenteditable="true"]'
    )) {
      return;
    }

    if (
      objetoInterativoAtual?.nome !== 'radio01' ||
      !radio.estaLigado()
    ) {
      return;
    }

    evento.preventDefault();

    radio.habilitarAudio();
    enviarTrocaRadio();
  });

  const objetosInterativos = obterObjetosMapa()
    .filter(objeto => objeto.interativo);

  // Envio de teclas para o servidor
  setInterval(() => {
    const { anguloHorizontal } = obterOrientacao();

    enviarTeclas(lerTeclas(), anguloHorizontal);
  }, 50);

  // Loop de renderização

  let tempoAnterior = null;

  function desenharQuadro(tempoAtual) {
    try {
      const { meuId, estado } = obterSessao();

      // Atualiza a reprodução local conforme o estado global.
      radio.sincronizar(estado?.radio);

      const jogadores = estado?.jogadores ?? [];

      const { anguloHorizontal } = obterOrientacao();

      const deltaSegundos =
        tempoAnterior === null
          ? 0
          : Math.min(Math.max((tempoAtual - tempoAnterior) / 1000, 0), 0.05);

      tempoAnterior = tempoAtual;

      // Missões do jogador

      const minhasMissoes = (estado?.tasks ?? [])
        .filter((task) => String(task.jogadorId) === String(meuId))
        .map((task) => ({
          id: task.id,
          nome: obterNomeMissao(task),
          concluida: task.concluida === true || task.status === "concluida",
        }));

      // Alerta de missões

      const novasMissoes = minhasMissoes.filter(
        (missao) =>
          !missao.concluida && !idsMissoesAnteriores.has(String(missao.id)),
      );

      if (novasMissoes.length > 0) {
        hud.mostrarRecebimentoMissoes(novasMissoes.length);
      }

      // Guarda as missões conhecidas.
      idsMissoesAnteriores = new Set(
        minhasMissoes.map((missao) => String(missao.id)),
      );

      // Conclusão de missões

      for (const missao of minhasMissoes) {
        const id = String(missao.id);

        const anterior = estadoAnteriorMissoes.get(id);

        if (
          anterior === false &&
          missao.concluida
        ) {
          hud.mostrarConclusaoMissao(missao.nome);
        }

        estadoAnteriorMissoes.set(
          id,
          missao.concluida
        );
      }

      // Atualiza a lista de missões do HUD.
      hud.atualizarMissoes(minhasMissoes);

      // Interação com os objetos
      // Interação com os objetos
      const direcaoOlhar = {
        x: Math.sin(anguloHorizontal),
        z: -Math.cos(anguloHorizontal)
      };

      const meuJogador = jogadores.find(
        jogador =>
          String(jogador.id) === String(meuId)
      );

      const itensServidor = (estado?.itens ?? []).map(item => ({
        ...item,
        item: true,
        interativo: item.visivel && item.podePegar,
      }));

      const objetoProximo = meuJogador
        ? obterObjetoInterativoProximo(
          meuJogador,
          [...objetosInterativos, ...itensServidor],
          direcaoOlhar,
          2,
          35
        )
        : null;

      hud.atualizarInteracao(objetoProximo, radio.estaLigado());
      objetoInterativoAtual = objetoProximo;

      // Animações do jogador

      const idsAtivos = new Set();

      for (const jogador of jogadores) {
        // Não desenha o jogador local.
        if (
          String(jogador.id) === String(meuId)
        ) {
          continue;
        }

        const id = String(jogador.id);

        idsAtivos.add(id);

        let animador = animadores.get(id);

        // Cria o animador uma única vez.
        if (!animador) {
          animador = criarAnimadorGLB(
            personagemGLB
          );

          animador.tocar('Idle');

          animadores.set(id, animador);
        }

        // Seleciona a animação.
        const proximaAnimacao =
          escolherAnimacao(jogador.teclas);

        // Troca somente quando necessário.
        if (
          animador.obterAnimacaoAtual() !==
          proximaAnimacao
        ) {
          console.log(
            `[ANIMAÇÃO] Jogador ${id}:`,
            animador.obterAnimacaoAtual(),
            '→',
            proximaAnimacao
          );

          animador.tocar(proximaAnimacao);
        }

        // Avança os keyframes.
        animador.atualizar(deltaSegundos);

        // Envia as matrizes exclusivas do jogador.
        renderizador.definirMatrizesOssos(
          id,
          animador.obterMatrizesOssos()
        );
      }

      // Limpeza de animadores

      for (const id of animadores.keys()) {
        if (!idsAtivos.has(id)) {
          animadores.delete(id);

          renderizador.removerMatrizesOssos(
            id
          );
        }
      }

      // Renderização

      renderizador.desenhar(
        jogadores,
        meuId,
        obterOrientacao(),
        estado?.itens ?? []
      );

    } catch (erro) {
      console.error(
        'Erro no loop do jogo:',
        erro
      );

    } finally {
      // Sempre agenda o próximo quadro.
      requestAnimationFrame(desenharQuadro);
    }

    //estadoAnteriorMissoes.set(id, missao.concluida);
  }
  // Inicia o loop uma única vez.
  requestAnimationFrame(desenharQuadro);
}

iniciarJogo().catch((erro) => {
  console.error("Erro ao iniciar o jogo:", erro);
});
