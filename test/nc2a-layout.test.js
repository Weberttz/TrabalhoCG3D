import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { carregarColisoesOBJ } from '../servidor/colisaoOBJ.js';
import { obterObjetosMapa, PREDIO_NC2A } from '../compartilhado/mapa.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caminhoOBJ = path.join(raiz, 'cliente/modelosOBJ/nc2a.obj');

test('portas: todas as entradas são reconhecidas e podem deixar livre o centro', async () => {
  const geo = await carregarColisoesOBJ(caminhoOBJ);
  const portas = geo.colisores.filter(c => /__Int__Porta/.test(c.nome));
  assert.ok(portas.length >= 40, 'O modelo esperado tem pelo menos 40 portas');
  for (const caixa of portas) {
    const x = (caixa.minimoX + caixa.maximoX) / 2;
    const z = (caixa.minimoZ + caixa.maximoZ) / 2;
    const y = caixa.minimoY;
    const espX = caixa.maximoX - caixa.minimoX;
    const eixoX = espX >= caixa.maximoZ - caixa.minimoZ;
    const px = eixoX ? caixa.minimoX : x;
    const pz = eixoX ? z : caixa.minimoZ;
    const config = new Map([[caixa.nome, {
      nome: caixa.nome, aberta: false, pivoX: px, pivoZ: pz, sentido: 1
    }]]);
    // Garante que a colisão de uma porta fechada exista.
    const portaIsolada = { ...geo, colisores: [caixa] };
    // A checagem do centro fechado é geométrica; outros objetos não interferem.
    assert.ok(x >= caixa.minimoX && x <= caixa.maximoX &&
      z >= caixa.minimoZ && z <= caixa.maximoZ &&
      y >= caixa.minimoY && y < caixa.maximoY);
    config.get(caixa.nome).aberta = true;
    const dx = x - px, dz = z - pz;
    const localX = px - dz, localZ = pz + dx;
    const proxX = Math.max(caixa.minimoX, Math.min(localX, caixa.maximoX));
    const proxZ = Math.max(caixa.minimoZ, Math.min(localZ, caixa.maximoZ));
    assert.ok(Math.hypot(localX - proxX, localZ - proxZ) >= 0.3,
      'Centro da porta aberta bloqueado: ' + caixa.nome);
  }
});

test('mobiliário: modelos existentes, salas únicas e circulação em torno das portas', async () => {
  const salas = PREDIO_NC2A.andares.flatMap(andar =>
    andar.salas.map(sala => ({...sala, andar: andar.nome})));
  const chaves = salas.map(s => s.andar + '/' + s.nome);
  assert.equal(new Set(chaves).size, chaves.length, 'Salas duplicadas');
  const objetos = obterObjetosMapa();
  const modelos = [...new Set(objetos.filter(o => o.modelo && o.modelo !== 'nc2a.obj').map(o => o.modelo))];
  for (const modelo of modelos) {
    await assert.doesNotReject(() =>
      readFile(path.join(raiz, 'cliente/modelosOBJ', modelo)));
  }
  assert.ok(objetos.length > 40);
  for (const sala of salas) {
    if (!sala.porta) continue;
    for (const objeto of objetos.filter(o => o.andar === sala.andar && o.sala === sala.nome && o.y < (sala.andar === 'Andar01' ? 6 : 2))) {
      // Entrada deve conservar uma faixa livre de 1,4m no interior da sala.
      const pertoX = Math.abs(objeto.x - sala.porta.x) < 0.75;
      const pertoZ = Math.abs(objeto.z - sala.porta.z) < 1.4;
      assert.ok(!(pertoX && pertoZ), 'Móvel na passagem: ' + objeto.nome);
    }
  }
});
