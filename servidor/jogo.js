import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TaskProximidade } from './tasks/TaskProximidade.js';
import { carregarColisoesOBJ } from './colisaoOBJ.js';
import { Predio } from '../compartilhado/estruturaPredio.js';
import { MAPA, obterObjetosMapa } from '../compartilhado/mapa.js';

const DIRETORIO_ATUAL = path.dirname(
    fileURLToPath(import.meta.url)
);

// Configurações do jogo.
export const CONFIGURACAO = Object.freeze({
    maximoJogadores: 2,

    atualizacoesPorSegundo: 30,
    estadosPorSegundo: 15,

    velocidade: 3,
    tamanhoCubo: 0.8,

    tempoLimiteEntradaMs: 250,
    maximoEntradasPorSegundo: 30,

    distanciaMaximaPasso: 0.05
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

        this.predio = new Predio('CCT');

        this.andar = this.predio.criarAndar('Andar00');

        // Armazena as geometrias OBJ carregadas.
        this.modelosColisao = new Map();

        // Armazena todas as instâncias com colisão.
        this.instanciasColisao = [];

        this.inicializado = false;
    }

    async inicializar() {
        // Primeiro cria as salas.
        for (const descricao of MAPA) {
            this.andar.criarSala(descricao.nome);
        }

        // Depois registra cada objeto em sua sala.
        for (const descricao of obterObjetosMapa()) {

            const sala = this.andar.salas[descricao.sala];

            const objeto = sala.criarObjeto(
                descricao.nome,
                descricao.modelo,
                descricao.solido
            );

            objeto.posicao = {
                x: descricao.x,
                y: descricao.y,
                z: descricao.z
            };

            objeto.rotacaoY = descricao.rotacaoY ?? 0;

            if (!objeto.temColisao) continue;

            // Reutiliza a geometria se já estiver carregada.
            if (!this.modelosColisao.has(descricao.modelo)) {
                const caminho = path.resolve(
                    DIRETORIO_ATUAL,
                    '../cliente/modelosOBJ',
                    descricao.modelo
                );

                const geometria =
                    await carregarColisoesOBJ(caminho);

                this.modelosColisao.set(
                    descricao.modelo,
                    geometria
                );
            }

            const geometria = this.modelosColisao.get(
                descricao.modelo
            );

            objeto.aabb = geometria.colisores;
            objeto.colisaoOBJ = geometria;

            this.instanciasColisao.push(objeto);
        }

        this.inicializado = true;
    }


    adicionarJogador(conexao) {
        if (!this.inicializado) {
            return null;
        }

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

        const posicoesIniciais = [
            { x: 28.5, y: 0, z: 8 },
            { x: 30.5, y: 0, z: 8 },
            { x: 29.5, y: 0, z: 6 },
            { x: 29.5, y: 0, z: 10 }
        ];

        const posicao = posicoesIniciais.find(posicao =>
            this.podeOcupar(
                { id: -1, y: posicao.y, andar: 'Andar00', sala: 'Sala001' },
                posicao.x,
                posicao.z
            )
        );

        if (!posicao) {
            console.warn('[Jogo] Nenhuma posição inicial disponível.');
            return null;
        }

        // Posições livres no interior de SalaGenerica.obj.
        const jogador = {
            id: this.proximoId++,
            cubo,
            conexao,
            
            x: posicao.x,
            y: posicao.y,
            z: posicao.z,

            teclas: { ...TECLAS_SOLTAS },

            ultimaSequencia: -1,
            instanteUltimaEntrada: agora,

            inicioJanelaTaxa: agora,
            contagemEntradas: 0,

            anguloHorizontal: 0,

            // Localização na estrutura do prédio.
            andar: 'Andar00',
            sala: 'Sala001'
        };

        this.jogadores.set(jogador.id, jogador);

        // Uma task para cada jogador.
        const taskId = `task_energia_${jogador.id}`;

        this.tasks.set(
            taskId,
            new TaskProximidade({
                id: taskId,
                jogadorId: jogador.id,

                x: cubo === 0 ? 28 : 31,
                z: 10,

                tempoNecessario: 3
            })
        );

        console.log(
            `[Jogo] Jogador ${jogador.id} conectado em ` +
            `(${jogador.x}, ${jogador.z})`
        );

        return jogador;
    }

    removerJogador(id) {
        this.jogadores.delete(id);

        for (const [taskId, task] of this.tasks.entries()) {
            if (task.jogadorId === id) {
                this.tasks.delete(taskId);
            }
        }
    }

    // Receber input do cliente

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
            !TECLAS_PERMITIDAS.every(
                tecla =>
                    Object.hasOwn(teclas, tecla) &&
                    typeof teclas[tecla] === 'boolean'
            )
        ) {
            return false;
        }

        const agora = Date.now();

        // Reinicia janela de limite de entradas.
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

        if (!task) {
            return false;
        }

        return task.processarAcao(jogador, mensagem);
    }

    // Validação de colisão
    podeOcupar(jogador, x, z) {
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(z)
        ) {
            return false;
        }

        // Colisão entre os jogadores.
        for (const outro of this.jogadores.values()) {
            if (outro.id === jogador.id) {
                continue;
            }

            if (
                Math.abs(x - outro.x) <
                    CONFIGURACAO.tamanhoCubo &&
                Math.abs(z - outro.z) <
                    CONFIGURACAO.tamanhoCubo
            ) {
                return false;
            }
        }

        // Obtém a sala correspondente ao jogador.
        const andar = this.predio.andares[jogador.andar];

        if (!andar) {
            return false;
        }

        const sala = andar.salas[jogador.sala];

        if (!sala) {
            return false;
        }

        // Colisão com os OBJ da sala.
        for (const objeto of Object.values(sala.objetos)) {
            if (
                !objeto.temColisao ||
                !objeto.colisaoOBJ
            ) {
                continue;
            }

            const {
                x: objetoX,
                y: objetoY,
                z: objetoZ
            } = objeto.posicao;

            // Transforma posição global em local.
            const xLocal = x - objetoX;
            const yLocal = jogador.y - objetoY;
            const zLocal = z - objetoZ;

            if (
                objeto.colisaoOBJ.posicaoBloqueada(
                    xLocal,
                    yLocal,
                    zLocal
                )
            ) {
                return false;
            }
        }

        return true;
    }

    // Movimentar se colidiu, deslizamento de personagem
    movimentarComColisao(jogador, dx, dz) {
        const distancia = Math.hypot(dx, dz);

        if (distancia === 0) {
            return;
        }

        const quantidadePassos = Math.ceil(
            distancia /
            CONFIGURACAO.distanciaMaximaPasso
        );

        const passoX = dx / quantidadePassos;
        const passoZ = dz / quantidadePassos;

        for (let i = 0; i < quantidadePassos; i++) {
            // Primeiro tenta no eixo X.
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

            // Depois tenta no eixo Z.
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

    atualizar(tempoDecorrido) {
        if (!this.inicializado) {
            return;
        }

        // Evita saltos de movimento por atrasos.
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

            // Movimento relativo à câmera FPS.
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

            // Não interrompe a atualização das tasks.
            if (comprimento === 0) {
                continue;
            }

            // Normaliza para não acelerar na diagonal.
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

            this.movimentarComColisao(
                jogador,
                dx,
                dz
            );
        }

        // Tasks atualizam independentemente do WASD.
        for (const task of this.tasks.values()) {
            const dono =
                task.jogadorId !== null
                    ? this.jogadores.get(task.jogadorId)
                    : null;

            task.atualizar(
                tempoDecorrido,
                dono
            );
        }

        this.passo++;
    }

    // Estado enviado aos clientes
    criarEstado() {
        return {
            tipo: 'estado',
            passo: this.passo,

            jogadores: [
                ...this.jogadores.values()
            ].map(jogador => ({
                id: jogador.id,
                cubo: jogador.cubo,

                x: Number(jogador.x.toFixed(4)),
                z: Number(jogador.z.toFixed(4))
            })),

            tasks: [
                ...this.tasks.values()
            ].map(task => task.serializar())
        };
    }
}
