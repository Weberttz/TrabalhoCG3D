export function recolherSubString(valor) {
    const letras = Array.from(String(valor ?? ''));
    const indice = letras.findIndex((letra, posicao) =>
        posicao > 0 &&
        /[\p{Lu}\p{N}]/u.test(letra) &&
        /[\p{Ll}]/u.test(letras[posicao - 1])
    );
    return indice === -1 ? letras.join('') : letras.slice(0, indice).join('');
}

export function criarHUD() {
    // Evita painéis duplicados em caso de reinicialização do jogo.
    document.getElementById('hud-cozy')?.remove();

    const hud = document.createElement('div');
    hud.id = 'hud-cozy';
    hud.className = 'nc2a-hud';

    hud.innerHTML = `
        <section class="nc2a-canto-esquerdo" aria-label="Identidade e horário">
            <div class="nc2a-identidade">
                <div class="nc2a-logo" aria-hidden="true">N</div>
                <div class="nc2a-identidade-textos">
                    <span class="nc2a-subtitulo">Núcleo de Computação</span>
                    <strong class="nc2a-nome">NC2A Simulator</strong>
                </div>
            </div>

            <div class="nc2a-relogio" aria-label="Horário">
                <svg class="nc2a-calendario" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="0" />
                    <path d="M3 9h18M8 3v4M16 3v4" />
                    <path d="M7 13h2M12 13h2M7 17h2M12 17h2" />
                </svg>
                <time id="hud-horario" class="nc2a-hora">--:--</time>
                <span class="nc2a-hora-divisor" aria-hidden="true"></span>
                <span id="hud-periodo" class="nc2a-periodo">Expediente</span>
            </div>
        </section>

        <section id="painel-missoes" class="nc2a-missoes" aria-label="Lista de missões">
            <button id="botao-missoes" class="nc2a-missoes-titulo"
                    type="button" aria-controls="lista-missoes" aria-expanded="true"
                    title="Recolher ou mostrar missões (M)">
                <span>Missões</span>
                <span id="hud-missoes-seta" class="nc2a-missoes-seta" aria-hidden="true">▾</span>
            </button>
            <div id="lista-missoes" class="nc2a-missoes-lista"></div>
        </section>

        <div id="hud-interacao" class="nc2a-interacao" hidden>
            <kbd class="nc2a-interacao-tecla">E</kbd>
            <div class="nc2a-interacao-conteudo">
                <strong>Interagir</strong>
                <span id="hud-interacao-nome">Objeto</span>
            </div>
        </div>

        <div class="nc2a-hotbar" aria-label="Barra de itens">
            <div class="nc2a-slot" data-slot="1"><span class="nc2a-slot-numero">1</span><span class="nc2a-slot-item"></span></div>
            <div class="nc2a-slot" data-slot="2"><span class="nc2a-slot-numero">2</span><span class="nc2a-slot-item"></span></div>
            <div class="nc2a-slot" data-slot="3"><span class="nc2a-slot-numero">3</span><span class="nc2a-slot-item"></span></div>
            <div class="nc2a-slot" data-slot="4"><span class="nc2a-slot-numero">4</span><span class="nc2a-slot-item"></span></div>
        </div>

        <div class="nc2a-controles" aria-label="Controles do jogo">
            <div class="nc2a-controles-movimento">
                <div class="nc2a-teclas">
                    <div class="nc2a-teclas-cima">
                        <kbd>W</kbd>
                    </div>
                    <div class="nc2a-teclas-baixo">
                        <kbd>A</kbd>
                        <kbd>S</kbd>
                        <kbd>D</kbd>
                    </div>
                </div>

                <span class="nc2a-controles-descricao">
                    Movimentar
                </span>
            </div>

            <div class="nc2a-controles-divisor"></div>

            <div class="nc2a-controles-acao">
                <kbd>M</kbd>
                <span>Missões</span>
            </div>
        </div>

        <div id="hud-toast-missao" class="nc2a-toast" role="status" aria-live="polite" hidden></div>
    `;

    document.body.appendChild(hud);

    const painelMissoes = hud.querySelector('#painel-missoes');
    const botaoMissoes = hud.querySelector('#botao-missoes');
    const listaMissoes = hud.querySelector('#lista-missoes');
    const setaMissoes = hud.querySelector('#hud-missoes-seta');
    const elementoHorario = hud.querySelector('#hud-horario');
    const elementoPeriodo = hud.querySelector('#hud-periodo');
    const elementoInteracao = hud.querySelector('#hud-interacao');
    const nomeInteracao = hud.querySelector('#hud-interacao-nome');
    const toast = hud.querySelector('#hud-toast-missao');
    const slots = [...hud.querySelectorAll('.nc2a-slot')];

    let missoesVisiveis = true;
    let assinaturaMissoes = null;
    let tempoToast = null;
    let horarioControladoPeloJogo = false;
    let slotSelecionado = 0; // 0 = nenhum destaque

    function alternarMissoes() {
        missoesVisiveis = !missoesVisiveis;
        painelMissoes.classList.toggle('nc2a-recolhido', !missoesVisiveis);
        botaoMissoes.setAttribute('aria-expanded', String(missoesVisiveis));
        setaMissoes.textContent = missoesVisiveis ? '▾' : '▸';
    }

    botaoMissoes.addEventListener('click', alternarMissoes);

    function atualizarHorario(hora, minuto, periodo) {
        // Aceita Date, '09:10', (9, 10, 'Manhã') ou {hora:9, minuto:10, periodo:'Manhã'}.
        let h;
        let m;
        let periodoExterno = periodo;

        if (hora instanceof Date) {
            h = hora.getHours();
            m = hora.getMinutes();
        } else if (typeof hora === 'string') {
            const resultado = hora.match(/^(\d{1,2}):(\d{2})$/);
            if (!resultado) return;
            h = Number(resultado[1]);
            m = Number(resultado[2]);
        } else if (hora && typeof hora === 'object') {
            h = Number(hora.hora ?? hora.horas ?? hora.hour);
            m = Number(hora.minuto ?? hora.minutos ?? hora.minute ?? 0);
            periodoExterno = hora.periodo ?? periodo;
        } else if (typeof hora === 'number') {
            h = hora;
            m = minuto ?? 0;
        } else {
            return;
        }

        if (!Number.isFinite(h) || !Number.isFinite(m)) return;
        if (h < 0 || h > 23 || m < 0 || m > 59) return;

        horarioControladoPeloJogo = true;
        elementoHorario.textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(m)).padStart(2, '0')}`;
        elementoPeriodo.textContent = periodoExterno || (h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite');
    }

    // Até o jogo definir um horário próprio, mostra a hora local do navegador.
    function atualizarRelogioLocal() {
        if (horarioControladoPeloJogo) return;
        atualizarHorario(new Date());
        horarioControladoPeloJogo = false;
    }

    atualizarRelogioLocal();
    const intervaloRelogio = setInterval(atualizarRelogioLocal, 15_000);

    function atualizarMissoes(missoes = []) {
        const dados = (Array.isArray(missoes) ? missoes : []).map(missao => ({
            id: String(missao.id ?? ''),
            nome: String(missao.nome ?? missao.id ?? 'Missão sem nome'),
            concluida: missao.concluida === true || missao.status === 'concluida'
        }));

        // principal.js pode chamar esta função a cada frame.
        const assinaturaAtual = JSON.stringify(dados);
        if (assinaturaAtual === assinaturaMissoes) return;
        assinaturaMissoes = assinaturaAtual;

        const fragmento = document.createDocumentFragment();

        if (dados.length === 0) {
            const vazio = document.createElement('div');
            vazio.className = 'nc2a-missao-vazia';
            vazio.textContent = 'Nenhuma missão atribuída';
            fragmento.appendChild(vazio);
        } else {
            for (const missao of dados) {
                const linha = document.createElement('div');
                linha.className = `nc2a-missao${missao.concluida ? ' nc2a-missao-concluida' : ''}`;
                linha.title = missao.nome;

                const texto = document.createElement('span');
                texto.className = 'nc2a-missao-nome';
                texto.textContent = missao.nome;

                const caixa = document.createElement('span');
                caixa.className = 'nc2a-missao-check';
                caixa.setAttribute('aria-label', missao.concluida ? 'Concluída' : 'Pendente');

                linha.append(texto, caixa);
                fragmento.appendChild(linha);
            }
        }

        listaMissoes.replaceChildren(fragmento);
    }

    function atualizarInteracao(objeto) {
        if (!objeto) {
            elementoInteracao.hidden = true;
            return;
        }

        const nome = objeto.nome ?? objeto.name ?? objeto.id ?? 'Objeto';
        nomeInteracao.textContent = recolherSubString(nome).replace(/[-_]+/g, ' ');
        elementoInteracao.hidden = false;
    }

    function exibirToast(mensagem, tipo = 'conclusao') {
        clearTimeout(tempoToast);

        toast.classList.toggle(
            'nc2a-toast-recebimento',
            tipo === 'recebimento'
        );

        toast.textContent = mensagem;
        toast.hidden = false;

        tempoToast = setTimeout(() => {
            toast.hidden = true;
        }, 3500);
    }

    function mostrarConclusaoMissao(nome) {
        exibirToast(`✓ Missão concluída: ${nome}`);
    }

    function mostrarRecebimentoMissoes(quantidade) {
        if (quantidade <= 0) return;

        const mensagem = quantidade === 1
            ? 'Nova missão recebida'
            : `${quantidade} novas missões recebidas`;

        exibirToast(`▤ ${mensagem}`, 'recebimento');
    }

    function selecionarSlot(numero) {
        slotSelecionado = numero >= 1 && numero <= 4 ? numero : 0;
        for (const slot of slots) {
            const selecionado = Number(slot.dataset.slot) === slotSelecionado;
            slot.classList.toggle('nc2a-slot-selecionado', selecionado);
        }
    }

    function atualizarInventario(itens = [], selecionado = slotSelecionado) {
        for (let indice = 0; indice < 4; indice++) {
            const item = itens[indice];
            const conteudo = slots[indice].querySelector('.nc2a-slot-item');
            conteudo.textContent = item ? String(item.nome ?? item.name ?? item) : '';
        }
        selecionarSlot(Number(selecionado));
    }

    function aoPressionarTecla(evento) {
        const alvo = evento.target;
        if (alvo?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

        if (evento.code === 'KeyM' && !evento.repeat) {
            alternarMissoes();
        }

        const numero = /^Digit([1-4])$/.exec(evento.code)?.[1];
        if (numero) selecionarSlot(Number(numero));
    }

    document.addEventListener('keydown', aoPressionarTecla);
    atualizarMissoes([]);

    return {
        atualizarHorario,
        atualizarMissoes,
        atualizarInteracao,
        mostrarRecebimentoMissoes,
        mostrarConclusaoMissao,
        atualizarInventario,
        selecionarSlot,

        // O painel é permanente, não modal: não deve bloquear as interações do jogo.
        estaComMissoesAbertas: () => false,

        destruir() {
            document.removeEventListener('keydown', aoPressionarTecla);
            botaoMissoes.removeEventListener('click', alternarMissoes);
            clearInterval(intervaloRelogio);
            clearTimeout(tempoToast);
            hud.remove();
        }
    };
}
