import { obterObjetosMapa, obterObjetoInterativoProximo } from './mapa.js';
import { lerTeclas, configurarInteracao } from "./teclado.js";
import { enviarTeclas, enviarInteracao, obterSessao } from "./rede.js";
import { criarRenderizador } from "./renderizador.js";
import { iniciarMouse, obterOrientacao } from "./mouse.js";
import { leitorOBJ } from "./leitorOBJ.js";
import { carregarGLB } from './leitorGLB.js';
import { criarHUD } from './hud.js';
import { criarAnimadorGLB } from './animador.js';

//carrega os modelos obj antes de iniciar a renderizacao
async function carregarModelos() {
    const modelos = {};

    // Obtém os nomes dos modelos, sem duplicatas.
    const nomesModelos = new Set(
        obterObjetosMapa()
            .map(objeto => objeto.modelo)
            .filter(Boolean)
    );

    // Modelos dos personagens
    nomesModelos.add('personagem.obj');

    // Carrega os modelos em paralelo.
    await Promise.all(
        [...nomesModelos].map(async nome => {
            try {
                modelos[nome] = await leitorOBJ.carregarArquivo(
                    `./modelosOBJ/${nome}`
                );

                console.log(`Modelo carregado: ${nome}`);
            } catch (erro) {
                console.error(`Erro ao carregar ${nome}:`, erro);
            }
        })
    );

    return modelos;
}

function obterNomeMissao(task) {
    const nomes = {
        task_lixo_sala002: 'Recolher o lixo da Sala 002',
        task_energia_1: 'Restaurar a energia'
    };

    return nomes[task.id]
        ?? (task.nome && task.nome !== task.id
            ? task.nome
            : String(task.id).replace(/^task_/, '').replaceAll('_', ' '));
}

function escolherAnimacao(teclas = {}) {
    const frente = Number(!!teclas.w) - Number(!!teclas.s);
    const lateral = Number(!!teclas.d) - Number(!!teclas.a);

    if (frente > 0) return 'Walking';
    if (frente < 0) return 'WalkingBackwards';

    if (lateral < 0) return 'StrafeLeft';
    if (lateral > 0) return 'StrafeRight';

    return 'Idle';
}


async function iniciarJogo() {
    const estadoAnteriorMissoes = new Map();
    //const hud = criarHUD();
    const modelos = await carregarModelos();

    const personagemGLB = await carregarGLB(
        './modelosGLB/personagem.glb'
    );

    const animadores = new Map();

    const renderizador = criarRenderizador(
        document.getElementById('jogo'),
        modelos,
        personagemGLB
    );
    iniciarMouse(document.getElementById("jogo"));
    configurarInteracao(() => {
        enviarInteracao();
    });

    const objetosInterativos = obterObjetosMapa()
        .filter(objeto => objeto.interativo);

    // A cada 50 ms: envia teclas. O servidor decide para onde cada cubo vai.
    setInterval(() => {
        const { anguloHorizontal } = obterOrientacao();
        enviarTeclas(lerTeclas(), anguloHorizontal);
    }, 50);


    let tempoAnterior = null;
    // O navegador desenha na taxa do monitor: não é ele que calcula a física.
    function desenharQuadro(tempoAtual) {
        const { meuId, estado, situacao } = obterSessao();
        const { anguloHorizontal } = obterOrientacao();

        const minhasMissoes = (estado.tasks ?? [])
            .filter(task =>
                String(task.jogadorId) === String(meuId)
            )
            .map(task => ({
                id: task.id,
                nome: obterNomeMissao(task),
                concluida:
                    task.concluida === true ||
                    task.status === 'concluida'
            }));

        // Verifica quais missões acabaram de ser concluídas.
        for (const missao of minhasMissoes) {
            const anterior = estadoAnteriorMissoes.get(missao.id);

            if (anterior === false && missao.concluida) {
                //hud.mostrarConclusaoMissao(missao.nome);
            }

            estadoAnteriorMissoes.set(
                missao.id,
                missao.concluida
            );
        }

        // Atualiza a lista visual.
        //hud.atualizarMissoes(minhasMissoes);

        const direcaoOlhar = {
            x: Math.sin(anguloHorizontal),
            z: -Math.cos(anguloHorizontal)
        };

        // Encontra o jogador local.
        const meuJogador = (estado.jogadores ?? []).find(
            jogador => String(jogador.id) === String(meuId)
        );

        // Verifica proximidade.
        const objetoProximo = meuJogador
            ? obterObjetoInterativoProximo(
                meuJogador,
                objetosInterativos,
                direcaoOlhar,
                2,
                35
            )
            : null;

        //hud.atualizarInteracao(objetoProximo);

        try {

            const deltaSegundos = tempoAnterior === null
                ? 0
                : Math.min((tempoAtual - tempoAnterior) / 1000, 0.05);

            tempoAnterior = tempoAtual;

            const idsAtivos = new Set();

            for (const jogador of estado.jogadores ?? []) {
                // Nossa câmera é FPS: só desenhamos os outros jogadores.
                if (String(jogador.id) === String(meuId)) {
                    continue;
                }

                const id = String(jogador.id);
                idsAtivos.add(id);

                let animador = animadores.get(id);

                if (!animador) {
                    animador = criarAnimadorGLB(personagemGLB);
                    animador.tocar('Idle');
                    animadores.set(id, animador);
                }

                const proximaAnimacao = escolherAnimacao(
                    jogador.teclas
                );

                // Evita reiniciar a animação a cada quadro.
                if (animador.obterAnimacaoAtual() !== proximaAnimacao) {
                    console.log(
                        `[ANIMAÇÃO] Jogador ${id}:`,
                        animador.obterAnimacaoAtual(),
                        '→',
                        proximaAnimacao,
                        jogador.teclas
                    );

                    animador.tocar(proximaAnimacao);
                }

                animador.atualizar(deltaSegundos);

                renderizador.definirMatrizesOssos(
                    id,
                    animador.obterMatrizesOssos()
                );
            }

            // Limpa animadores de jogadores que saíram.
            for (const id of animadores.keys()) {
                if (!idsAtivos.has(id)) {
                    animadores.delete(id);
                    renderizador.removerMatrizesOssos(id);
                }
            }

            renderizador.desenhar(
                estado.jogadores,
                meuId,
                obterOrientacao()
            );
        } catch (erro) {
            console.error('Erro ao renderizar personagem:', erro);
        } finally {
            requestAnimationFrame(desenharQuadro);
        }
    }
    requestAnimationFrame(desenharQuadro);
}

iniciarJogo();