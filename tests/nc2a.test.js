import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obterObjetosMapa, PREDIO_NC2A } from '../compartilhado/mapa.js';
import { Jogo } from '../servidor/jogo.js';
import { carregarColisoesOBJ } from '../servidor/colisaoOBJ.js';

const EPSILON = 0.002;
const jogo = new Jogo();
await jogo.inicializar();

function limitesGlobais(caixas, { x, y, z, rotacaoY, escala = 1 }) {
    const c = Math.cos(rotacaoY) * escala;
    const s = Math.sin(rotacaoY) * escala;
    const pontos = caixas.flatMap(caixa =>
        [caixa.minimoX, caixa.maximoX].flatMap(px =>
            [caixa.minimoZ, caixa.maximoZ].map(pz => [
                x + c * px + s * pz,
                z - s * px + c * pz
            ])
        )
    );

    return {
        minX: Math.min(...pontos.map(ponto => ponto[0])),
        maxX: Math.max(...pontos.map(ponto => ponto[0])),
        minY: y + escala * Math.min(...caixas.map(caixa => caixa.minimoY)),
        maxY: y + escala * Math.max(...caixas.map(caixa => caixa.maximoY)),
        minZ: Math.min(...pontos.map(ponto => ponto[1])),
        maxZ: Math.max(...pontos.map(ponto => ponto[1]))
    };
}

function sobrepoem(a, b) {
    return ['X', 'Y', 'Z'].every(eixo =>
        Math.min(a[`max${eixo}`], b[`max${eixo}`]) -
        Math.max(a[`min${eixo}`], b[`min${eixo}`]) > EPSILON
    );
}

test('a mobília cabe nas salas e fica fora do giro das portas', async () => {
    const objetos = obterObjetosMapa().filter(objeto => objeto.modelo && objeto.sala !== 'nc2a');
    const modelos = new Map(jogo.modelosColisao);

    for (const modelo of new Set(objetos.map(objeto => objeto.modelo))) {
        if (!modelos.has(modelo)) {
            const caminho = new URL(`../cliente/modelosOBJ/${modelo}`, import.meta.url);
            modelos.set(modelo, await carregarColisoesOBJ(caminho));
        }
    }

    const caixasPortas = new Map(
        modelos.get('nc2a.obj').colisores
            .filter(caixa => jogo.portas.has(caixa.nome))
            .map(caixa => [caixa.nome, caixa])
    );
    const mobilia = objetos.map(objeto => ({
        ...objeto,
        limites: limitesGlobais(modelos.get(objeto.modelo).colisores, objeto)
    }));

    assert.equal(new Set(objetos.map(objeto => objeto.nome)).size, objetos.length);
    for (const andar of PREDIO_NC2A.andares) {
        for (const sala of andar.salas) {
            const moveis = mobilia.filter(objeto => objeto.andar === andar.nome && objeto.sala === sala.nome);
            if (sala.categoria === 'circulacao') {
                assert.equal(moveis.length, 0, sala.nome);
                continue;
            }
            assert.ok(moveis.length > 0, sala.nome);

            const piso = sala.ancora.y;
            const teto = piso === 0 ? 3.88 : 8;
            for (const [i, { nome, limites }] of moveis.entries()) {
                assert.ok(limites.minY >= piso - EPSILON && limites.maxY <= teto + EPSILON, nome);
                for (const eixo of ['X', 'Z']) {
                    assert.ok(limites[`min${eixo}`] >= sala.area[`min${eixo}`] - EPSILON, nome);
                    assert.ok(limites[`max${eixo}`] <= sala.area[`max${eixo}`] + EPSILON, nome);
                }
                for (const outro of moveis.slice(i + 1)) {
                    assert.ok(!sobrepoem(limites, outro.limites), `${nome} × ${outro.nome}`);
                }
            }
        }
    }

    for (const [nome, porta] of jogo.portas) {
        const caixa = caixasPortas.get(nome);
        const relativa = {
            ...caixa,
            minimoX: caixa.minimoX - porta.pivoX,
            maximoX: caixa.maximoX - porta.pivoX,
            minimoZ: caixa.minimoZ - porta.pivoZ,
            maximoZ: caixa.maximoZ - porta.pivoZ
        };
        for (let passo = 0; passo <= 18; passo++) {
            const giro = limitesGlobais([relativa], {
                x: porta.pivoX,
                y: 0,
                z: porta.pivoZ,
                rotacaoY: porta.sentido * Math.PI * passo / 36
            });
            for (const { nome: movel, limites } of mobilia) {
                assert.ok(!sobrepoem(giro, limites), `${nome} × ${movel}`);
            }
        }
    }
});

