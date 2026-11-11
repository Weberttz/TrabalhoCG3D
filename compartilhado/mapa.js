// Fonte única de dados do cenário: importada pelo cliente E pelo servidor.
// Coordenadas: X (esquerda/direita), Y (altura), Z (frente/trás).
// x, y, z representam o CENTRO; largura, altura, profundidade representam dimensões.
export const OBJETOS_QUARTO = Object.freeze([
  // Superfícies decorativas: não bloqueiam o deslocamento.
  { nome: 'piso', x: 0, y: -0.13, z: 0, largura: 12, altura: 0.25, profundidade: 12, cor: [0.54, 0.39, 0.28], solido: false },
  { nome: 'teto', x: 0, y: 3.15, z: 0, largura: 12, altura: 0.22, profundidade: 12, cor: [0.87, 0.86, 0.80], solido: false },
  { nome: 'parede_esquerda', x: -6.12, y: 1.5, z: 0, largura: 0.24, altura: 3, profundidade: 12.4, cor: [0.66, 0.72, 0.74], solido: true },
  { nome: 'parede_direita', x: 6.12, y: 1.5, z: 0, largura: 0.24, altura: 3, profundidade: 12.4, cor: [0.66, 0.72, 0.74], solido: true },
  { nome: 'parede_fundo', x: 0, y: 1.5, z: -6.12, largura: 12.4, altura: 3, profundidade: 0.24, cor: [0.76, 0.80, 0.78], solido: true },
  { nome: 'parede_frente', x: 0, y: 1.5, z: 6.12, largura: 12.4, altura: 3, profundidade: 0.24, cor: [0.76, 0.80, 0.78], solido: true },
  // Móveis com colisão validada no servidor.
  { nome: 'cama_base', x: -3.8, y: 0.31, z: -3.2, largura: 2.6, altura: 0.62, profundidade: 3.1, cor: [0.35, 0.25, 0.19], solido: true },
  { nome: 'colchao', x: -3.8, y: 0.70, z: -3.2, largura: 2.42, altura: 0.22, profundidade: 2.92, cor: [0.31, 0.54, 0.73], solido: false },
  { nome: 'travesseiro', x: -3.8, y: 0.86, z: -4.35, largura: 1.65, altura: 0.10, profundidade: 0.48, cor: [0.94, 0.92, 0.83], solido: false },
  { nome: 'mesa', x: 3.75, y: 0.60, z: -3.65, largura: 2.6, altura: 1.20, profundidade: 1.2, cor: [0.50, 0.33, 0.18], solido: true },
  { nome: 'monitor', x: 3.75, y: 1.39, z: -3.93, largura: 1.0, altura: 0.62, profundidade: 0.12, cor: [0.13, 0.19, 0.29], solido: false },
  { nome: 'tela_monitor', x: 3.75, y: 1.40, z: -3.85, largura: 0.87, altura: 0.48, profundidade: 0.04, cor: [0.16, 0.73, 0.77], solido: false },
  { nome: 'guarda_roupa', x: 4.55, y: 1.15, z: 2.8, largura: 1.85, altura: 2.30, profundidade: 1.15, cor: [0.48, 0.34, 0.24], solido: true },
  { nome: 'mesa_cabeceira', x: -5.1, y: 0.40, z: -0.70, largura: 0.8, altura: 0.8, profundidade: 0.8, cor: [0.57, 0.40, 0.29], solido: true },
  { nome: 'tapete', x: 0, y: 0.015, z: 1.45, largura: 3.1, altura: 0.025, profundidade: 2.2, cor: [0.55, 0.28, 0.30], solido: false },
  { nome: 'janela', x: 0, y: 1.85, z: -5.97, largura: 2.35, altura: 1.25, profundidade: 0.05, cor: [0.42, 0.70, 0.85], solido: false },
  { nome: 'porta', x: 0, y: 1.11, z: 5.96, largura: 1.4, altura: 2.22, profundidade: 0.05, cor: [0.43, 0.26, 0.16], solido: false },
]);

export const COLISORES_QUARTO = OBJETOS_QUARTO.filter(objeto => objeto.solido);