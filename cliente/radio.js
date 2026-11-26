/**
 * cliente/radio.js
 *
 * Reprodução sincronizada com o servidor.
 *
 * O servidor determina:
 * - Se o rádio está ligado
 * - Qual música está tocando
 * - Quando a música começou
 *
 * O cliente apenas reproduz o estado recebido.
 */

export function criarRadio() {
    let audioCtx = null;
    let filtro = null;
    let volume = null;
    let fonte = null;

    let estadoAtual = null;
    let geracao = 0;
    let carregandoGeracao = null;

    // Uma música é carregada apenas uma vez por cliente.
    const cacheMusicas = new Map();

    function inicializarAudio() {
        if (audioCtx) return;

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error(
                'Web Audio API não disponível.'
            );
        }

        audioCtx = new AudioContextClass();

        filtro = audioCtx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 800;

        volume = audioCtx.createGain();
        volume.gain.value = 0.45;

        filtro.connect(volume);
        volume.connect(audioCtx.destination);
    }

    // Deve ser chamada dentro de uma interação do usuário.
    function habilitarAudio() {
        try {
            inicializarAudio();

            audioCtx.resume()
                .then(() => {
                    tentarReproduzir();
                })
                .catch(erro => {
                    console.warn(
                        '[RÁDIO] Áudio bloqueado:',
                        erro
                    );
                });

        } catch (erro) {
            console.error('[RÁDIO]', erro);
        }
    }

    function carregarMusica(caminho) {
        if (cacheMusicas.has(caminho)) {
            return cacheMusicas.get(caminho);
        }

        const carregamento = (async () => {
            const resposta = await fetch(caminho);

            if (!resposta.ok) {
                throw new Error(
                    `Erro ao carregar ${caminho}: ` +
                    resposta.status
                );
            }

            const dados = await resposta.arrayBuffer();

            return audioCtx.decodeAudioData(dados);
        })();

        const promessa = carregamento.catch(erro => {
            cacheMusicas.delete(caminho);
            throw erro;
        });

        cacheMusicas.set(caminho, promessa);

        return promessa;
    }

    function interromperFonte() {
        if (!fonte) return;

        try {
            fonte.stop();
        } catch {
            // A fonte pode já ter sido finalizada.
        }

        fonte.disconnect();
        fonte = null;
    }

    async function tentarReproduzir() {
        if (
            !estadoAtual?.ligado ||
            !audioCtx ||
            audioCtx.state !== 'running' ||
            fonte ||
            carregandoGeracao === geracao
        ) {
            return;
        }

        const geracaoEsperada = geracao;
        const estado = estadoAtual;

        carregandoGeracao = geracaoEsperada;

        try {
            const buffer = await carregarMusica(
                estado.musica
            );

            // Enquanto carregava, o servidor pode ter
            // desligado o rádio ou trocado de faixa.
            if (
                geracaoEsperada !== geracao ||
                !estadoAtual?.ligado ||
                audioCtx.state !== 'running'
            ) {
                return;
            }

            // Tempo transcorrido até o estado ser enviado.
            const tempoServidor = Math.max(
                0,
                estado.servidorAgora - estado.iniciadoEm
            );

            // Tempo decorrido no cliente desde o recebimento.
            const tempoCliente = Math.max(
                0,
                performance.now() - estado.recebidoEm
            );

            const segundosDecorridos =
                (tempoServidor + tempoCliente) / 1000;

            // Como a faixa toca em loop, posiciona
            // o áudio na posição correspondente.
            const posicao =
                segundosDecorridos % buffer.duration;

            const novaFonte =
                audioCtx.createBufferSource();

            novaFonte.buffer = buffer;
            novaFonte.loop = true;

            novaFonte.connect(filtro);

            fonte = novaFonte;

            novaFonte.start(0, posicao);

            console.log(
                '[RÁDIO] Sincronizado:',
                estado.musica,
                'posição:',
                posicao.toFixed(2),
                'segundos'
            );

        } catch (erro) {
            console.error(
                '[RÁDIO] Falha na reprodução:',
                erro
            );

        } finally {
            if (carregandoGeracao === geracaoEsperada) {
                carregandoGeracao = null;
            }
        }
    }

    // Chamado a cada atualização do jogo.
    function sincronizar(novoEstado) {
        // Servidor desconectado ou estado indisponível.
        if (
            !novoEstado ||
            typeof novoEstado.versao !== 'number'
        ) {
            if (estadoAtual !== null) {
                estadoAtual = null;
                geracao++;
                carregandoGeracao = null;
                interromperFonte();
            }

            return;
        }

        // Não reinicia a música a cada frame.
        if (
            estadoAtual?.versao === novoEstado.versao
        ) {
            return;
        }

        geracao++;
        carregandoGeracao = null;

        interromperFonte();

        estadoAtual = {
            ...novoEstado,
            recebidoEm: performance.now()
        };

        if (estadoAtual.ligado) {
            tentarReproduzir();
        }
    }

    function estaLigado() {
        return estadoAtual?.ligado === true;
    }

    function obterMusicaAtual() {
        return estadoAtual?.musica ?? null;
    }

    function destruir() {
        geracao++;
        estadoAtual = null;

        interromperFonte();
        cacheMusicas.clear();

        if (audioCtx) {
            audioCtx.close().catch(console.error);
        }
    }

    return {
        sincronizar,
        habilitarAudio,
        estaLigado,
        obterMusicaAtual,
        destruir
    };
}
