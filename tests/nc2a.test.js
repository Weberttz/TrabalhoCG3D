import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { leitorOBJ } from '../cliente/leitorOBJ.js';
import { leitorMTL } from '../cliente/leitorMTL.js';
import {
    obterAlvosPorta,
    obterObjetoInterativoProximo,
    obterObjetosMapa,
    PREDIO_NC2A
} from '../compartilhado/mapa.js';
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

async function lerModeloComMateriais(nome) {
    const caminho = new URL(`../cliente/modelosOBJ/${nome}`, import.meta.url);
    const modelo = leitorOBJ.parseOBJ(await readFile(caminho, 'utf8'));
    const biblioteca = new URL(modelo.materialLibs[0], caminho);
    const materiais = leitorMTL.parseMTL(await readFile(biblioteca, 'utf8'));
    return { ...modelo, biblioteca, materiais };
}

test('as salas de aula usam cadeiras com apoio, pés no piso e textura UV', async () => {
    const arquivo = 'cadeira-aula-jogo.obj';
    const modelo = await lerModeloComMateriais(arquivo);
    assert.equal(modelo.malhas.length, 1);
    const [malha] = modelo.malhas;
    assert.equal(malha.texturas.length, modelo.totalVertices * 2);
    const material = modelo.materiais[malha.material];
    assert.equal(material.diffuseMap, '../texturas/Image_0.001.jpg');
    await readFile(new URL(material.diffuseMap, modelo.biblioteca));

    for (const caixa of jogo.modelosColisao.get(arquivo).colisores) {
        assert.equal(caixa.minimoY, 0);
        assert.ok(Math.abs(caixa.minimoX + caixa.maximoX) < EPSILON);
        assert.ok(Math.abs(caixa.minimoZ + caixa.maximoZ) < EPSILON);
    }

    const objetos = obterObjetosMapa();
    for (const andar of PREDIO_NC2A.andares) {
        for (const sala of andar.salas.filter(sala => sala.categoria === 'aula')) {
            const assentos = objetos.filter(objeto =>
                objeto.sala === sala.nome && objeto.andar === andar.nome && objeto.modelo === arquivo
            );
            assert.equal(assentos.length, 6, sala.nome);
            for (const cadeira of assentos) {
                assert.equal(cadeira.y, sala.ancora.y, cadeira.nome);
                assert.equal(cadeira.rotacaoY, sala.ancora.rotacaoY + Math.PI, cadeira.nome);
                assert.equal(cadeira.solido, true, cadeira.nome);
            }
        }
    }
});

test('cada folha do NC2A tem UVs e usa a textura da porta branca', async () => {
    const modelo = await lerModeloComMateriais('nc2a.obj');
    const portas = new Set(jogo.portas.keys());

    const material = modelo.materiais.PortaBranca;
    assert.equal(material.diffuseMap, '../texturas/porta_branca.jpg');
    await readFile(new URL(material.diffuseMap, modelo.biblioteca));

    const azulejo = modelo.materiais.AzulejoInterno;
    assert.equal(azulejo.diffuseMap, '../texturas/parede_azulejo_branco.jpg');
    await readFile(new URL(azulejo.diffuseMap, modelo.biblioteca));

    const folhas = new Set();
    for (const malha of modelo.malhas) {
        const ehPorta = portas.has(malha.nomeObjeto);
        assert.equal(malha.material === 'PortaBranca', ehPorta, malha.nomeObjeto);
        if (!ehPorta) continue;

        folhas.add(malha.nomeObjeto);
        assert.equal(malha.texturas.length, malha.posicoes.length * 2 / 3, malha.nomeObjeto);
        assert.equal(Math.min(...malha.texturas), 0, malha.nomeObjeto);
        assert.equal(Math.max(...malha.texturas), 1, malha.nomeObjeto);
    }
    assert.deepEqual(folhas, portas);
});

