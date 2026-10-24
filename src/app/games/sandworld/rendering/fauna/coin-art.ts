import { Texture } from 'pixi.js';
import { COIN, COIN_DIGITS, COIN_FACES, COIN_PORTRAIT, SPECIES_ART } from '../../config/fauna-art.config';
import { animalPixels } from './fauna-sprites';

/*
  Monedas de la vista de lejos: una por especie (canto dorado, fondo de prado y la cara de la especie, luz arriba a
  la izquierda) y la insignia con el número de animales de la manada. Generadas por código y creadas una sola vez.
*/

const coins = new Map<string, Texture>();
const badges = new Map<number, Texture>();

/** Moneda de una especie, dibujada a su densidad (el sprite se escala por 1 / density) */
export function coinTexture(species: string): Texture {
  let tex = coins.get(species);
  if (!tex) {
    const portrait = COIN_PORTRAIT[species];
    const d = portrait ? SPECIES_ART[species]?.density ?? 1 : 1;
    tex = portrait ? toTexture(portraitPixels(species, d), COIN.size * d, COIN.size * d) : toTexture(coinPixels(species), COIN.size, COIN.size);
    coins.set(species, tex);
  }
  return tex;
}

/** Insignia con el número (hasta 99; más, se queda en 99) */
export function badgeTexture(count: number): Texture {
  const n = Math.max(0, Math.min(99, count));
  let tex = badges.get(n);
  if (!tex) {
    const digits = String(n).split('').map(Number);
    const w = digits.length * 4 + 3, h = 9;
    const px = new Int32Array(w * h).fill(-1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
        if (corner) continue;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        px[y * w + x] = edge ? COIN.outline : COIN.badge;
      }
    }
    digits.forEach((d, k) => COIN_DIGITS[d].forEach((row, j) => {
      for (let i = 0; i < 3; i++) if (row[i] === 'x') px[(2 + j) * w + 2 + k * 4 + i] = COIN.digit;
    }));
    tex = toTexture(px, w, h);
    badges.set(n, tex);
  }
  return tex;
}

function coinPixels(species: string): Int32Array {
  const N = COIN.size, c = (N - 1) / 2;
  const px = new Int32Array(N * N).fill(-1);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - c, y - c);
      let col = -1;
      if (d > c + 0.4) col = -1;
      else if (d > c - 0.6) col = COIN.outline;
      else if (d > c - 2) {
        // Canto: claro arriba a la izquierda, oscuro abajo a la derecha
        const l = (x - c + (y - c)) / c;
        col = l < -0.5 ? COIN.rim[0] : l > 0.5 ? COIN.rim[2] : COIN.rim[1];
      } else if (d > c - 2.6) col = COIN.outline;
      else col = (x + y) % 2 === 0 && x - c + (y - c) > 3 ? COIN.faceShade : COIN.face;
      px[y * N + x] = col;
    }
  }
  const face = COIN_FACES[species];
  if (face) {
    const ox = Math.floor((N - face.rows[0].length) / 2), oy = face.oy ?? 4;
    face.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = face.colors[row[i]];
        if (col !== undefined) px[(oy + j) * N + ox + i] = col;
      }
    });
  }
  return px;
}

/**
 * Moneda con retrato (especies en alta densidad): el aro de siempre ampliado a la densidad de la especie y dentro
 * la cabeza y los hombros de su propio sprite (quieto, de frente), recortados en círculo.
 */
function portraitPixels(species: string, d: number): Int32Array {
  const p = COIN_PORTRAIT[species], base = coinPixels(''), N = COIN.size, M = N * d;
  const px = new Int32Array(M * M);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) px[y * M + x] = base[Math.floor(y / d) * N + Math.floor(x / d)];
  const art = animalPixels(species, p.kind, 'idle', 0, false);
  // Caja de lo dibujado
  let x0 = art.w, y0 = art.h, x1 = -1;
  for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
    if (art.colors[y * art.w + x] < 0) continue;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y);
  }
  const cx0 = x0 - 1, cw = x1 - x0 + 3;
  const ox = Math.floor(M / 2 - cw / 2), c = (M - 1) / 2;
  for (let j = 0; j < p.top; j++) {
    for (let i = 0; i < cw; i++) {
      const sx = cx0 + i, sy = y0 + j;
      if (sx < 0 || sx >= art.w || sy >= art.h) continue;
      const col = art.colors[sy * art.w + sx];
      const x = ox + i, y = p.oy + j;
      if (col < 0 || x < 0 || x >= M || y >= M || Math.hypot(x - c, y - c) >= p.radius) continue;
      px[y * M + x] = col;
    }
  }
  return px;
}

const coinImages = new Map<string, string>();

/**
 * La misma moneda como imagen (data URL) para la interfaz (panel de Equilibrio). Se dibuja una vez por especie;
 * el `<img>` la escala con `image-rendering: pixelated`.
 */
export function coinImage(species: string): string {
  let url = coinImages.get(species);
  if (!url) {
    const portrait = COIN_PORTRAIT[species];
    const d = portrait ? SPECIES_ART[species]?.density ?? 1 : 1;
    url = portrait ? toCanvas(portraitPixels(species, d), COIN.size * d, COIN.size * d).toDataURL() : toCanvas(coinPixels(species), COIN.size, COIN.size).toDataURL();
    coinImages.set(species, url);
  }
  return url;
}

function toTexture(px: Int32Array, w: number, h: number): Texture {
  const tex = Texture.from(toCanvas(px, w, h));
  tex.source.scaleMode = 'nearest';
  return tex;
}

function toCanvas(px: Int32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let k = 0; k < px.length; k++) {
    const c = px[k];
    if (c < 0) continue;
    img.data[k * 4] = c >> 16;
    img.data[k * 4 + 1] = (c >> 8) & 255;
    img.data[k * 4 + 2] = c & 255;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
