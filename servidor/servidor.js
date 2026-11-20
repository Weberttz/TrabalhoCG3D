import path from 'node:path';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { Jogo, CONFIGURACAO } from './jogo.js';

const PORTA = Number(process.env.PORT || 3000);
const jogo = new Jogo();
await jogo.inicializar();

const DIRETORIO_ATUAL = path.dirname(
  fileURLToPath(import.meta.url)
);

const DIRETORIOS_PUBLICOS = {
  '/cliente': path.resolve(DIRETORIO_ATUAL, '../cliente'),
  '/compartilhado': path.resolve(DIRETORIO_ATUAL, '../compartilhado')
};

const DIRETORIOS_REAIS = await Promise.all(
  Object.values(DIRETORIOS_PUBLICOS).map(
    diretorio => realpath(diretorio)
  )
);

const TIPOS_ARQUIVOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.glsl': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8'
};

// O servidor consegue localizar os arquivos compartilhados e de cliente
function localizarArquivo(url) {
  const caminhoURL = decodeURIComponent(
    new URL(url, 'http://localhost').pathname
  );

  if (caminhoURL === '/') {
    return path.join(DIRETORIOS_PUBLICOS['/cliente'], 'index.html');
  }

  // Arquivos compartilhados mantêm suas URLs antigas
  const compartilhados = [
    'mapa.js',
    'constantesTasks.js',
    'estruturaPredio.js'
  ];

  if (compartilhados.includes(caminhoURL.slice(1))) {
    return path.join(
      DIRETORIOS_PUBLICOS['/compartilhado'],
      caminhoURL.slice(1)
    );
  }

  // Todo o restante é procurado na pasta cliente
  const relativo = caminhoURL.replace(/^\/+/, '');
  const partes = relativo.split('/');

  if (partes.includes('..') || partes.includes('.')) {
    return null;
  }

  const diretorio = DIRETORIOS_PUBLICOS['/cliente'];
  const arquivo = path.resolve(diretorio, relativo);

  if (!arquivo.startsWith(diretorio + path.sep)) {
    return null;
  }

  return arquivo;
}
// O sevidor busca os arquivos, verifica permissão e retorna as respostas
async function servirArquivo(requisicao, resposta) {
  if (!['GET', 'HEAD'].includes(requisicao.method)) {
    resposta.writeHead(405, { Allow: 'GET, HEAD' });
    return resposta.end();
  }

  let arquivo;

  try {
    arquivo = localizarArquivo(requisicao.url);
  } catch {
    resposta.writeHead(400);
    return resposta.end('URL inválida');
  }

  if (!arquivo) {
    resposta.writeHead(404);
    return resposta.end('Arquivo não encontrado');
  }

  const extensao = path.extname(arquivo).toLowerCase();
  const tipo = TIPOS_ARQUIVOS[extensao];

  if (!tipo) {
    resposta.writeHead(403);
    return resposta.end('Tipo não permitido');
  }

  try {
    // Verifica também links simbólicos.
    const arquivoReal = await realpath(arquivo);

    const diretorioPermitido = DIRETORIOS_REAIS.some(
      diretorio =>
        arquivoReal.startsWith(diretorio + path.sep)
    );

    if (!diretorioPermitido) {
      resposta.writeHead(403);
      return resposta.end('Acesso negado');
    }

    const informacoes = await stat(arquivoReal);

    if (!informacoes.isFile()) {
      resposta.writeHead(404);
      return resposta.end();
    }

    resposta.writeHead(200, {
      'Content-Type': tipo,
      'Content-Length': informacoes.size,
      'X-Content-Type-Options': 'nosniff'
    });

    if (requisicao.method === 'HEAD') {
      return resposta.end();
    }

    createReadStream(arquivoReal).pipe(resposta);

  } catch {
    if (!resposta.headersSent) {
      resposta.writeHead(404);
      resposta.end('Arquivo não encontrado');
    } else {
      resposta.destroy();
    }
  }
}

const servidorHttp = createServer(servirArquivo);

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
      const mensagem = JSON.parse(dadosRecebidos.toString());

      if (mensagem?.tipo === 'entrada') {
        jogo.receberEntrada(jogador.id, mensagem);
      } else if (mensagem?.tipo === 'acao_task') {
        jogo.receberAcaoTask(jogador.id, mensagem);
      }
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