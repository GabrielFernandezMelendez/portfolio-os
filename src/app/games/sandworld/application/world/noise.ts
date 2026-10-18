// Ruido determinista sin estado: el mismo (x, y, semilla) siempre da el mismo valor.
// Se usa en coordenadas globales del mundo, así el relieve continúa entre chunks.

/** Hash de dos enteros a [0, 1) */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Curva suave (smoothstep) para interpolar sin esquinas */
export const smooth = (t: number): number => t * t * (3 - 2 * t);

export const clamp = (v: number, min = 0, max = 1): number => (v < min ? min : v > max ? max : v);

/** Ruido de valor 2D en [0, 1) */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Ruido fractal (3 octavas): formas grandes con detalle pequeño encima */
export function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, seed) * 0.55 +
    valueNoise(x * 2.1, y * 2.1, seed + 7) * 0.3 +
    valueNoise(x * 4.3, y * 4.3, seed + 13) * 0.15
  );
}
