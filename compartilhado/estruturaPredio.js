

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

export class Sala{
    constructor(nome){
        this.nome = nome;
        this.mesh = null;
        this.objetos = {};
        this.limites = {};
    }
    criarObjeto(nomeObjeto, aabb){
        if(!this.objetos[nomeObjeto]){
            this.objetos[nomeObjeto] = new Objeto(nomeObjeto, aabb);
        }
        return this.objetos[nomeObjeto];
    }
}

export class Objeto{
    constructor(nome, mesh, temColisao = true){
        this.nome = nome;
        this.mesh = mesh;
        this.temColisao = temColisao;

        this.posicao = [];
        this.textura = [];
        this.normais = [];

        this.aabb = null;
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