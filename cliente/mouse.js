// O movimento do mouse altera a orientação local da câmera.
const SENSIBILIDADE = 0.0025;
const LIMITE_INCLINACAO = Math.PI / 2 - 0.08;
let anguloHorizontal = 0; // yaw: 0 aponta para -Z.
let anguloVertical = 0; // pitch: 0 aponta para a linha do horizonte.
let capturado = false;

const limitar = (numero, minimo, maximo) =>
    Math.max(minimo, Math.min(maximo, numero));

export function iniciarMouse(canvas) {
    // Monitora a ocorrência de uma ação específica
    canvas.addEventListener('click', () => {
        if (document.pointerLockElement !== canvas) {
            canvas.requestPointerLock();
        }
    });
    document.addEventListener('pointerlockchange', () => {
        capturado = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', evento => {
        if (!capturado) return;
        anguloHorizontal += evento.movementX * SENSIBILIDADE;
        anguloVertical = limitar(
            anguloVertical - evento.movementY * SENSIBILIDADE,
            -LIMITE_INCLINACAO, LIMITE_INCLINACAO
        );
        // Limita o valor enviado; não altera a direção resultante.
        anguloHorizontal = Math.atan2(
            Math.sin(anguloHorizontal), Math.cos(anguloHorizontal)
        );
    });
}
export function obterOrientacao() {
    return { anguloHorizontal, anguloVertical };
}