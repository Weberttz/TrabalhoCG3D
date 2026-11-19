import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TaskProximidade } from './tasks/TaskProximidade.js';
import { carregarColisoesOBJ } from './colisaoOBJ.js';

// Diretório do arquivo atual.
const DIRETORIO_ATUAL = path.dirname(
    fileURLToPath(import.meta.url)
);

// Caminho absoluto do modelo OBJ.
const CAMINHO_OBJ = path.resolve(
    DIRETORIO_ATUAL,
    '../cliente/modelosOBJ/SalaGenerica.obj'
);

// Configurações oficiais do servidor.
export const CONFIGURACAO = Object.freeze({
    maximoJogadores: 2,

    atualizacoesPorSegundo: 30,
    estadosPorSegundo: 15,

    velocidade: 3,

    tamanhoCubo: 0.8,

    tempoLimiteEntradaMs: 250,
    maximoEntradasPorSegundo: 30,

    distanciaMaximaPasso: 0.05,

    // Limites internos da sala mostrada no OBJ.
    limitesSala: Object.freeze({
        minimoX: 26.4,
        maximoX: 32.6,
        minimoZ: 4.4,
        maximoZ: 11.6
    })
});

const TECLAS_PERMITIDAS = ['w', 'a', 's', 'd'];

const TECLAS_SOLTAS = Object.freeze({
    w: false,
    a: false,
    s: false,
    d: false
});

const limitar = (valor, minimo, maximo) =>
    Math.max(minimo, Math.min(maximo, valor));

export class Jogo {

    constructor() {
        this.jogadores = new Map();
        this.proximoId = 1;
        this.passo = 0;

        this.tasks = new Map();

        // Será carregado durante a inicialização.
        this.colisoes = null;
    }

    // ==========================================
    // INICIALIZAÇÃO DAS COLISÕES
    // ==========================================

    async inicializar() {
        this.colisoes = await carregarColisoesOBJ(
            CAMINHO_OBJ
        );

        for(const colisao of this.colisoes.colisores){
          console.log(colisao.nome)
        }
    }

    // ==========================================
    // ADICIONAR JOGADOR
    // ==========================================

    adicionarJogador(conexao) {
        if (!this.colisoes) return null;

        if (
            this.jogadores.size >=
            CONFIGURACAO.maximoJogadores
        ) {
            return null;
        }

        const cubosOcupados = new Set(
            [...this.jogadores.values()].map(
                jogador => jogador.cubo
            )
        );

        const cubo = cubosOcupados.has(0) ? 1 : 0;

        const agora = Date.now();

        // Posições dentro da sala original.
        const xInicial = cubo === 0 ? 28.5 : 30.5;
        const zInicial = 8;

        const jogador = {
            id: this.proximoId++,
            cubo,
            conexao,

            x: xInicial,
            y: 0,
            z: zInicial,

            teclas: { ...TECLAS_SOLTAS },

            ultimaSequencia: -1,
            instanteUltimaEntrada: agora,

            inicioJanelaTaxa: agora,
            contagemEntradas: 0,

            anguloHorizontal: 0
        };

        // Não permite nascer dentro de obstáculos.
        if (!this.podeOcupar(
            jogador,
            jogador.x,
            jogador.z
        )) {
            console.error(
                '[Jogo] Posição inicial bloqueada:',
                jogador.x,
                jogador.z
            );

            return null;
        }

        this.jogadores.set(jogador.id, jogador);

        // ======================================
        // TASK DO JOGADOR
        // ======================================

        const taskId = `task_energia_${jogador.id}`;

        const posX = cubo === 0 ? 28 : 31;
        const posZ = 10;

        this.tasks.set(
            taskId,
            new TaskProximidade({
                id: taskId,
                jogadorId: jogador.id,
                x: posX,
                z: posZ,
                tempoNecessario: 3
            })
        );

        console.log(
            `[Jogo] Jogador ${jogador.id} criado em ` +
            `(${jogador.x}, ${jogador.z})`
        );

        return jogador;
    }

    // ==========================================
    // REMOVER JOGADOR
    // ==========================================

    removerJogador(id) {
        this.jogadores.delete(id);

        for (const [taskId, task] of this.tasks.entries()) {
            if (task.jogadorId === id) {
                this.tasks.delete(taskId);
            }
        }

        // Não diminuímos proximoId:
        // os IDs devem continuar únicos.
    }

    // ==========================================
    // RECEBER ENTRADA DO CLIENTE
    // ==========================================

    receberEntrada(id, mensagem) {
        const jogador = this.jogadores.get(id);

        if (
            !jogador ||
            !mensagem ||
            typeof mensagem !== 'object' ||
            Array.isArray(mensagem)
        ) {
            return false;
        }

        if (
            Object.keys(mensagem).length !== 4 ||
            !Object.hasOwn(mensagem, 'anguloHorizontal') ||
            typeof mensagem.anguloHorizontal !== 'number' ||
            !Number.isFinite(mensagem.anguloHorizontal) ||
            mensagem.anguloHorizontal < -Math.PI ||
            mensagem.anguloHorizontal > Math.PI ||
            mensagem.tipo !== 'entrada' ||
            !Number.isSafeInteger(mensagem.sequencia) ||
            mensagem.sequencia <= jogador.ultimaSequencia
        ) {
            return false;
        }

        const teclas = mensagem.teclas;

        if (
            !teclas ||
            typeof teclas !== 'object' ||
            Array.isArray(teclas) ||
            Object.keys(teclas).length !== 4 ||
            !TECLAS_PERMITIDAS.every(tecla =>
                Object.hasOwn(teclas, tecla) &&
                typeof teclas[tecla] === 'boolean'
            )
        ) {
            return false;
        }

        const agora = Date.now();

        if (
            agora - jogador.inicioJanelaTaxa >= 1000
        ) {
            jogador.inicioJanelaTaxa = agora;
            jogador.contagemEntradas = 0;
        }

        if (
            jogador.contagemEntradas >=
            CONFIGURACAO.maximoEntradasPorSegundo
        ) {
            return false;
        }

        jogador.contagemEntradas++;

        jogador.ultimaSequencia = mensagem.sequencia;
        jogador.instanteUltimaEntrada = agora;

        jogador.teclas = { ...teclas };
        jogador.anguloHorizontal = mensagem.anguloHorizontal;

        return true;
    }

