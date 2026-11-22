import { TaskBase } from './TaskBase.js';
import { STATUS_TASK } from '../../compartilhado/constantesTasks.js';

export class TaskJogarLixo extends TaskBase {
  constructor(opcoes) {
    super({ ...opcoes, tipo: 'jogar_lixo' });
  }

  atualizar(tempoDecorrido, jogador) {
    // Task baseada em interação direta (tecla E), não exige atualização por tempo.
  }

  descartarLixo(jogador) {
    if (this.status !== STATUS_TASK.EM_ANDAMENTO) {
      console.log(`[Task ${this.id}] Jogador ${jogador.id} interagiu com a lixeira, mas a task está "${this.status}".`);
      return false;
    }

    if (this.jogadorId !== jogador.id) {
      console.log(`[Task ${this.id}] Jogador ${jogador.id} tentou concluir a task, mas ela pertence ao Jogador ${this.jogadorId}.`);
      return false;
    }

    console.log(`[Task ${this.id}] Jogador ${jogador.id} jogou o lixo na lixeira!`);
    this.concluir();
    return true;
  }
}