

export class Predio{
    constructor(nome){
        this.nome = nome;
        this.andares = {};
        this.andarAtual = 0;
    }

    criarAndar(nomeAndar){
        if(!this.andares[nomeAndar]){
            this.andares[nomeAndar] = new Andar(nomeAndar);
        }
        return this.andares[nomeAndar];
    }

    subir(){
        this.andarAtual = 1;
    }
    descer(){
        this.andarAtual = 0;
    }
}

export class Andar{
    constructor(nome){
        this.nome = nome;
        this.salas = {};
    }
    criarSala(nomeSala){
        if(!this.salas[nomeSala]){
            this.salas[nomeSala] = new Sala(nomeSala);
        }
        return this.salas[nomeSala];
    }
}

export class Sala {
    constructor(nome) {
        this.nome = nome;
        this.mesh = null;
        this.objetos = {};
        this.limites = {};
    }

    criarObjeto(nomeObjeto, mesh, temColisao = true) {
        if (!this.objetos[nomeObjeto]) {
            this.objetos[nomeObjeto] = new Objeto(
                nomeObjeto,
                mesh,
                temColisao
            );
        }

        return this.objetos[nomeObjeto];
    }

    criarObjetoInterativo(nomeObjeto, mesh, temColisao = true, funcaoDeInteracao) {
        if (!this.objetos[nomeObjeto]) {
            this.objetos[nomeObjeto] = new ObjetoInterativo(
                nomeObjeto,
                mesh,
                temColisao,
                funcaoDeInteracao
            );
        }

        return this.objetos[nomeObjeto];
    }

    criarItem(nomeObjeto, mesh, temColisao = false, podePegar = true, funcaoDeInteracao = null) {
        if (!this.objetos[nomeObjeto]) {
            this.objetos[nomeObjeto] = new Item(
                nomeObjeto,
                mesh,
                temColisao,
                podePegar,
                funcaoDeInteracao
            );
        }

        return this.objetos[nomeObjeto];
    }
}

export class Objeto {
    constructor(nome, mesh, temColisao = true) {
        this.nome = nome;
        this.mesh = mesh;
        this.temColisao = temColisao;

        this.posicao = { x: 0, y: 0, z: 0 };
        this.textura = [];
        this.normais = [];

        // Caixas AABB de cada parte do modelo OBJ.
        this.aabb = null;

        // Resultado do leitor de colisões.
        this.colisaoOBJ = null;
    }
}


export class ObjetoInterativo extends Objeto{
    constructor(nome, mesh, temColisao, funcaoDeInteracao){
        super(nome, mesh, temColisao);
        this.acao = funcaoDeInteracao;
    }
    //a funcao de interacao é recebida na criacao do objeto
    interagir(jogador){
        if(typeof this.acao == 'function'){
            this.acao(this,jogador);
        }
    }
}


export class Item extends ObjetoInterativo {
    constructor(nome, mesh, temColisao = false, podePegar = true, funcaoDeInteracao = null) {
        super(nome, mesh, temColisao, funcaoDeInteracao);
        this.podePegar = podePegar;
        this.seguradoPor = null;
        this.visivel = true;
        this.interativo = true;

        this.aoPegar = null;
        this.aoSoltar = null;

        if (!this.acao) {
            this.acao = (item, jogador) => item.pegar(jogador);
        }
    }

    configurarEventos({ aoPegar = null, aoSoltar = null } = {}) {
        if (typeof aoPegar === 'function') this.aoPegar = aoPegar;
        if (typeof aoSoltar === 'function') this.aoSoltar = aoSoltar;
    }

    pegar(jogador) {
        if (!this.podePegar || !this.visivel || this.seguradoPor !== null) {
            return false;
        }

        this.seguradoPor = jogador.id;
        this.visivel = false;
        this.temColisao = false;
        jogador.itemSegurado = this.nome;

        if (typeof this.aoPegar === 'function') {
            this.aoPegar(this, jogador);
        }

        return true;
    }

    soltar(posicao, podePegar = true, jogador = null) {
        if (posicao) {
            this.posicao = {
                x: posicao.x,
                y: posicao.y ?? 0,
                z: posicao.z
            };
        }

        this.seguradoPor = null;
        this.visivel = true;
        this.podePegar = podePegar;

        if (typeof this.aoSoltar === 'function') {
            this.aoSoltar(this, jogador);
        }

        return true;
    }
}