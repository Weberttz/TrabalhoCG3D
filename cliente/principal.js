import { lerTeclas } from './teclado.js';
import { enviarTeclas, obterSessao } from './rede.js';
import { criarRenderizador } from './renderizador.js';
import { iniciarMouse, obterOrientacao} from './mouse.js';

const renderizador = criarRenderizador(document.getElementById('jogo'));
iniciarMouse(document.getElementById('jogo'));
const textoSituacao = document.getElementById('situacao');
const textoIdentidade = document.getElementById('identidade');
const textoQuantidade = document.getElementById('quantidade');

// A cada 50 ms: envia teclas. O servidor decide para onde cada cubo vai.
setInterval(() => {
  const { anguloHorizontal } = obterOrientacao();
  enviarTeclas(lerTeclas(), anguloHorizontal);
}, 50);

// O navegador desenha na taxa do monitor: não é ele que calcula a física.
function desenharQuadro() {
  const { meuId, estado, situacao } = obterSessao();
  textoSituacao.textContent = situacao;
  textoIdentidade.textContent = meuId === null ? 'Sem cubo' : `Seu ID: ${meuId}`;
  textoQuantidade.textContent = `${estado.jogadores.length}/2 jogadores`;
  renderizador.desenhar(estado.jogadores,meuId, obterOrientacao());
  requestAnimationFrame(desenharQuadro);
}
requestAnimationFrame(desenharQuadro);