import { obterObjetosMapa } from './mapa.js';
import { lerTeclas } from "./teclado.js";
import { enviarTeclas, obterSessao } from "./rede.js";
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
  // A cada 50 ms: envia teclas. O servidor decide para onde cada cubo vai.
  setInterval(() => {
    const { anguloHorizontal } = obterOrientacao();
    enviarTeclas(lerTeclas(), anguloHorizontal);
  }, 50);

  // O navegador desenha na taxa do monitor: não é ele que calcula a física.
  function desenharQuadro() {
    const { meuId, estado, situacao } = obterSessao();

    const minhasMissoes = (estado.tasks ?? [])
    .filter(task => task.jogadorId === meuId)
    .map(task => ({
        nome: task.nome ?? task.id,
        concluida: task.concluida ?? false
    }));

    hud.atualizarMissoes(minhasMissoes);
    renderizador.desenhar(estado.jogadores, meuId, obterOrientacao());
    requestAnimationFrame(desenharQuadro);
  }
  requestAnimationFrame(desenharQuadro);
}

iniciarJogo();