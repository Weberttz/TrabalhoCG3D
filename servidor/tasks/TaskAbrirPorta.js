import { TaskBase } from './TaskBase.js';
import { STATUS_TASK } from '../../compartilhado/constantesTasks.js';

export class TaskAbrirPorta extends TaskBase {
  constructor(opcoes) {
    super({ ...opcoes, tipo: 'abrir_porta' });
    this.nomeItemChave = opcoes.nomeItemChave;
  }

  atualizar(tempoDecorrido, jogador) {
    // Missão concluída por interação direta com a porta.
  }

  destrancarPorta(jogador) {
    if (this.status !== STATUS_TASK.EM_ANDAMENTO) return false;
    if (this.jogadorId !== jogador.id) return false;
    if (jogador.itemSegurado !== this.nomeItemChave) return false;

    this.concluir();
    return true;
  }
}