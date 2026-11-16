import { TaskBase } from './TaskBase.js';
import { STATUS_TASK } from '../../compartilhado/constantesTasks.js';

export class TaskProximidade extends TaskBase {
  constructor(opcoes) {
    super({ ...opcoes, tipo: 'proximidade' });
    this.tempoNecessario = opcoes.tempoNecessario || 3.0;
    this.estaCarregando = false;
    this.proximoLogProgresso = 0.25; // Loga a cada 25% concluído
  }

  atualizar(tempoDecorrido, jogador) {
    if (this.status !== STATUS_TASK.EM_ANDAMENTO) return;

    const perto = this.jogadorEstaNaArea(jogador);

    if (perto) {
      if (!this.estaCarregando) {
        this.estaCarregando = true;
        console.log(`[Task ${this.id}] Jogador ${jogador.id} perto do objetivo! Carregando...`);
      }

      this.progresso += tempoDecorrido / this.tempoNecessario;

      if (this.progresso >= this.proximoLogProgresso && this.progresso < 1) {
        console.log(`[Task ${this.id}] Progresso: ${Math.round(this.progresso * 100)}%`);
        this.proximoLogProgresso += 0.25;
      }

      if (this.progresso >= 1) {
        this.estaCarregando = false;
        this.concluir();
      }
    } else if (this.estaCarregando) {
      this.estaCarregando = false;
      console.log(`[Task ${this.id}] Jogador ${jogador.id} afastou-se. Carregamento pausado em ${Math.round(this.progresso * 100)}%.`);
    }
  }
}