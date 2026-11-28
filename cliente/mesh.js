function calcularNormaisFaces(posicoes) {
    const normais = new Float32Array(posicoes.length);

    for (let i = 0; i < posicoes.length; i += 9) {
        const abX = posicoes[i + 3] - posicoes[i];
        const abY = posicoes[i + 4] - posicoes[i + 1];
        const abZ = posicoes[i + 5] - posicoes[i + 2];
        const acX = posicoes[i + 6] - posicoes[i];
        const acY = posicoes[i + 7] - posicoes[i + 1];
        const acZ = posicoes[i + 8] - posicoes[i + 2];
        const x = abY * acZ - abZ * acY;
        const y = abZ * acX - abX * acZ;
        const z = abX * acY - abY * acX;

        for (let vertice = i; vertice < i + 9; vertice += 3) {
            normais[vertice] = x;
            normais[vertice + 1] = y;
            normais[vertice + 2] = z;
        }
    }

    return normais;
}

export class Mesh{
    constructor(gl, posicoes, texturas, normais){
        this.gl = gl;
        this.qtdVertices = posicoes.length/3;
        this.posicaoBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posicaoBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(posicoes), gl.STATIC_DRAW);

        this.texCoordBuffer = null;
        if (texturas && texturas.length > 0) {
            this.texCoordBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texturas), gl.STATIC_DRAW);
        }

        const dadosNormais = normais?.length === posicoes.length
            ? new Float32Array(normais)
            : calcularNormaisFaces(posicoes);
        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, dadosNormais, gl.STATIC_DRAW);

    }

    desenhar(prog) {
        const gl = this.gl;
        const attribs = prog.attribLocations;

        // Ativa atributo de POSIÇÃO (3 componentes: X, Y, Z)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posicaoBuffer);
        gl.vertexAttribPointer(attribs.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs.vertexPosition);

        // Ativa atributo de TEXTURA se o objeto tiver UVs e o shader usar textura
        if (attribs.textureCoord !== undefined && attribs.textureCoord !== -1) {
            if (this.texCoordBuffer) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
                gl.vertexAttribPointer(attribs.textureCoord, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(attribs.textureCoord);
            } else {
                gl.disableVertexAttribArray(attribs.textureCoord);
            }
        }

        // Ativa atributo de NORMAIS se o objeto tiver normais e o shader calcular luz
        if (attribs.vertexNormal !== undefined && attribs.vertexNormal !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.vertexAttribPointer(attribs.vertexNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attribs.vertexNormal);
        }

        // Manda a GPU desenhar todos os triângulos desta malha
        gl.drawArrays(gl.TRIANGLES, 0, this.qtdVertices);
    }
}