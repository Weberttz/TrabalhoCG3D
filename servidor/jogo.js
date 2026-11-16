import { COLISORES_QUARTO } from '../compartilhado/mapa.js';
import { TaskProximidade } from './tasks/TaskProximidade.js';
// O servidor é a fonte de verdade das posições e das colisões.
export const CONFIGURACAO = Object.freeze({
  maximoJogadores: 2,
  atualizacoesPorSegundo: 30,
  estadosPorSegundo: 15,
  velocidade: 3,                 // Unidades por segundo.
  metadeArena: 6,                // X e Z entre -6 e +6.
  tamanhoCubo: 0.8,
  tempoLimiteEntradaMs: 250,     // Ms
  maximoEntradasPorSegundo: 30,
});

const TECLAS_PERMITIDAS = ['w', 'a', 's', 'd'];
const TECLAS_SOLTAS = Object.freeze({ w: false, a: false, s: false, d: false });
const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

export class Jogo {
  constructor() {
    this.jogadores = new Map();
    this.proximoId = 1;
    this.passo = 0;
    this.tasks = new Map();
  }

  adicionarJogador(conexao) {
    if (this.jogadores.size >= CONFIGURACAO.maximoJogadores) return null;

    const cubosOcupados = new Set(
      [...this.jogadores.values()].map(jogador => jogador.cubo)
    );
    const cubo = cubosOcupados.has(0) ? 1 : 0;
    const agora = Date.now();
    const jogador = {
      id: this.proximoId++,
      cubo,
      conexao,
      x: cubo === 0 ? -2 : 2,
      z: 0,
      teclas: { ...TECLAS_SOLTAS },
      ultimaSequencia: -1,
      instanteUltimaEntrada: agora,
      inicioJanelaTaxa: agora,
      contagemEntradas: 0,
    };

    this.jogadores.set(jogador.id, jogador);
    
    const taskId = `task_energia_${jogador.id}`;
    const posX = jogador.cubo === 0 ? -4 : 4;
    const posZ = 3;

    this.tasks.set(
      taskId,
      new TaskProximidade({
        id: taskId,
        jogadorId: jogador.id,
        x: posX,
        z: posZ,
        tempoNecessario: 3,
      })
    );
    console.log(`[Jogo] Task "${taskId}" criada para Jogador ${jogador.id} em (${posX}, ${posZ})`);
    return jogador;
  }

  removerJogador(id) {
    this.jogadores.delete(id);
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.jogadorId === id) {
        this.tasks.delete(taskId);
      }
    }
    this.proximoId--;
  }

  // O cliente não pode escolher posição, caso contrário, poderia burlar o jogo
  receberEntrada(id, mensagem) {
    const jogador = this.jogadores.get(id);
    if (!jogador || !mensagem || typeof mensagem !== 'object' ||
        Array.isArray(mensagem)) return false;

    // O pacote deve possuir: tipo, sequencia e teclas
    if (Object.keys(mensagem).length !== 3 ||
        mensagem.tipo !== 'entrada' ||
        !Number.isSafeInteger(mensagem.sequencia) ||
        mensagem.sequencia <= jogador.ultimaSequencia) return false;

    const teclas = mensagem.teclas;
    if (!teclas || typeof teclas !== 'object' || Array.isArray(teclas) ||
        Object.keys(teclas).length !== 4 ||
        !TECLAS_PERMITIDAS.every(tecla =>
          Object.hasOwn(teclas, tecla) && typeof teclas[tecla] === 'boolean')) {
      return false;
    }

    const agora = Date.now();
    if (agora - jogador.inicioJanelaTaxa >= 1000) {
      jogador.inicioJanelaTaxa = agora;
      jogador.contagemEntradas = 0;
    }
    if (jogador.contagemEntradas >= CONFIGURACAO.maximoEntradasPorSegundo) {
      return false;
    }

    jogador.contagemEntradas++;
    jogador.ultimaSequencia = mensagem.sequencia;
    jogador.instanteUltimaEntrada = agora;
    jogador.teclas = { ...teclas };
    return true;
  }

  receberAcaoTask(jogadorId, mensagem) {
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador || !mensagem || typeof mensagem.taskId !== 'string') return false;

    const task = this.tasks.get(mensagem.taskId);
    if (!task) return false;

    return task.processarAcao(jogador, mensagem);
  }

  podeOcupar(jogador, x, z) {
    for (const outro of this.jogadores.values()) {
      if (outro.id === jogador.id) continue;
      // Não pode ocorrer sobreposição dos quadrados
      if (Math.abs(x - outro.x) < CONFIGURACAO.tamanhoCubo &&
          Math.abs(z - outro.z) < CONFIGURACAO.tamanhoCubo) return false;
    }

    const raio = CONFIGURACAO.tamanhoCubo / 2;
    for (const objeto of COLISORES_QUARTO) {
      if (Math.abs(x - objeto.x) <
        raio + objeto.largura / 2 &&
        Math.abs(z - objeto.z) <
        raio + objeto.profundidade / 2) {
        return false;
        }
      }
    return true;
  }

  atualizar(tempoDecorrido) {
    // Limita atrasos grandes para evitar saltos bruscos na simulação.
    tempoDecorrido = limitar(tempoDecorrido, 0, 0.05);
    const agora = Date.now();
    const limite = CONFIGURACAO.metadeArena - CONFIGURACAO.tamanhoCubo / 2;

    for (const jogador of this.jogadores.values()) {
      const teclas = agora - jogador.instanteUltimaEntrada <=
        CONFIGURACAO.tempoLimiteEntradaMs ? jogador.teclas : TECLAS_SOLTAS;

      let direcaoX = Number(teclas.d) - Number(teclas.a);
      let direcaoZ = Number(teclas.s) - Number(teclas.w);
      const comprimento = Math.hypot(direcaoX, direcaoZ);
      if (comprimento === 0) continue;

      // normalização para que a diagonal a moviemntação diagonal não tenha velocidade extra
      direcaoX /= comprimento;
      direcaoZ /= comprimento;
      const novoX = limitar(jogador.x + direcaoX * CONFIGURACAO.velocidade *
        tempoDecorrido, -limite, limite);
      const novoZ = limitar(jogador.z + direcaoZ * CONFIGURACAO.velocidade *
        tempoDecorrido, -limite, limite);

      // Testar cada eixo separadamente permite deslizar junto ao obstáculo.
      if (this.podeOcupar(jogador, novoX, jogador.z)) jogador.x = novoX;
      if (this.podeOcupar(jogador, jogador.x, novoZ)) jogador.z = novoZ;
    }
    for (const task of this.tasks.values()) {
      const dono = task.jogadorId !== null ? this.jogadores.get(task.jogadorId) : null;
      task.atualizar(tempoDecorrido, dono);
    }
    this.passo++;
  }

  criarEstado() {
    return {
      tipo: 'estado',
      passo: this.passo,
      jogadores: [...this.jogadores.values()].map(({ id, cubo, x, z }) => ({
        id,
        cubo,
        x: Number(x.toFixed(4)),
        z: Number(z.toFixed(4)),
      })),
      tasks: [...this.tasks.values()].map(task => task.serializar()),
    };
  }
}