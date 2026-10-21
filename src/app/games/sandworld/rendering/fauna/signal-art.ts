import { Texture } from 'pixi.js';
import { AnimalSignal } from '../../domain/models/animal.model';
import { SIGNAL_COLORS, SIGNAL_GLYPHS } from '../../config/fauna-art.config';

/*
  Signos sobre la cabeza de los animales: '!' (susto) y '?' (curiosidad), en pixel art con el mismo contorno que
  la flecha de selección. Comunes a todas las especies: una textura de cada, creada una sola vez.
*/

const cache = new Map<AnimalSignal, Texture>();

export function signalTexture(kind: AnimalSignal): Texture {
  let tex = cache.get(kind);
  if (!tex) {
    tex = Texture.from(signalCanvas(kind));
    tex.source.scaleMode = 'nearest';
    cache.set(kind, tex);
  }
  return tex;
}

function signalCanvas(kind: AnimalSignal): HTMLCanvasElement {
  const rows = SIGNAL_GLYPHS[kind];
  const [main, dark] = SIGNAL_COLORS[kind];
  const colour: Record<string, number> = { o: SIGNAL_COLORS.outline, W: SIGNAL_COLORS.shine, A: main, a: dark };
  const w = rows[0].length, h = rows.length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const c = colour[row[x]];
      if (c === undefined) continue;
      const k = (y * w + x) * 4;
      img.data[k] = c >> 16;
      img.data[k + 1] = (c >> 8) & 255;
      img.data[k + 2] = c & 255;
      img.data[k + 3] = 255;
    }
  });
  ctx.putImageData(img, 0, 0);
  return canvas;
}
