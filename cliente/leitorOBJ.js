export const leitorOBJ = {
    //carrega o .obj
    async carregarArquivo(caminho) {
        const resposta = await fetch(caminho)

        const texto = await resposta.text()
        return this.parseOBJ(texto)
        //manda o conteudo do obj para o parser
    },

    parseOBJ(texto){
        //guarda os dados lidos do arquivo .obj
        const objPosicoes = [[]]
        const objCoordTextura = [[]]
        const objNormais = [[]]

        const nomesObjetos = []

        //reune as listas de cada dado em uma so lista que representa o vertice completo
        const objVertices = [
            objPosicoes,
            objCoordTextura,
            objNormais
        ]

        //vai guardar os dados dos vertices na ordem q serao enviados pro webgl
        const webglVertices = [
            [],
            [],
            []
        ]

        //busca os dados do vertice obj e adiciona nas listas do webgl
        function addVertice(vertice) {
            const ptn = vertice.split("/")

                ptn.forEach((indiceObjStr, i) => {
                    if(!indiceObjStr) return;

                const indiceObj = parseInt(indiceObjStr, 10)
                const indice = indiceObj + (indiceObj > 0 ? 0 : objVertices[i].length)

                webglVertices[i].push(...objVertices[i][indice])
            })

        }
        //conjunto de funcoes para interpretar cada keyword do obj
        const keywords = {
            v (partes) {
                objPosicoes.push(partes.map(parseFloat))
            },
            vt (partes) {
                objCoordTextura.push(partes.map(parseFloat))
            },
            vn (partes) {
                objNormais.push(partes.map(parseFloat))
            },
            f (partes) { //transforma as faces em triangulos p/ ficar no formato que o webgl desenha
                const numTriangulos = partes.length -2
                for (let t = 0; t < numTriangulos; t++){
                    addVertice(partes[0])
                    addVertice(partes[t + 1])
                    addVertice(partes[t + 2])
                }
            },
            o (partes) { //apenas guardando o nome da parte do objeto mas nao desenha individualmente
                const nome = partes[0]
                if(nome) nomesObjetos.push(nome)
            }
        }

        const linhas = texto.split("\n")
        //leitura do arquivo linha por linha
        for(let l = 0; l < linhas.length; l++){
            const linha = linhas[l].trim()
            if(!linha || linha.startsWith("#")) continue
            
            const partes = linha.split(/\s+/)
            const handler = keywords[partes[0]]
            if(handler) handler(partes.slice(1))
        }
        return {
            posicoes : new Float32Array(webglVertices[0]),
            texturas : new Float32Array(webglVertices[1]),
            normais : new Float32Array(webglVertices[2]),
            totalVertices : webglVertices[0].length / 3,
            objetos : nomesObjetos
        }
    
    }
}