test('o centro de cada entrada continua transitável com a porta aberta', () => {
    for (const porta of jogo.portas.values()) {
        if (!porta.nome.includes('__Int__Porta')) continue;
        if (porta.nome.includes('__Corredor__')) continue;

        const lado = Math.sign(porta.z);
        const jogador = {
            id: -1,
            x: porta.x,
            y: porta.nome.startsWith('Andar01') ? 4 : 0,
            z: porta.z - lado * 1.25
        };

        porta.aberta = true;
        try {
            assert.ok(jogo.podeOcupar(jogador, jogador.x, jogador.z), porta.nome);
            jogo.movimentarComColisao(jogador, 0, lado * 3.5);
            assert.ok(Math.abs(jogador.z - porta.z - lado * 2.25) < EPSILON, porta.nome);
        } finally {
            porta.aberta = false;
        }
    }
});

test('a colisão acompanha a mesa girada e a escala da lousa', () => {
    const terreo = { id: -1, y: 0 };
    assert.equal(jogo.podeOcupar(terreo, 25.22, 8.15), false);
    assert.equal(jogo.podeOcupar(terreo, 26.02, 8.15), true);

    const superior = { id: -1, y: 4.01 };
    const quadro = obterObjetosMapa().find(objeto =>
        objeto.sala === 'Sala104' && objeto.modelo === 'lousa.obj'
    );
    assert.equal(jogo.podeOcupar(superior, quadro.x, quadro.z + 0.345), false);
    assert.equal(jogo.podeOcupar(superior, quadro.x, quadro.z + 0.4), true);
});

test('dois jogadores entram na Sala 002 e alcançam os objetivos', () => {
    const primeiro = jogo.adicionarJogador(null);
    const segundo = jogo.adicionarJogador(null);
    assert.ok(primeiro && segundo);
    assert.notEqual(primeiro.x, segundo.x);

    function caminhar(jogador, x, z) {
        jogo.movimentarComColisao(jogador, x - jogador.x, z - jogador.z);
        assert.ok(Math.hypot(jogador.x - x, jogador.z - z) < EPSILON, `Destino (${x}, ${z})`);
    }

    primeiro.anguloHorizontal = Math.PI;
    assert.ok(jogo.alternarPorta(primeiro.id, 'Andar00__Sala002__Int__Porta'));
    caminhar(primeiro, 27.55, 6.3);
    caminhar(primeiro, 26.85, 8);
    jogo.atualizar(0);
    assert.equal(primeiro.sala, 'Sala002');

    const lixo = jogo.tasks.get('task_lixo_sala002');
    assert.ok(jogo.interagirComObjetoProximo(primeiro.id));
    assert.equal(lixo.jogadorId, primeiro.id);

    caminhar(primeiro, 27, 10.75);
    assert.ok(jogo.interagirComObjetoProximo(primeiro.id));
    assert.equal(jogo.radio.ligado, true);
    caminhar(primeiro, 28.5, 9.35);
    assert.ok(jogo.interagirComObjetoProximo(primeiro.id));
    assert.equal(primeiro.itemSegurado, 'blocoTeste01');
    assert.ok(jogo.soltarItemJogador(primeiro.id));

    caminhar(primeiro, 29.5, 10.65);
    assert.ok(jogo.interagirComObjetoProximo(primeiro.id));
    assert.equal(lixo.status, 'concluida');

    caminhar(primeiro, 28, 10);
    caminhar(segundo, 27.55, 2.5);
    caminhar(segundo, 27.55, 6.3);
    caminhar(segundo, 29.9, 8);
    caminhar(segundo, 29.9, 10);

    for (let passo = 0; passo < 61; passo++) {
        jogo.atualizar(0.05);
    }

    assert.equal(jogo.tasks.get(`task_energia_${primeiro.id}`).status, 'concluida');
    assert.equal(jogo.tasks.get(`task_energia_${segundo.id}`).status, 'concluida');
});