test('o centro de cada folha continua transitável com a porta aberta', () => {
    const caixas = jogo.modelosColisao.get('nc2a.obj').colisores;
    for (const porta of jogo.portas.values()) {
        const caixa = caixas.find(caixa => caixa.nome === porta.nome);
        const perpendicularEmZ = caixa.maximoX - caixa.minimoX >= caixa.maximoZ - caixa.minimoZ;
        const eixo = perpendicularEmZ ? 'z' : 'x';
        const lado = Math.sign(porta[eixo]);
        const jogador = {
            id: -1,
            x: porta.x,
            y: porta.nome.startsWith('Andar01') ? 4.01 : 0,
            z: porta.z
        };
        jogador[eixo] -= lado * 1.25;

        assert.equal(jogo.podeOcupar(jogador, porta.x, porta.z), false, porta.nome);
        porta.aberta = true;
        try {
            assert.ok(jogo.podeOcupar(jogador, jogador.x, jogador.z), porta.nome);
            const passo = lado * 3.5;
            jogo.movimentarComColisao(jogador, perpendicularEmZ ? 0 : passo, perpendicularEmZ ? passo : 0);
            assert.ok(Math.abs(jogador[eixo] - porta[eixo] - lado * 2.25) < EPSILON, porta.nome);
        } finally {
            porta.aberta = false;
        }
    }
});

test('a interação no centro abre as portas duplas e conecta os setores do térreo', () => {
    const jogador = jogo.adicionarJogador(null);
    const outro = jogo.adicionarJogador(null);
    assert.ok(jogador && outro);

    function caminhar(x, z) {
        jogo.movimentarComColisao(jogador, x - jogador.x, z - jogador.z);
        assert.ok(Math.hypot(jogador.x - x, jogador.z - z) < EPSILON, `Destino (${x}, ${z})`);
    }

    function mirarEInteragir(grupo, angulo) {
        const alvos = jogo.criarEstado().portas
            .filter(porta => porta.nome.startsWith(`${grupo}__`))
            .flatMap(porta => obterAlvosPorta(porta, jogador));
        assert.ok(alvos.length > 0, grupo);
        jogador.anguloHorizontal = angulo;
        const olhar = { x: Math.sin(angulo), z: -Math.cos(angulo) };
        const alvo = obterObjetoInterativoProximo(jogador, alvos, olhar);
        assert.ok(alvo, grupo);
        return jogo.alternarPorta(jogador.id, alvo.nome);
    }

    const leste = 'Andar00__Corredor__Int__PortaLeste';
    const oeste = 'Andar00__Corredor__Int__PortaOeste';
    const recepcao = 'Andar00__Recepcao__Int__PortaCorredor';
    const exterior = 'Andar00__Recepcao__Int__PortaExterior';

    try {
        caminhar(jogador.x, 0);
        caminhar(8.5, 0);
        assert.ok(mirarEInteragir(leste, -Math.PI / 2));
        assert.ok(jogo.paresPortas.get(leste).every(folha => folha.aberta));

        // Com outro jogador no vão, o fechamento deve aguardar.
        jogo.movimentarComColisao(outro, 0, 1 - outro.z);
        jogo.movimentarComColisao(outro, 7 - outro.x, 0);
        assert.ok(Math.abs(outro.x - 7) < EPSILON);
        for (const folha of jogo.paresPortas.get(leste)) folha.ultimaInteracaoEm = 0;
        assert.equal(mirarEInteragir(leste, -Math.PI / 2), false);
        assert.ok(jogo.paresPortas.get(leste).every(folha => folha.aberta));
        jogo.removerJogador(outro.id);

        caminhar(3, 0);
        caminhar(3, 2.5);
        assert.ok(mirarEInteragir(recepcao, Math.PI));
        caminhar(3, 10.5);
        jogo.atualizar(0);
        assert.equal(jogador.sala, 'Recepcao');
        assert.ok(mirarEInteragir(exterior, Math.PI));
        caminhar(3, 13.5);
        caminhar(3, 0);

        caminhar(-8.5, 0);
        assert.ok(mirarEInteragir(oeste, -Math.PI / 2));
        caminhar(-23.5, 0);
        caminhar(-23.5, 2.5);
        jogador.anguloHorizontal = Math.PI;
        assert.ok(jogo.alternarPorta(jogador.id, 'Andar00__Sala002__Int__Porta.013'));
        caminhar(-23.5, 6.25);
        jogo.atualizar(0);
        assert.equal(jogador.sala, 'Sala002.013');
    } finally {
        jogo.removerJogador(jogador.id);
        jogo.removerJogador(outro.id);
        for (const porta of jogo.portas.values()) {
            porta.aberta = false;
            porta.ultimaInteracaoEm = 0;
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
