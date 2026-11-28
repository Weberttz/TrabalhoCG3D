import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TaskProximidade } from './tasks/TaskProximidade.js';
import { carregarColisoesOBJ } from './colisaoOBJ.js';
import { Predio } from '../compartilhado/estruturaPredio.js';
import {
    MAPA,
    obterAlvosPorta,
    obterObjetoInterativoProximo,
    obterObjetosMapa,
    obterSalaEmPosicao
} from '../compartilhado/mapa.js';
import { TaskJogarLixo } from './tasks/TaskJogarLixo.js';
import { catalogarNC2A } from '../compartilhado/classificadorNC2A.js';

const MUSICAS_RADIO = [
    '/audios/Reflections.mp3',
    '/audios/DoIWannaKnow.mp3',
    '/audios/DarkRed.mp3',
    '/audios/ForroDaPisadinha.mp3'
];

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
        this.portas = new Map();
        this.paresPortas = new Map();

        this.predio = new Predio('NC2A');

        this.andar = this.predio.criarAndar('Andar00');

        // Armazena as geometrias OBJ carregadas.
        this.modelosColisao = new Map();

        // Armazena todas as instâncias com colisão.
        this.instanciasColisao = [];

        this.inicializado = false;

        this.radio = {
            ligado: false,
            indice: 0,
            iniciadoEm: 0,
            versao: 0
        };
    }

    async inicializar() {

        // 1. Carrega a estrutura principal do prédio apenas uma vez.
        const caminhoEstrutura = path.resolve(
            DIRETORIO_ATUAL,
            '../cliente/modelosOBJ/nc2a.obj'
        );

        const geometriaEstrutura =
            await carregarColisoesOBJ(caminhoEstrutura);

        this.modelosColisao.set(
            'nc2a.obj',
            geometriaEstrutura
        );

        // 2. Identifica automaticamente os andares,
        // salas, paredes e portas a partir do OBJ.
        this.catalogo = catalogarNC2A(
            geometriaEstrutura.nomesObjetos
        );

        // 3. Cria a estrutura hierárquica no servidor.
        for (const descricaoAndar of Object.values(
            this.catalogo.andares
        )) {
            const andar = this.predio.criarAndar(
                descricaoAndar.nome
            );

            for (const descricaoSala of Object.values(
                descricaoAndar.salas
            )) {
                const sala = andar.criarSala(
                    descricaoSala.nome,
                    descricaoSala.categoria
                );

                sala.partesEstruturais =
                    descricaoSala.partesEstruturais;

                sala.portas = descricaoSala.portas;
            }
        }

        // 4. Aplica as configurações específicas de cada
        // sala, incluindo categoria, âncora e limites.
        for (const descricao of MAPA) {
            const nomeAndar = descricao.andar ?? 'Andar00';

            const andar = this.predio.criarAndar(nomeAndar);

            const sala = andar.criarSala(
                descricao.nome,
                descricao.categoria ?? 'generica'
            );

            sala.ancora = descricao.ancora ?? null;
            sala.limites = descricao.area ?? null;

            const registroCatalogo =
                this.catalogo.andares[nomeAndar]
                    ?.salas[descricao.nome];

            if (registroCatalogo && descricao.categoria) {
                registroCatalogo.categoria = descricao.categoria;
            }
        }

        // 5. Registra a mobília e os objetos interativos
        // dentro de seus respectivos andares e salas.
        for (const descricao of obterObjetosMapa()) {
            const nomeAndar = descricao.andar ?? 'Andar00';

            const andar = this.predio.criarAndar(nomeAndar);

            const sala = andar.criarSala(descricao.sala);

            let objeto;

            if (descricao.item) {
                objeto = sala.criarItem(
                    descricao.nome,
                    descricao.modelo ?? null,
                    descricao.solido ?? false,
                    descricao.podePegar ?? true
                );
            } else if (descricao.interativo) {
                objeto = sala.criarObjetoInterativo(
                    descricao.nome,
                    descricao.modelo,
                    descricao.solido
                );
            } else {
                objeto = sala.criarObjeto(
                    descricao.nome,
                    descricao.modelo,
                    descricao.solido
                );
            }

            objeto.ehBloco = Boolean(descricao.ehBloco);
            objeto.cor = descricao.cor ?? [1, 1, 1];
            objeto.tamanho = descricao.tamanho ?? 0.8;

            objeto.posicao = {
                x: descricao.x,
                y: descricao.y,
                z: descricao.z
            };

            objeto.rotacaoY = descricao.rotacaoY ?? 0;
            objeto.escala = descricao.escala ?? 1;

            // Objetos sem colisão não precisam carregar
            // geometria de colisão.
            if (
                !objeto.temColisao ||
                objeto.ehBloco ||
                !descricao.modelo
            ) {
                continue;
            }

            // Modelos iguais compartilham a mesma geometria.
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

        this.criarPortasDaEstrutura();

        // Diagnóstico.
        for (const andar of Object.values(
            this.predio.andares
        )) {
            console.log(
                `[NC2A] ${andar.nome}:`,
                Object.keys(andar.salas).length,
                'salas'
            );

            for (const sala of Object.values(andar.salas)) {
                console.log(
                    `  ${sala.nome}`,
                    `[${sala.categoria}]`,
                    `${Object.keys(sala.objetos).length} objetos`
                );
            }
        }

        const destinoLixo = this.andar.salas.Sala002.objetos.lixeira01.posicao;
        const taskLixo = new TaskJogarLixo({
            id: 'task_lixo_sala002',
            jogadorId: null,
            x: destinoLixo.x,
            z: destinoLixo.z
        });
        this.tasks.set(taskLixo.id, taskLixo);

        // 1. Interagir com a mesa atribui a task ao jogador (muda para EM_ANDAMENTO)
        this.definirFuncaoInteracao(
            'Sala002',
            'mesaEscritorio01',
            (objeto, jogador) => {
                if (taskLixo.status === 'pendente') {
                    taskLixo.atribuirPara(jogador);
                }
            }
        );

        // 2. Interagir com a lixeira conclui a task (muda para CONCLUIDA)
        this.definirFuncaoInteracao('Sala002', 'lixeira01', (objeto, jogador) => {
            taskLixo.descartarLixo(jogador);
        });

        this.definirFuncaoInteracao(
            'Sala002',
            'radio01',
            () => {
                this.radio.ligado = !this.radio.ligado;
                this.radio.versao++;

                if (this.radio.ligado) {
                    this.radio.iniciadoEm = Date.now();
                } else {
                    this.radio.iniciadoEm = 0;
                }

                console.log(
                    '[RÁDIO]',
                    this.radio.ligado ? 'Ligado' : 'Desligado'
                );
            }
        );

        this.configurarEventosItem('Sala002', 'blocoTeste01', {
            aoPegar: (item, jogador) => {
                console.log(`[Item] Jogador ${jogador.id} pegou "${item.nome}"`);
            },
            aoSoltar: (item, jogador) => {
                console.log(`[Item] "${item.nome}" foi solto em (${item.posicao.x}, ${item.posicao.z})`);
            }
        });

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
            { x: 27.5, y: 0, z: 2.5 },
            { x: 29.0, y: 0, z: 2.5 },
            { x: 23.5, y: 0, z: 2.5 },
            { x: 35.0, y: 0, z: 2.5 }
        ];

        const posicao = posicoesIniciais.find(posicao =>
            this.podeOcupar(
                { id: -1, y: posicao.y, andar: 'Andar00', sala: 'nc2a' },
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
            sala: 'nc2a'
        };

        this.jogadores.set(jogador.id, jogador);

        // Uma task para cada jogador.
        const taskId = `task_energia_${jogador.id}`;

        this.tasks.set(
            taskId,
            new TaskProximidade({
                id: taskId,
                jogadorId: jogador.id,

                x: cubo === 0 ? 25.55 : 29.85,
                z: 6.35,

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
                if (task.id === 'task_lixo_sala002') {
                    task.liberar();
                } else {
                    this.tasks.delete(taskId);
                }
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

    interagirComObjetoProximo(jogadorId, raioMaximo = 2.0) {
        const jogador = this.jogadores.get(jogadorId);
        if (!jogador) return false;

        const andar = this.predio.andares[jogador.andar];
        if (!andar) return false;

        let objetoMaisProximo = null;
        let menorDistancia = raioMaximo;

        for (const sala of Object.values(andar.salas)) {
            for (const objeto of Object.values(sala.objetos)) {
                if (typeof objeto.interagir !== 'function') continue;
                if (objeto.visivel === false) continue;
                if ('podePegar' in objeto && !objeto.podePegar) continue;

                let alvoX = objeto.posicao.x;
                let alvoZ = objeto.posicao.z;

                if (objeto.aabb && objeto.aabb.length > 0) {
                    const caixa = objeto.aabb[0];
                    alvoX += (caixa.minimoX + caixa.maximoX) / 2;
                    alvoZ += (caixa.minimoZ + caixa.maximoZ) / 2;
                }

                const distancia = Math.hypot(jogador.x - alvoX, jogador.z - alvoZ);

                if (distancia <= menorDistancia) {
                    menorDistancia = distancia;
                    objetoMaisProximo = objeto;
                }
            }
        }

        if (!objetoMaisProximo) {
            console.log(`[Jogo] Jogador ${jogadorId} apertou 'E', mas não há objeto interativo por perto.`);
            return false;
        }

        console.log(`[Jogo] Jogador ${jogadorId} interagiu com "${objetoMaisProximo.nome}" (distância: ${menorDistancia.toFixed(2)}m)`);
        objetoMaisProximo.interagir(jogador);
        return true;
    }


    criarPortasDaEstrutura() {
        const estrutura = this.andar.salas['nc2a']
            ?.objetos['nc2a_estrutura'];

        if (!estrutura?.colisaoOBJ) {
            throw new Error('Estrutura nc2a não encontrada.');
        }

        const nomesPortas = new Set();
        for (const andar of Object.values(this.catalogo.andares)) {
            for (const sala of Object.values(andar.salas)) {
                for (const nome of sala.portas) nomesPortas.add(nome);
            }
        }

        const { x: origemX, y: origemY, z: origemZ } = estrutura.posicao;
        for (const caixa of estrutura.colisaoOBJ.colisores) {
            if (!nomesPortas.has(caixa.nome)) continue;

            const centroX = (caixa.minimoX + caixa.maximoX) / 2;
            const centroY = (caixa.minimoY + caixa.maximoY) / 2;
            const centroZ = (caixa.minimoZ + caixa.maximoZ) / 2;
            const larguraX = caixa.maximoX - caixa.minimoX;
            const larguraZ = caixa.maximoZ - caixa.minimoZ;
            const portaNoEixoX = larguraX >= larguraZ;

            // As folhas de cada par usam as bordas opostas do vão.
            const sufixoFolha = caixa.nome.match(/__(Min|Max)$/);
            const par = sufixoFolha ? caixa.nome.slice(0, sufixoFolha.index) : null;
            const naBordaMaxima = sufixoFolha?.[1] === 'Max';
            const borda = naBordaMaxima ? 'maximo' : 'minimo';
            const pivoX = portaNoEixoX ? caixa[`${borda}X`] : centroX;
            const pivoZ = portaNoEixoX ? centroZ : caixa[`${borda}Z`];
            const sentidoBase = portaNoEixoX
                ? (centroZ >= 0 ? -1 : 1)
                : (centroX >= 0 ? 1 : -1);
            const sentido = naBordaMaxima ? -sentidoBase : sentidoBase;

            const porta = {
                nome: caixa.nome,
                par,
                x: centroX + origemX,
                y: centroY + origemY,
                z: centroZ + origemZ,
                pivoX,
                pivoZ,
                sentido,
                centroAberto: {
                    x: origemX + pivoX + sentido * (centroZ - pivoZ),
                    z: origemZ + pivoZ - sentido * (centroX - pivoX)
                },
                aberta: false,
                ultimaInteracaoEm: 0
            };

            this.portas.set(porta.nome, porta);
            if (par) {
                const folhas = this.paresPortas.get(par) ?? [];
                folhas.push(porta);
                this.paresPortas.set(par, folhas);
            }
        }

        for (const [folha, outraFolha] of this.paresPortas.values()) {
            if (!outraFolha) continue;
            const centroPar = {
                x: (folha.x + outraFolha.x) / 2,
                z: (folha.z + outraFolha.z) / 2
            };
            folha.centroPar = centroPar;
            outraFolha.centroPar = centroPar;
        }

        console.log(`[PORTAS] ${this.portas.size} portas encontradas.`);
    }

    alternarPorta(jogadorId, nomePorta) {
        const jogador = this.jogadores.get(jogadorId);
        const porta = this.portas.get(nomePorta);
        if (!jogador || !porta) return false;

        // O cliente usa os mesmos alvos no indicador de interação.
        const direcaoOlhar = {
            x: Math.sin(jogador.anguloHorizontal),
            z: -Math.cos(jogador.anguloHorizontal)
        };
        const alvos = obterAlvosPorta(porta, jogador);
        if (!obterObjetoInterativoProximo(jogador, alvos, direcaoOlhar)) {
            return false;
        }

        const agora = Date.now();
        if (agora - porta.ultimaInteracaoEm < 350) return false;

        const folhas = this.paresPortas.get(porta.par) ?? [porta];
        const aberta = !porta.aberta;
        const novoEstado = new Map(this.portas);
        for (const folha of folhas) {
            novoEstado.set(folha.nome, { ...folha, aberta });
        }

        // As duas folhas mudam juntas. Nenhuma delas pode prender um jogador.
        const estrutura = this.andar.salas.nc2a.objetos.nc2a_estrutura;
        for (const ocupante of this.jogadores.values()) {
            const colisor = estrutura.colisaoOBJ.detectarColisao(
                ocupante.x - estrutura.posicao.x,
                ocupante.y - estrutura.posicao.y,
                ocupante.z - estrutura.posicao.z,
                novoEstado
            );
            if (folhas.some(folha => folha.nome === colisor?.nome)) return false;
        }

        for (const folha of folhas) {
            folha.ultimaInteracaoEm = agora;
            folha.aberta = aberta;
        }

        console.log(`[PORTA] ${porta.par ?? porta.nome}:`, aberta ? 'Aberta' : 'Fechada');
        return true;
    }

    definirFuncaoInteracao(nomeSala, nomeObjeto, funcaoDeInteracao) {
        const objeto = this.andar.salas[nomeSala]?.objetos[nomeObjeto];
        if (!objeto || typeof objeto.interagir !== 'function') return false;

        objeto.acao = funcaoDeInteracao;
        return true;
    }

    configurarEventosItem(nomeSala, nomeItem, eventos) {
        const item = this.obterItem(nomeSala, nomeItem);
        if (!item) return false;

        item.configurarEventos(eventos);
        return true;
    }

    obterItem(nomeSala, nomeItem) {
        const objeto = this.andar.salas[nomeSala]?.objetos[nomeItem];
        return objeto && 'podePegar' in objeto ? objeto : null;
    }

    soltarItemJogador(jogadorId, posicao, podePegar = true) {
        const jogador = this.jogadores.get(jogadorId);
        if (!jogador || !jogador.itemSegurado) return false;

        for (const andar of Object.values(this.predio.andares)) {
            for (const sala of Object.values(andar.salas)) {
                const item = sala.objetos[jogador.itemSegurado];

                if (item && typeof item.soltar === 'function') {
                    item.soltar(
                        posicao ?? {
                            x: jogador.x,
                            y: jogador.y + 0.2,
                            z: jogador.z
                        },
                        podePegar,
                        jogador
                    );

                    jogador.itemSegurado = null;
                    return true;
                }
            }
        }
        return false;
    }

    podeControlarRadio(jogadorId) {
        const jogador = this.jogadores.get(jogadorId);

        const radio = this.predio.andares['Andar00']
            ?.salas['Sala002']
            ?.objetos['radio01'];

        if (!jogador || !radio) {
            return false;
        }

        if (jogador.andar !== 'Andar00') {
            return false;
        }

        const dx = radio.posicao.x - jogador.x;
        const dz = radio.posicao.z - jogador.z;

        const distancia = Math.hypot(dx, dz);

        // Somente jogadores a até 2 metros.
        if (distancia > 2) {
            return false;
        }

        // Exige que o jogador esteja olhando para o rádio.
        if (distancia > 0.000001) {
            const direcaoX = Math.sin(
                jogador.anguloHorizontal
            );

            const direcaoZ = -Math.cos(
                jogador.anguloHorizontal
            );

            const alinhamento =
                (direcaoX * dx + direcaoZ * dz) / distancia;

            const limite = Math.cos(35 * Math.PI / 180);

            if (alinhamento < limite) {
                return false;
            }
        }

        return true;
    }

    proximaMusicaRadio(jogadorId) {
        if (!this.radio.ligado) {
            return false;
        }

        if (!this.podeControlarRadio(jogadorId)) {
            return false;
        }

        this.radio.indice =
            (this.radio.indice + 1) % MUSICAS_RADIO.length;

        this.radio.iniciadoEm = Date.now();
        this.radio.versao++;

        console.log(
            '[RÁDIO] Nova faixa:',
            MUSICAS_RADIO[this.radio.indice]
        );

        return true;
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

        // Todas as instâncias sólidas participam da colisão,
        // independentemente da sala à qual pertencem.
        for (const objeto of this.instanciasColisao) {
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

            const dx = x - objetoX;
            const dz = z - objetoZ;
            const c = Math.cos(objeto.rotacaoY);
            const s = Math.sin(objeto.rotacaoY);
            const escala = objeto.escala;

            // Usa a inversa da transformação aplicada pelo renderizador.
            const xLocal = (c * dx - s * dz) / escala;
            const yLocal = (jogador.y - objetoY) / escala;
            const zLocal = (s * dx + c * dz) / escala;

            const bloqueado =
                objeto.colisaoOBJ.posicaoBloqueada(
                    xLocal,
                    yLocal,
                    zLocal,

                    // As portas continuam usando seus
                    // colisores dinâmicos.
                    objeto.mesh === 'nc2a.obj' ? this.portas : null,
                    escala
                );

            if (bloqueado) {
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

        // Atualiza a localização lógica de cada jogador.
        for (const jogador of this.jogadores.values()) {
            const andar = jogador.y >= 3.5
                ? 'Andar01'
                : 'Andar00';

            jogador.andar = andar;

            jogador.sala = obterSalaEmPosicao(
                andar,
                jogador.x,
                jogador.z
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
                z: Number(jogador.z.toFixed(4)),
                y: Number(jogador.y.toFixed(4)),
                andar: jogador.andar,
                sala: jogador.sala,
                teclas: Date.now() - jogador.instanteUltimaEntrada
                    <= CONFIGURACAO.tempoLimiteEntradaMs
                    ? { ...jogador.teclas }
                    : { w: false, a: false, s: false, d: false },

                anguloHorizontal: jogador.anguloHorizontal,
            })),

            tasks: [
                ...this.tasks.values()
            ].map(task => task.serializar()),

            itens: Object.values(this.predio.andares).flatMap(
                andar =>
                    Object.values(andar.salas).flatMap(
                        sala =>
                            Object.values(sala.objetos)
                                .filter(obj => 'podePegar' in obj)
                                .map(item => ({
                                    nome: item.nome,
                                    andar: andar.nome,
                                    sala: sala.nome,

                                    ehBloco: item.ehBloco,
                                    modelo: item.mesh,
                                    cor: item.cor,
                                    tamanho: item.tamanho,

                                    x: item.posicao.x,
                                    y: item.posicao.y,
                                    z: item.posicao.z,

                                    visivel: item.visivel,
                                    podePegar: item.podePegar,
                                    seguradoPor: item.seguradoPor
                                }))
                    )
            ),

            radio: {
                ligado: this.radio.ligado,
                indice: this.radio.indice,
                musica: MUSICAS_RADIO[this.radio.indice],
                iniciadoEm: this.radio.iniciadoEm,
                versao: this.radio.versao,
                servidorAgora: Date.now()
            },
            portas: [...this.portas.values()].map(porta => ({
                nome: porta.nome,
                x: porta.x,
                y: porta.y,
                z: porta.z,
                pivoX: porta.pivoX,
                pivoZ: porta.pivoZ,
                sentido: porta.sentido,
                centroPar: porta.centroPar,
                centroAberto: porta.centroAberto,
                aberta: porta.aberta
            })),
        };
    }
}
