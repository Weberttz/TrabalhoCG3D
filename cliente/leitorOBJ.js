export class leitorOBJ{
    
    static async carregarArquivo(caminho){
        
        const resposta = await fetch(caminho)

        if(!resposta.ok){
            throw new Error("Não foi possivel carregar o arquivo!")
        }

        const texto = await resposta.text()
        return leitorOBJ.parse(texto)
    }

    static parse(textoOBJ){
        const vertices = []
        const posicoesFinais = []

        const linhas = textoOBJ.split("\n")

        for(let l = 0; l < linhas.length; l++){
            let linha = linhas[l]

            if(linha == "" || linha.startsWith("#")) continue

            const partes = linha.split(/\s+/)
            const tipo = partes[0]

            if(tipo === 'v'){
                vertices.push([
                    parseFloat(partes[1]),
                    parseFloat(partes[2]),
                    parseFloat(partes[3])
                ])
            }

            else if(tipo === "f"){
                const face = []

                for(let i = 1; i < partes.length; i++){
                    const indice = parseInt(partes[i].split("/")[0], 10)

                    const indiceVerdadeiro = indice > 0 ? indice - 1 : vertices.length + indice

                    if(indiceVerdadeiro < 0 || indiceVerdadeiro >= vertices.length){
                        throw new Error("Indice inválido!")
                    }

                    face.push(indiceVerdadeiro)
                }

                for(let i = 1; i < face.length -1; i++){
                    const triangulo = [
                        face[0],
                        face[i],
                        face[i + 1]
                    ]

                    for(let j = 0; j < triangulo.length; j++){
                        const indice = triangulo[j]
                        const vertice = vertices[indice]

                        posicoesFinais.push(vertice[0], vertice[1], vertice[2])
                    }
                }
            }

        }
        return {
            posicoes : new Float32Array(posicoesFinais),
            verticesTotais : posicoesFinais.length / 3
        }
    
    }
}