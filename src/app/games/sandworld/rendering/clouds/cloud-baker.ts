import { CLOUD_RAMP } from '../../config/palette.config';
import { clamp, hash2, smooth } from '../../application/world/noise';

/*
  Horneado de nubes en buffers RGBA (funciones puras: sin Pixi ni DOM, testeables en Node).

  - Mar de nubes: textura opaca que encaja consigo misma por los cuatro lados, así se repite sin fin
    con un TilingSprite. Los rasgos son el doble de anchos que de altos (perspectiva isométrica)
    y la luz viene de arriba: la parte alta de cada bulto es blanca y la sombra queda debajo.
  - Copos: textura con transparencia para la capa alta, que se mueve más rápido (profundidad).
  - Copo suelto: racimo de óvalos para el manto que cubre un chunk antes de aparecer.
  El tramado Bayer es el mismo del terreno: degradados sin perder el pixel art.
*/

export const CLOUD_TILE_W = 256;
export const CLOUD_TILE_H = 128;

/** Copos del manto de aparición */
export const PUFF_W = 44;
export const PUFF_H = 22;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)];

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Ruido de valor periódico: se repite cada `px` × `py` celdas de rejilla */
function tileNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const h = (i: number, j: number): number => hash2(mod(i, px), mod(j, py), seed);
  const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** fbm periódico: cada octava dobla frecuencia y periodo, así sigue encajando */
function tileFbm(x: number, y: number, px: number, py: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(x * f, y * f, px * f, py * f, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function put(out: Uint8ClampedArray, k: number, color: number, alpha = 255): void {
  out[k] = color >> 16;
  out[k + 1] = (color >> 8) & 255;
  out[k + 2] = color & 255;
  out[k + 3] = alpha;
}

const tone = (val: number, x: number, y: number): number =>
  CLOUD_RAMP[clamp(Math.floor(val * (CLOUD_RAMP.length - 1) + bayer(x, y)), 0, CLOUD_RAMP.length - 1)];

/** Mar de nubes opaco y repetible (CLOUD_TILE_W × CLOUD_TILE_H) */
export function bakeCloudSea(seed: number, out: Uint8ClampedArray): void {
  const W = CLOUD_TILE_W, H = CLOUD_TILE_H;
  // 4 × 4 celdas en una textura de 2:1 → rasgos grandes, el doble de anchos que de altos
  const P = 4, Q = 4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * P, v = (y / H) * Q;
      const n = tileFbm(u, v, P, Q, seed, 3);
      // Ruido "abultado": crestas redondas en lugar de manchas
      const puff = 1 - Math.abs(n * 2 - 1);
      const below = 1 - Math.abs(tileFbm(u, v + 0.1, P, Q, seed, 3) * 2 - 1);
      // Luz cenital: la parte alta de cada bulto es blanca; la sombra solo bajo los bultos
      const lit = (puff - below) * 5;
      const val = clamp(0.42 + puff * 0.5 + lit);
      put(out, (y * W + x) * 4, tone(val, x, y));
    }
  }
}

/** Capa alta: copos sueltos con transparencia (repetible) */
export function bakeCloudWisps(seed: number, out: Uint8ClampedArray): void {
  const W = CLOUD_TILE_W, H = CLOUD_TILE_H;
  const P = 4, Q = 4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * P, v = (y / H) * Q;
      const n = tileFbm(u, v, P, Q, seed + 500);
      const k = (y * W + x) * 4;
      if (n < 0.6) {
        out[k + 3] = 0;
        continue;
      }
      const below = tileFbm(u, v + 0.15, P, Q, seed + 500);
      const val = clamp(0.55 + (n - below) * 7 + (n - 0.6) * 1.5);
      put(out, k, tone(val, x, y));
    }
  }
}

/**
 * Copo suelto (w × h): unión de óvalos con el borde tramado, claro arriba y en sombra abajo.
 * Forma el manto que cubre un chunk antes de que aparezca.
 */
export function bakeCloudPuff(seed: number, w: number, h: number, out: Uint8ClampedArray): void {
  out.fill(0);
  const blobs = 3 + Math.floor(hash2(1, 2, seed) * 3);
  const centers = Array.from({ length: blobs }, (_, i) => ({
    x: (0.2 + 0.6 * (i + 0.5) / blobs + (hash2(i, 7, seed) - 0.5) * 0.12) * w,
    y: h * (0.55 + (hash2(i, 9, seed) - 0.5) * 0.2),
    r: (0.22 + hash2(i, 11, seed) * 0.12) * w,
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = 0;
      for (const c of centers) {
        const dx = (x - c.x) / c.r, dy = (y - c.y) / (c.r * 0.55);
        inside = Math.max(inside, 1 - (dx * dx + dy * dy));
      }
      // Borde tramado: se funde con el mar de nubes de detrás
      if (inside <= 0 || y > h * 0.8) continue;
      if (inside < 0.12 && bayer(x, y) > inside / 0.12) continue;
      const val = clamp(0.95 - (y / h) * 0.9 + inside * 0.2);
      put(out, (y * w + x) * 4, tone(val, x, y));
    }
  }
}

/**
 * Sombra de la isla sobre las nubes: rombo (w × h px) con un tramado al 50 %,
 * más claro en los bordes para que no parezca un recorte.
 */
export function bakeIslandShadow(w: number, h: number, color: number, out: Uint8ClampedArray): void {
  out.fill(0);
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx) / cx + Math.abs(y - cy) / cy;   // 0 centro, 1 borde del rombo
      if (d > 1) continue;
      const density = d < 0.8 ? 0.5 : 0.5 * (1 - (d - 0.8) / 0.2);
      if (bayer(x, y) < density) put(out, (y * w + x) * 4, color);
    }
  }
}
