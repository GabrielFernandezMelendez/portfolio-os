// Configuración global de los tests (Vitest + jsdom).
// jsdom no implementa <canvas>: getContext() devuelve null y los componentes que dibujan
// (Game of Life, fondo móvil, RaceTime...) fallan al crearse en los tests.
// Aquí se sustituye por un contexto falso que acepta cualquier llamada y no dibuja nada.
// Solo afecta a los tests: en el navegador real se usa el canvas de verdad.

function createFakeContext(canvas: HTMLCanvasElement): unknown {
  const noop = (): void => undefined;
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'canvas') return canvas;
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'getImageData' || prop === 'createImageData') {
        return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      }
      return noop;                 // fillRect, drawImage, save, restore...
    },
    set() {
      return true;                 // fillStyle, lineWidth... se aceptan y se ignoran
    },
  });
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  writable: true,
  value: function (this: HTMLCanvasElement) {
    return createFakeContext(this);
  },
});