
import { readFile } from 'node:fs/promises';

const RAIO_JOGADOR = 0.3;
const ALTURA_JOGADOR = 1.7;
const MARGEM = 0.001;

export async function carregarColisoesOBJ(caminho) {
    const texto = await readFile(caminho, 'utf8');

    const vertices = [[]];
    const objetos = [];

    let objetoAtual = null;

    function criarObjeto(nome) {
        objetoAtual = {
            nome,
            indices: new Set()
        };

        objetos.push(objetoAtual);
    }

    for (const linhaBruta of texto.split(/\r?\n/)) {
        const linha = linhaBruta.trim();

        if (!linha || linha.startsWith('#')) continue;

        const [tipo, ...valores] = linha.split(/\s+/);

        if (tipo === 'v') {
            const posicao = valores.slice(0, 3).map(Number);

            if (
                posicao.length !== 3 ||
                !posicao.every(Number.isFinite)
            ) {
                throw new Error('Vértice OBJ inválido');
            }

            vertices.push(posicao);
        }

        if (tipo === 'o') {
            criarObjeto(valores.join(' '));
        }

        if (tipo === 'f') {
            if (!objetoAtual) {
                criarObjeto('ObjetoSemNome');
            }

            for (const valor of valores) {
                const indiceOriginal = Number(
                    valor.split('/')[0]
                );

                if (
                    !Number.isInteger(indiceOriginal) ||
                    indiceOriginal === 0
                ) {
                    throw new Error('Índice OBJ inválido');
                }

                const indice = indiceOriginal > 0
                    ? indiceOriginal
                    : vertices.length + indiceOriginal;

                if (!vertices[indice]) {
                    throw new Error('Face OBJ inválida');
                }

                objetoAtual.indices.add(indice);
            }
        }
    }

    const colisores = [];

    for (const objeto of objetos) {
        if (objeto.indices.size === 0) continue;

        // Objetos explicitamente marcados sem colisão.
        if (/SemCol/i.test(objeto.nome)) continue;

        const limites = {
            nome: objeto.nome,
            minimoX: Infinity,
            maximoX: -Infinity,
            minimoY: Infinity,
            maximoY: -Infinity,
            minimoZ: Infinity,
            maximoZ: -Infinity
        };

        for (const indice of objeto.indices) {
            const [x, y, z] = vertices[indice];

            limites.minimoX = Math.min(limites.minimoX, x);
            limites.maximoX = Math.max(limites.maximoX, x);

            limites.minimoY = Math.min(limites.minimoY, y);
            limites.maximoY = Math.max(limites.maximoY, y);

            limites.minimoZ = Math.min(limites.minimoZ, z);
            limites.maximoZ = Math.max(limites.maximoZ, z);
        }

        colisores.push(limites);
    }

    function detectarColisao(x, y, z) {
        for (const caixa of colisores) {

            // y representa a posição dos pés do jogador.
            const sobrepoeAltura =
                y < caixa.maximoY - MARGEM &&
                y + ALTURA_JOGADOR > caixa.minimoY + MARGEM;

            if (!sobrepoeAltura) continue;

            // Ponto da caixa mais próximo do centro do jogador.
            const proximoX = Math.max(
                caixa.minimoX,
                Math.min(x, caixa.maximoX)
            );

            const proximoZ = Math.max(
                caixa.minimoZ,
                Math.min(z, caixa.maximoZ)
            );

            const dx = x - proximoX;
            const dz = z - proximoZ;

            if (
                dx * dx + dz * dz <
                RAIO_JOGADOR * RAIO_JOGADOR
            ) {
                return caixa;
            }
        }

        return null;
    }

    return {
        totalObjetos: objetos.length,
        totalColisores: colisores.length,
        colisores,

        detectarColisao,

        posicaoBloqueada(x, y, z) {
            return detectarColisao(x, y, z) !== null;
        }
    };
}
