import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { Jogo, CONFIGURACAO } from './jogo.js';

const PORTA = Number(process.env.PORT || 3000);
const jogo = new Jogo();

// Só estes caminhos podem ser servidos por HTTP.
const ARQUIVOS_PUBLICOS = new Map([
  ['/', ['../cliente/index.html', 'text/html; charset=utf-8']],
  ['/estilos.css', ['../cliente/estilos.css', 'text/css; charset=utf-8']],
  ['/principal.js', ['../cliente/principal.js', 'text/javascript; charset=utf-8']],
  ['/teclado.js', ['../cliente/teclado.js', 'text/javascript; charset=utf-8']],
  ['/rede.js', ['../cliente/rede.js', 'text/javascript; charset=utf-8']],
  ['/renderizador.js', ['../cliente/renderizador.js', 'text/javascript; charset=utf-8']],
  ['/mapa.js', ['../compartilhado/mapa.js', 'text/javascript; charset=utf-8']],
]);

const servidorHttp = createServer((requisicao, resposta) => {
  const caminho = new URL(requisicao.url, 'http://localhost').pathname;
  const arquivo = requisicao.method === 'GET' ? ARQUIVOS_PUBLICOS.get(caminho) : null;
  if (!arquivo) {
    resposta.writeHead(404).end('Não encontrado');
    return;
  }

  const [caminhoRelativo, tipoConteudo] = arquivo;
  readFile(fileURLToPath(new URL(caminhoRelativo, import.meta.url)),
    (erro, conteudo) => {
      if (erro) {
        resposta.writeHead(500).end('Erro ao carregar arquivo');
        return;
      }
      resposta.writeHead(200, { 'Content-Type': tipoConteudo });
      resposta.end(conteudo);
    });
});

const servidorWebSocket = new WebSocketServer({
  server: servidorHttp,
  path: '/ws',
  maxPayload: 256,
});

function transmitirEstado() {
  const dados = JSON.stringify(jogo.criarEstado());
  for (const jogador of jogo.jogadores.values()) {
    if (jogador.conexao.readyState === WebSocket.OPEN) {
      jogador.conexao.send(dados);
    }
  }
}

servidorWebSocket.on('connection', conexao => {
  const jogador = jogo.adicionarJogador(conexao);
  if (!jogador) {
    conexao.close(1013, 'Sala cheia');
    return;
  }

  console.log(`Jogador ${jogador.id} conectado (cubo ${jogador.cubo + 1})`);
  conexao.send(JSON.stringify({ tipo: 'boas-vindas', id: jogador.id }));
  transmitirEstado();

  conexao.on('message', dadosRecebidos => {
    try {
      jogo.receberEntrada(jogador.id, JSON.parse(dadosRecebidos.toString()));
    } catch {
      // Um pacote inválido não deve derrubar o servidor.
    }
  });

  conexao.on('close', () => {
    jogo.removerJogador(jogador.id);
    console.log(`Jogador ${jogador.id} desconectado`);
    transmitirEstado();
  });

  conexao.on('error', erro => {
    console.error(`WebSocket ${jogador.id}: ${erro.message}`);
  });
});

let instanteAnterior = performance.now();
setInterval(() => {
  const agora = performance.now();
  jogo.atualizar((agora - instanteAnterior) / 1000);
  instanteAnterior = agora;

  const passosPorTransmissao = CONFIGURACAO.atualizacoesPorSegundo /
    CONFIGURACAO.estadosPorSegundo;
  if (jogo.passo % passosPorTransmissao === 0) transmitirEstado();
}, 1000 / CONFIGURACAO.atualizacoesPorSegundo);

servidorHttp.listen(PORTA, () => {
  console.log(`Abra http://localhost:${PORTA} em duas abas`);
});