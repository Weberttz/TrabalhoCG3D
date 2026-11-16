import { STATUS_TASK } from '../../compartilhado/constantesTasks.js';

export class TaskBase {
  constructor({ id, tipo, jogadorId = null, x = 0, z = 0, raioInteracao = 1.5 }) {
    if (new.target === TaskBase) {
      throw new Error('TaskBase é uma classe abstrata e não pode ser instanciada diretamente.');
    }

    this.id = id;
    this.tipo = tipo;
    this.x = x;
    this.z = z;
    this.raioInteracao = raioInteracao;
    this.progresso = 0;

    // Se já nasce com um jogador (como no seu protótipo), já começa EM_ANDAMENTO.
    // Se nasce sem jogador (jogadorId: null), começa PENDENTE.
    this.jogadorId = jogadorId;
    this.status = jogadorId !== null ? STATUS_TASK.EM_ANDAMENTO : STATUS_TASK.PENDENTE;
  }

  // =========================================================================
  // CONTROLE DE POSSE / ATRIBUIÇÃO (Usado pelo Jogo)
  // =========================================================================

  atribuirPara(jogador) {
    if (this.status !== STATUS_TASK.PENDENTE || !jogador) return false;

    this.jogadorId = jogador.id;
    this.status = STATUS_TASK.EM_ANDAMENTO;
    this.aoAtribuir(jogador);
    return true;
  }

  liberar() {
    if (this.status === STATUS_TASK.CONCLUIDA) return;

    const antigoJogadorId = this.jogadorId;
    this.jogadorId = null;
    this.status = STATUS_TASK.PENDENTE;
    this.aoLiberar(antigoJogadorId);
  }

  concluir() {
    this.progresso = 1;
    this.status = STATUS_TASK.CONCLUIDA;
    this.aoConcluir();
  }

  // =========================================================================
  // VERIFICAÇÃO ESPACIAL (Usado pelas subclasses no atualizar)
  // =========================================================================

  jogadorEstaNaArea(jogador) {
    if (!jogador) return false;
    if (this.status !== STATUS_TASK.EM_ANDAMENTO) return false;
    if (this.jogadorId !== jogador.id) return false;

    const distancia = Math.hypot(jogador.x - this.x, jogador.z - this.z);
    return distancia <= this.raioInteracao;
  }

  // =========================================================================
  // INTERFACE PADRÃO E HOOKS
  // =========================================================================

  atualizar(tempoDecorrido, jogador) {
    throw new Error(`O método atualizar() deve ser implementado pela subclasse ${this.constructor.name}`);
  }

  processarAcao(jogador, dadosAcao) {
    return false;
  }

  aoAtribuir(jogador) {
    console.log(`[Task ${this.id}] EM ANDAMENTO — atribuída ao Jogador ${jogador.id}`);
  }

  aoLiberar(antigoJogadorId) {
    console.log(`[Task ${this.id}] PENDENTE — liberada pelo Jogador ${antigoJogadorId}`);
  }

  aoConcluir() {
    console.log(`[Task ${this.id}] CONCLUÍDA pelo Jogador ${this.jogadorId}!`);
  }

  serializar() {
    return {
      id: this.id,
      tipo: this.tipo,
      jogadorId: this.jogadorId,
      status: this.status,
      progresso: Number(this.progresso.toFixed(2)),
      x: this.x,
      z: this.z,
    };
  }
}