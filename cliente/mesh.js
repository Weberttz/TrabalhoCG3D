
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

        this.normalBuffer = null;
        if (normais && normais.length > 0) {
            this.normalBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normais), gl.STATIC_DRAW);
        }

    }

    desenhar(prog) {
        const gl = this.gl;
        const attribs = prog.attribLocations;

        // Ativa atributo de POSIÇÃO (3 componentes: X, Y, Z)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posicaoBuffer);
        gl.vertexAttribPointer(attribs.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attribs.vertexPosition);

        // Ativa atributo de TEXTURA se o objeto tiver UVs e o shader usar textura
        if (this.texCoordBuffer && attribs.textureCoord !== undefined && attribs.textureCoord !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.vertexAttribPointer(attribs.textureCoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attribs.textureCoord);
        }

        // Ativa atributo de NORMAIS se o objeto tiver normais e o shader calcular luz
        if (this.normalBuffer && attribs.vertexNormal !== undefined && attribs.vertexNormal !== -1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.vertexAttribPointer(attribs.vertexNormal, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attribs.vertexNormal);
        }

        // Manda a GPU desenhar todos os triângulos desta malha
        gl.drawArrays(gl.TRIANGLES, 0, this.quantidadeVertices);
    }
}