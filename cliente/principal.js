import { obterObjetosMapa, obterObjetoInterativoProximo } from './mapa.js';
import { lerTeclas, configurarInteracao } from "./teclado.js";
import { enviarTeclas, enviarInteracao, obterSessao } from "./rede.js";
import { criarRenderizador } from "./renderizador.js";
import { iniciarMouse, obterOrientacao } from "./mouse.js";
import { leitorOBJ } from "./leitorOBJ.js";
import { criarHUD } from './hud.js';

//carrega os modelos obj antes de iniciar a renderizacao
async function carregarModelos() {
    const modelos = {};

    // Obtém os nomes dos modelos, sem duplicatas.
    const nomesModelos = [
        ...new Set(
            obterObjetosMapa()
                .map(objeto => objeto.modelo)
                .filter(Boolean)
        )
    ];

    // Carrega os modelos em paralelo.
    await Promise.all(
        nomesModelos.map(async nome => {
            try {
                modelos[nome] = await leitorOBJ.carregarArquivo(
                    `./modelosOBJ/${nome}`
                );

                console.log(`[Renderer] Modelo carregado: ${nome}`);
            } catch (erro) {
                console.error(
                    `[Renderer] Erro ao carregar ${nome}:`,
                    erro
                );
            }
        })
    );

    return modelos;
}

async function iniciarJogo() {
  const hud = criarHUD();
  const modelos = await carregarModelos();
  const renderizador = criarRenderizador(
    document.getElementById("jogo"),
    modelos,
  );
  iniciarMouse(document.getElementById("jogo"));
  configurarInteracao(() => {
    enviarInteracao();
  });

  const objetosInterativos = obterObjetosMapa()
    .filter(objeto => objeto.interativo);

  // A cada 50 ms: envia teclas. O servidor decide para onde cada cubo vai.
  setInterval(() => {
    const { anguloHorizontal } = obterOrientacao();
    enviarTeclas(lerTeclas(), anguloHorizontal);
  }, 50);

  // O navegador desenha na taxa do monitor: não é ele que calcula a física.
  function desenharQuadro() {
    const { meuId, estado, situacao } = obterSessao();
    const { anguloHorizontal } = obterOrientacao();

    const direcaoOlhar = {
        x: Math.sin(anguloHorizontal),
        z: -Math.cos(anguloHorizontal)
    };

    // Encontra o jogador local.
    const meuJogador = estado.jogadores.find(
        jogador => jogador.id === meuId
    );

    // Verifica proximidade.
    const objetoProximo = obterObjetoInterativoProximo(
        meuJogador,
        objetosInterativos,
        direcaoOlhar,
        2,
        35
    );

    const minhasMissoes = (estado.tasks ?? [])
    .filter(task => task.jogadorId === meuId)
    .map(task => ({
        nome: task.nome ?? task.id,
        concluida: task.status === 'concluida'
    }));
    
    hud.atualizarInteracao(objetoProximo);
    hud.atualizarMissoes(minhasMissoes);
    renderizador.desenhar(estado.jogadores, meuId, obterOrientacao());
    requestAnimationFrame(desenharQuadro);
  }
  requestAnimationFrame(desenharQuadro);
}

iniciarJogo();