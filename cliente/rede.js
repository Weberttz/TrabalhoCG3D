// Conexão do cliente com o servidor
const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
const conexao = new WebSocket(`${protocolo}://${location.host}/ws`);

let meuId = null;
let estado = { tipo: 'estado', passo: 0, jogadores: [] };
let situacao = 'Conectando...';
let sequencia = 0;

// Se o listener escutar a string, ele muda a situação, que muda no html
conexao.addEventListener('open', () => { situacao = 'Conectado'; });

conexao.addEventListener('close', evento => {
  situacao = evento.reason === 'Sala cheia'
    ? 'Sala cheia (máximo de 2)' : 'Desconectado';
  meuId = null;
  estado = { tipo: 'estado', passo: 0, jogadores: [] };
});

conexao.addEventListener('error', () => {
  situacao = 'Erro de conexão';
});

conexao.addEventListener('message', evento => {
  try {
    const mensagem = JSON.parse(evento.data);
    if (mensagem.tipo === 'boas-vindas') meuId = mensagem.id;
    if (mensagem.tipo === 'estado') estado = mensagem;
  } catch {
    situacao = 'Mensagem inválida do servidor';
  }
});

export function enviarTeclas(teclas) {
  if (conexao.readyState !== WebSocket.OPEN || meuId === null) return;
  conexao.send(JSON.stringify({ tipo: 'entrada', sequencia: sequencia++, teclas }));
}

export function obterSessao() {
  return { meuId, estado, situacao };
}