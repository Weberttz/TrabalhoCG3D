// Cada célula guarda até quatro fontes do mesmo ambiente. A tabela é montada
// uma vez e permite iluminar também as faces longas do piso e da laje.
const CELULA = 0.25;
const MIN_X = -48;
const MIN_Z = -16;
const LARGURA = 384;
const PROFUNDIDADE = 128;
const MAX_FONTES = 4;

export function prepararIluminacao({ luminarias, zonas }) {
    const larguraFontes = Math.max(1, luminarias.length);
    const dados = new Float32Array(larguraFontes * 2 * 4);
    const indices = new Uint8Array(LARGURA * PROFUNDIDADE * 2 * MAX_FONTES);
    const ids = new Map();

    luminarias.forEach((luminaria, i) => {
        const { y, cor, intensidade, alcance } = luminaria.luz;
        dados.set([luminaria.x, y, luminaria.z, intensidade], i * 4);
        dados.set([...cor, alcance], (larguraFontes + i) * 4);
        ids.set(luminaria, i + 1);
    });

    for (const zona of zonas) {
        const { minX, maxX, minZ, maxZ } = zona.limites;
        const inicioX = Math.max(0, Math.ceil((minX - MIN_X) / CELULA - 0.5));
        const inicioZ = Math.max(0, Math.ceil((minZ - MIN_Z) / CELULA - 0.5));
        const fimX = Math.min(LARGURA, Math.ceil((maxX - MIN_X) / CELULA - 0.5));
        const fimZ = Math.min(PROFUNDIDADE, Math.ceil((maxZ - MIN_Z) / CELULA - 0.5));

        for (let z = inicioZ; z < fimZ; z++) {
            for (let x = inicioX; x < fimX; x++) {
                const xCentro = MIN_X + (x + 0.5) * CELULA;
                const zCentro = MIN_Z + (z + 0.5) * CELULA;
                const proximas = zona.luminarias
                    .map(luminaria => ({
                        id: ids.get(luminaria),
                        distancia: (xCentro - luminaria.x) ** 2 + (zCentro - luminaria.z) ** 2
                    }))
                    .sort((a, b) => a.distancia - b.distancia)
                    .slice(0, MAX_FONTES);
                const inicio = (x + (z + zona.nivel * PROFUNDIDADE) * LARGURA) * MAX_FONTES;
                indices.fill(0, inicio, inicio + MAX_FONTES);
                indices.set(proximas.map(luminaria => luminaria.id), inicio);
            }
        }
    }

    return { larguraFontes, dados, indices };
}

export function criarIluminacao(gl, configuracao) {
    const { larguraFontes, dados, indices } = prepararIluminacao(configuracao);

    function criarTextura(unidade, interno, largura, altura, formato, tipo, valores) {
        gl.activeTexture(gl.TEXTURE0 + unidade);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, interno, largura, altura, 0, formato, tipo, valores);
    }

    criarTextura(3, gl.RGBA8UI, LARGURA, PROFUNDIDADE * 2, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, indices);
    criarTextura(4, gl.RGBA32F, larguraFontes, 2, gl.RGBA, gl.FLOAT, dados);
    gl.activeTexture(gl.TEXTURE0);

    return {
        // O chamador já selecionou o programa. As unidades 3 e 4 servem aos
        // dois renderizadores e ficam reservadas à tabela de iluminação.
        configurarPrograma(programa) {
            gl.uniform1i(gl.getUniformLocation(programa, 'uIndicesLuzes'), 3);
            gl.uniform1i(gl.getUniformLocation(programa, 'uDadosLuzes'), 4);
        }
    };
}

export const GLSL_ILUMINACAO = `
uniform highp usampler2D uIndicesLuzes;
uniform highp sampler2D uDadosLuzes;

vec3 aplicarLuzes(vec3 posicao, vec3 normal, vec3 difusa, vec3 ambiente,
                  vec3 especular, float brilho, vec3 paraCamera) {
    vec3 resultado = 0.29 * ambiente + 0.09 * max(normal.y, 0.0) * difusa;

    // A face que olha para dentro usa as fontes do lado interno da parede.
    vec3 amostra = posicao + normal * 0.13;
    ivec2 celula = ivec2(floor((amostra.xz - vec2(${MIN_X}.0, ${MIN_Z}.0)) / ${CELULA}));
    if (amostra.y < -0.15 || amostra.y > 8.02 ||
        any(lessThan(celula, ivec2(0))) ||
        any(greaterThanEqual(celula, ivec2(${LARGURA}, ${PROFUNDIDADE})))) {
        return resultado;
    }

    if (amostra.y >= 4.0) celula.y += ${PROFUNDIDADE};
    uvec4 ids = texelFetch(uIndicesLuzes, celula, 0);

    for (int i = 0; i < ${MAX_FONTES}; ++i) {
        int id = int(ids[i]) - 1;
        if (id < 0) break;

        vec4 fonte = texelFetch(uDadosLuzes, ivec2(id, 0), 0);
        vec4 corAlcance = texelFetch(uDadosLuzes, ivec2(id, 1), 0);
        vec3 delta = fonte.xyz - posicao;
        float distancia2 = dot(delta, delta);
        float alcance2 = corAlcance.w * corAlcance.w;
        if (distancia2 >= alcance2) continue;

        vec3 paraLuz = delta * inversesqrt(max(distancia2, 0.001));
        float queda = 1.0 - distancia2 / alcance2;
        float intensidade = fonte.w * queda * queda / (1.0 + 0.17 * distancia2);
        float facho = 0.27 + 0.73 * smoothstep(-0.12, 0.74, paraLuz.y);
        float incidencia = max(dot(normal, paraLuz), 0.0);
        vec3 meio = normalize(paraLuz + paraCamera);
        float reflexo = pow(max(dot(normal, meio), 0.0), clamp(brilho, 8.0, 96.0));

        resultado += corAlcance.rgb * intensidade * facho *
            (difusa * incidencia + 0.13 * ambiente + 0.10 * especular * reflexo * incidencia);
    }

    return resultado;
}

vec3 limitarAltasLuzes(vec3 cor) {
    float pico = max(cor.r, max(cor.g, cor.b));
    if (pico <= 0.72) return cor;
    float saida = 0.72 + 0.27 * (1.0 - exp(-(pico - 0.72) / 0.27));
    return cor * (saida / pico);
}
`;
