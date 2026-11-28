import { TaskBase } from './TaskBase.js';
import { STATUS_TASK } from '../../compartilhado/constantesTasks.js';

export class TaskJogarLixo extends TaskBase {
  constructor(opcoes) {
    super({ ...opcoes, tipo: 'jogar_lixo' });
    this.nomeItemLixo = opcoes.nomeItemLixo ?? 'blocoTeste01';
  }

  atualizar(tempoDecorrido, jogador) {
    // Task baseada em interação direta (tecla E), não exige atualização por tempo.
  }

  descartarLixo(jogador) {
    if (this.status !== STATUS_TASK.EM_ANDAMENTO) {
      return false;
    }

    if (this.jogadorId !== jogador.id) {
      return false;
    }

    if (jogador.itemSegurado !== this.nomeItemLixo) {
      return false;
    }

    this.concluir();
    return true;
  }
}