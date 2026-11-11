// As letras WASD continuam iguais, pois representam as teclas do teclado.
const teclas = { w: false, a: false, s: false, d: false };
const teclaPorCodigo = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };

for (const [nomeEvento, pressionada] of [['keydown', true], ['keyup', false]]) {
  window.addEventListener(nomeEvento, evento => {
    const tecla = teclaPorCodigo[evento.code];
    if (!tecla) return;
    teclas[tecla] = pressionada;
    evento.preventDefault();
  });
}

window.addEventListener('blur', () => {
  for (const tecla of Object.keys(teclas)) teclas[tecla] = false;
});

export function lerTeclas() {
  return { ...teclas }; // Entrega uma cópia, não o objeto interno.
}