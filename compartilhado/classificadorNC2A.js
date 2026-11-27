
const ALIASES = {
    LabChian: 'LabChain',
    BanheiroMascuino: 'BanheiroMasculino'
};

const LABORATORIOS = new Set([
    'CAIS',
    'Ladesc',
    'Lamac',
    'LabChain',
    'Lagic',
    'Lasid',
    'Larces',
    'GesadPesquisa',
    'Incubauece',
    'Embrapii'
]);

export function obterCategoriaSala(nome) {
    if (LABORATORIOS.has(nome)) return 'laboratorio';
    if (nome === 'Recepcao') return 'recepcao';
    if (nome === 'Secretaria') return 'administrativo';
    if (nome === 'Copa') return 'copa';

    if (nome.startsWith('Banheiro')) {
        return 'banheiro';
    }

    if (
        nome === 'Corredor' ||
        nome === 'Escada'
    ) {
        return 'circulacao';
    }

    return 'generica';
}

export function catalogarNC2A(nomesObjetos) {
    const catalogo = {
        nome: 'NC2A',
        modelo: 'nc2a.obj',
        partesGerais: [],
        andares: {
            Andar00: {
                nome: 'Andar00',
                nivel: 0,
                salas: {}
            },
            Andar01: {
                nome: 'Andar01',
                nivel: 1,
                salas: {}
            }
        }
    };

    for (const nomeOriginal of nomesObjetos) {
        const partes = nomeOriginal.split('__');

        const andar = catalogo.andares[partes[0]];

        if (
            !andar ||
            partes.length < 4 ||
            partes[1] === 'Predio'
        ) {
            catalogo.partesGerais.push(nomeOriginal);
            continue;
        }

        const nomeSala =
            ALIASES[partes[1]] ?? partes[1];

        const tipo = partes[2];
        const elemento = partes.slice(3).join('__');

        if (!andar.salas[nomeSala]) {
            andar.salas[nomeSala] = {
                nome: nomeSala,
                andar: andar.nome,
                categoria: obterCategoriaSala(nomeSala),
                partesEstruturais: [],
                portas: []
            };
        }

        const sala = andar.salas[nomeSala];

        const parte = {
            nome: nomeOriginal,
            tipo,
            elemento,
            solido: !/SemCol/i.test(nomeOriginal),
            interativo:
                tipo === 'Int' && /Porta/i.test(elemento)
        };

        sala.partesEstruturais.push(parte);

        if (parte.interativo) {
            sala.portas.push(nomeOriginal);
        }
    }

    return catalogo;
}
