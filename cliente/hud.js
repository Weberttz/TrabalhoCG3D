// HUD NCCA — camada HTML/CSS independente do WebGL2.
// O cliente desenha a interface; o servidor continua sendo a fonte do estado do jogo.

const icones = {
  circuito: `<svg viewBox="0 0 52 52" aria-hidden="true"><path d="M10 12h14l7 7h11M10 26h21l7-7h4M10 40h14l7-7h11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="43" cy="19" r="4" fill="currentColor"/><circle cx="43" cy="33" r="4" fill="currentColor"/><circle cx="10" cy="12" r="3" fill="currentColor"/></svg>`,
  sol: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 1.5v2.2M12 20.3v2.2M1.5 12h2.2M20.3 12h2.2M4.6 4.6l1.6 1.6m11.6 11.6 1.6 1.6M19.4 4.6l-1.6 1.6M6.2 17.8l-1.6 1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  lista: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h11M8 12h11M8 17h11M3.8 7l.6.6L6 6M3.8 12l.6.6L6 11M3.8 17l.6.6L6 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mochila: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="7" width="13" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8.5 15h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  livro: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h7a3 3 0 0 1 3 3v12H7a3 3 0 0 0-3 1zm10 3a3 3 0 0 1 3-3h3v16h-3a3 3 0 0 0-3-1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  chave: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m11 11 9 9m-4-4-2 2m5 1-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  cafe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13v6a6.5 6.5 0 0 1-13 0V8zm13 1h2a3 3 0 0 1 0 6h-2M3 21h16M8 3v2M12 2v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bloco: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 4V2m6 2V2M9 10h6M9 14h6M9 18h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`
};

const MISSOES_EXEMPLO = [
  { id: 'rede', nome: 'Verificar os computadores', concluida: true },
  { id: 'livros', nome: 'Organizar a sala de estudos', concluida: false },
  { id: 'energia', nome: 'Restaurar a energia', concluida: false }
];
const ITENS_EXEMPLO = [
  { id: 'caderno', nome: 'Caderno', icone: 'livro' },
  { id: 'chave', nome: 'Chave', icone: 'chave' },
  { id: 'cafe', nome: 'Café', icone: 'cafe' },
  { id: 'bloco', nome: 'Anotações', icone: 'bloco' }
];

export function criarHUD() {
    const hud = document.createElement('div');

    hud.id = 'hud-cozy';

    hud.innerHTML = `
        <div class="hud-identidade">
            <div class="hud-logo">N</div>

            <div>
                <small>NÚCLEO DE COMPUTAÇÃO</small>
                <strong>NC2A · Simulator</strong>
            </div>
        </div>

        <div class="hud-horario">
            ☀️ <span id="horario-jogo">--:--</span>
        </div>

        <div class="hud-missoes">
            <button id="botao-missoes" type="button">
                💻 Missões ▾
            </button>

            <div id="painel-missoes"
                 class="hud-lista-missoes"
                 hidden>
                <ul id="lista-missoes"></ul>
            </div>
        </div>

        <div class="hud-inventario">
            <button class="hud-slot" data-slot="0">1</button>
            <button class="hud-slot" data-slot="1">2</button>
            <button class="hud-slot" data-slot="2">3</button>
            <button class="hud-slot" data-slot="3">4</button>
        </div>
    `;

    document.body.appendChild(hud);

    const painel = hud.querySelector('#painel-missoes');
    const botaoMissoes = hud.querySelector('#botao-missoes');
    const slots = [...hud.querySelectorAll('.hud-slot')];

    let selecionado = -1;

    const canvas = document.getElementById('jogo');

    const avisoInteracao = document.createElement('div');
    avisoInteracao.id = 'hud-interacao';
    avisoInteracao.hidden = true;

    avisoInteracao.innerHTML = `
        <span class="hud-interacao-tecla">E</span>

        <div class="hud-interacao-texto">
            <strong>Interagir</strong>
            <small id="hud-interacao-nome"></small>
        </div>
    `;

    hud.appendChild(avisoInteracao);

    const nomeInteracao = avisoInteracao.querySelector(
        '#hud-interacao-nome'
    );

    // painel de missões aparece
    function alternarMissoes() {
      painel.hidden = !painel.hidden;
    }

    function selecionarSlot(indice) {
        selecionado = indice;

        slots.forEach((slot, i) => {
            slot.classList.toggle('ativo', i === selecionado);
        });
    }

    botaoMissoes.addEventListener('click', alternarMissoes);

    slots.forEach((slot, indice) => {
        slot.addEventListener('click', () => selecionarSlot(indice));
    });

    function aoPressionarTecla(evento) {
        if (evento.repeat) return;

        // painel abre quando clicar em M
        if (evento.code === 'KeyM') {
            evento.preventDefault();
            alternarMissoes();
            return;
        }

        if (evento.code.startsWith('Digit')) {
            const numero = Number(evento.code.slice(5));

            if (numero >= 1 && numero <= 4) {
                selecionarSlot(numero - 1);
            }
        }

        if (evento.code === 'Escape') {
            painel.hidden = true;
        }
    }

    document.addEventListener('keydown', aoPressionarTecla);

    return {
        atualizarHorario(horario) {
            hud.querySelector('#horario-jogo').textContent = horario;
        },

        atualizarMissoes(missoes) {
            const lista = hud.querySelector('#lista-missoes');
            lista.replaceChildren();

            for (const missao of missoes) {
                const item = document.createElement('li');
                item.textContent =
                    `${missao.concluida ? '✓' : '○'} ${missao.nome}`;

                lista.appendChild(item);
            }
        },

        atualizarInteracao(objeto) {
            if (!objeto) {
                avisoInteracao.hidden = true;
                return;
            }

            nomeInteracao.textContent = objeto.nome;
            avisoInteracao.hidden = false;
        },

        estaComMissoesAbertas() {
          return !painel.hidden;
        },

        destruir() {
            document.removeEventListener('keydown', aoPressionarTecla);
            hud.remove();
        }
    };
}