    // ==========================================
    // AÇÕES DAS TASKS
    // ==========================================

    receberAcaoTask(jogadorId, mensagem) {
        const jogador = this.jogadores.get(jogadorId);

        if (
            !jogador ||
            !mensagem ||
            typeof mensagem.taskId !== 'string'
        ) {
            return false;
        }

        const task = this.tasks.get(mensagem.taskId);

        if (!task) return false;

        return task.processarAcao(jogador, mensagem);
    }

    // ==========================================
    // VERIFICAÇÃO DE COLISÃO
    // ==========================================

    podeOcupar(jogador, x, z) {
        const limites = CONFIGURACAO.limitesSala;

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(z)
        ) {
            return false;
        }

        // Limites da sala.
        if (
            x < limites.minimoX ||
            x > limites.maximoX ||
            z < limites.minimoZ ||
            z > limites.maximoZ
        ) {
            return false;
        }

        // Colisão entre jogadores.
        for (const outro of this.jogadores.values()) {
            if (outro.id === jogador.id) continue;

            if (
                Math.abs(x - outro.x) <
                    CONFIGURACAO.tamanhoCubo &&
                Math.abs(z - outro.z) <
                    CONFIGURACAO.tamanhoCubo
            ) {
                return false;
            }
        }

        // Colisão com geometria OBJ.
        if (
            this.colisoes?.posicaoBloqueada(
                x,
                jogador.y,
                z
            )
        ) {
            return false;
        }

        return true;
    }

    // ==========================================
    // MOVIMENTAÇÃO COM COLISÃO
    // ==========================================

    movimentarComColisao(jogador, dx, dz) {
        const distancia = Math.hypot(dx, dz);

        if (distancia === 0) return;

        // Divide o deslocamento para evitar atravessar
        // obstáculos finos entre dois frames.
        const quantidadePassos = Math.ceil(
            distancia /
            CONFIGURACAO.distanciaMaximaPasso
        );

        const passoX = dx / quantidadePassos;
        const passoZ = dz / quantidadePassos;

        for (let i = 0; i < quantidadePassos; i++) {

            // Primeiro tenta movimentar no eixo X.
            const novoX = jogador.x + passoX;

            if (
                this.podeOcupar(
                    jogador,
                    novoX,
                    jogador.z
                )
            ) {
                jogador.x = novoX;
            }

            // Depois tenta movimentar no eixo Z.
            const novoZ = jogador.z + passoZ;

            if (
                this.podeOcupar(
                    jogador,
                    jogador.x,
                    novoZ
                )
            ) {
                jogador.z = novoZ;
            }
        }
    }

    // ==========================================
    // LOOP DE ATUALIZAÇÃO
    // ==========================================

    atualizar(tempoDecorrido) {
        if (!this.colisoes) return;

        // Evita deslocamentos enormes em atrasos do loop.
        tempoDecorrido = limitar(
            tempoDecorrido,
            0,
            0.05
        );

        const agora = Date.now();

        for (const jogador of this.jogadores.values()) {

            const teclas =
                agora - jogador.instanteUltimaEntrada <=
                CONFIGURACAO.tempoLimiteEntradaMs
                    ? jogador.teclas
                    : TECLAS_SOLTAS;

            const lateral =
                Number(teclas.d) - Number(teclas.a);

            const frente =
                Number(teclas.w) - Number(teclas.s);

            const angulo = jogador.anguloHorizontal;

            // Movimentação relativa à direção da câmera.
            let direcaoX =
                lateral * Math.cos(angulo) +
                frente * Math.sin(angulo);

            let direcaoZ =
                lateral * Math.sin(angulo) -
                frente * Math.cos(angulo);

            const comprimento = Math.hypot(
                direcaoX,
                direcaoZ
            );

            if (comprimento === 0) continue;

            // Evita velocidade extra na diagonal.
            direcaoX /= comprimento;
            direcaoZ /= comprimento;

            const dx =
                direcaoX *
                CONFIGURACAO.velocidade *
                tempoDecorrido;

            const dz =
                direcaoZ *
                CONFIGURACAO.velocidade *
                tempoDecorrido;

            // Agora utiliza a função de colisão!
            this.movimentarComColisao(
                jogador,
                dx,
                dz
            );
        }

        // Atualiza as tasks independentemente
        // de os jogadores estarem se movimentando.
        for (const task of this.tasks.values()) {
            const dono = task.jogadorId !== null
                ? this.jogadores.get(task.jogadorId)
                : null;

            task.atualizar(tempoDecorrido, dono);
        }

        this.passo++;
    }

    // ==========================================
    // ESTADO ENVIADO AOS CLIENTES
    // ==========================================

    criarEstado() {
        return {
            tipo: 'estado',
            passo: this.passo,

            jogadores: [
                ...this.jogadores.values()
            ].map(({
                id,
                cubo,
                x,
                z
            }) => ({
                id,
                cubo,
                x: Number(x.toFixed(4)),
                z: Number(z.toFixed(4))
            })),

            tasks: [
                ...this.tasks.values()
            ].map(task => task.serializar())
        };
    }
}
