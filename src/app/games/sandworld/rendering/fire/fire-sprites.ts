import { Texture } from 'pixi.js';

/*
  Sprites pixel del fuego: lenguas de llama de varios tamaños con 3 fotogramas (parpadean), generadas una vez.
  Colores de dentro a fuera: blanco amarillento, amarillo, naranja y rojo; la punta se deshilacha.
*/
const FLAME = [0x7a1a10, 0xc83a1a, 0xf08a24, 0xffd04a, 0xfff2b0];
export const FLAME_FRAMES = 3;

const cache = new Map<string, Texture>();

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Llama de `w` × `h` píxeles (pie abajo en el centro), fotograma 0..2 */
export function flameTexture(w: number, h: number, frame: number): Texture {
  w = Math.max(1, Math.round(w));
  h = Math.max(2, Math.round(h));
  const id = `${w}|${h}|${frame % FLAME_FRAMES}`;
  let tex = cache.get(id);
  if (tex) return tex;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    // Cada columna sube hasta una altura distinta según el fotograma (más alta en el centro)
    const centre = 1 - Math.abs(x - (w - 1) / 2) / Math.max(1, w / 2);
    const top = Math.max(1, Math.round(h * (0.35 + 0.65 * centre) * (0.6 + 0.4 * hash(x, frame, w * 31 + h))));
    for (let k = 0; k < top; k++) {
      const t = k / Math.max(1, top);
      if (t > 0.8 && hash(x, k + frame, h) < 0.5) continue;
      const c = t < 0.15 ? FLAME[4] : t < 0.4 ? FLAME[3] : t < 0.7 ? FLAME[2] : FLAME[1];
      const y = h - 1 - k;
      const o = (y * w + x) * 4;
      img.data[o] = c >> 16;
      img.data[o + 1] = (c >> 8) & 255;
      img.data[o + 2] = c & 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  cache.set(id, tex);
  return tex;
}
