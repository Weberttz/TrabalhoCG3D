// A origem do plafon e a canopla do bulbo encostam no teto.
// A luminária do repositório tem a origem na face inferior do difusor.
const PLAFON = {
    modelo: 'plafon-corredor.obj',
    descidaModelo: 0,
    descidaFonte: 0.14,
    cor: [0.96, 0.98, 1],
    alcance: 7.8,
    intensidade: 1.24
};

const BULBO = {
    modelo: 'lampada-bulbo.obj',
    descidaModelo: 0,
    descidaFonte: 0.33,
    cor: [1, 0.97, 0.92],
    alcance: 6.7,
    intensidade: 1.02
};

const PENDENTE_GOOGLE = {
    modelo: 'ceiling-lamp.obj',
    descidaModelo: 0.7933,
    descidaFonte: 0.86,
    cor: [1, 0.83, 0.58],
    alcance: 7.4,
    intensidade: 0.93
};

function centros(min, max, quantidade) {
    const intervalo = (max - min) / quantidade;
    return Array.from({ length: quantidade }, (_, i) => min + (i + 0.5) * intervalo);
}

function criarZona(andar, sala, limites, teto, tipo, pontos, setor = sala) {
    return {
        nivel: andar.nivel,
        limites,
        luminarias: pontos.map(([x, z], i) => ({
            nome: `${andar.nome}_${setor}_luminaria_${i + 1}`,
            andar: andar.nome,
            sala,
            modelo: tipo.modelo,
            x,
            y: teto - tipo.descidaModelo,
            z,
            solido: false,
            interativo: false,
            item: false,
            luz: {
                y: teto - tipo.descidaFonte,
                cor: tipo.cor,
                alcance: tipo.alcance,
                intensidade: tipo.intensidade
            }
        }))
    };
}

export function gerarIluminacaoNC2A(andares) {
    const zonas = [];

    for (const andar of andares) {
        const terreo = andar.nivel === 0;
        const teto = terreo ? 3.88 : 8;
        const setores = [
            ['CorredorOeste', -45, -10],
            ['CorredorCentral', -10, 7],
            ['CorredorLeste', 7, 45]
        ];

        for (const [setor, minX, maxX] of setores) {
            const pontos = centros(minX, maxX, Math.ceil((maxX - minX) / 6)).map(x => [x, 0]);
            if (terreo && setor === 'CorredorCentral') pontos.push([-6, 2.35]);
            const zona = criarZona(andar, 'Corredor', { minX, maxX, minZ: -4, maxZ: 4 },
                teto, PLAFON, pontos, setor);
            zonas.push(zona);

            if (terreo && setor === 'CorredorCentral') {
                // O recuo sob o vão recebe luz dos plafons da borda da laje.
                zonas.push({ ...zona, limites: { minX: -10, maxX: -1, minZ: 4, maxZ: 12 } });
            }
        }

        for (const sala of andar.salas.filter(sala => sala.area)) {
            const { minX, maxX, minZ, maxZ } = sala.area;
            const limites = { minX: minX - 0.12, maxX: maxX + 0.12, minZ: minZ - 0.1, maxZ: maxZ + 0.1 };
            const google = terreo && sala.nome === 'Sala002.014';

            if (google) {
                zonas.push(criarZona(andar, sala.nome, limites, teto, PENDENTE_GOOGLE, [
                    [7.4, -8.15], [12.4, -9.83], [12.51, -6.65], [17.6, -8.15]
                ]));
                continue;
            }

            const xs = centros(minX, maxX, Math.ceil((maxX - minX) / 7.8));
            const zs = centros(minZ, maxZ, sala.categoria === 'banheiro' ? 1 : 2);
            zonas.push(criarZona(andar, sala.nome, limites, teto, BULBO,
                xs.flatMap(x => zs.map(z => [x, z]))));
        }
    }

    const luminarias = [...new Set(zonas.flatMap(zona => zona.luminarias))];
    return { luminarias, zonas };
}
