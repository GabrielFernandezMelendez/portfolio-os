import { Texture } from 'pixi.js';
import { DeerKind, DeerPose, deerArt } from './deer-art';
import { FAUNA_ANIM } from '../../config/fauna-art.config';

/*
  Texturas de la fauna a partir de los sprites generados por código: una por tipo, pose, fotograma y vista
  (de frente o de espaldas), creada una sola vez. Las otras dos direcciones se dibujan en espejo (escala x = -1).
*/

const cache = new Map<string, Texture>();

/** Momento de la animación (0..1) de cada fotograma de una pose */
export function frameTime(pose: DeerPose, frame: number): number {
  const frames = FAUNA_ANIM[pose].frames;
  if (pose === 'idle') return frame === 1 ? 0.8 : 0;     // segundo fotograma: baja la cabeza un momento
  return frames > 1 ? frame / frames : 0;
}

export function deerTexture(kind: DeerKind, pose: DeerPose, frame: number, back: boolean): Texture {
  const id = `${kind}|${pose}|${frame}|${back ? 1 : 0}`;
  let tex = cache.get(id);
  if (!tex) {
    tex = toTexture(kind, pose, frame, back);
    cache.set(id, tex);
  }
  return tex;
}

/** Píxeles de un fotograma volcados a un canvas (también lo usa el retrato de la ficha) */
export function deerCanvas(kind: DeerKind, pose: DeerPose, frame: number, back: boolean): HTMLCanvasElement {
  const art = deerArt(kind, pose, frameTime(pose, frame), back);
  const canvas = document.createElement('canvas');
  canvas.width = art.w;
  canvas.height = art.h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(art.w, art.h);
  for (let k = 0; k < art.colors.length; k++) {
    const c = art.colors[k];
    if (c < 0) continue;
    img.data[k * 4] = c >> 16;
    img.data[k * 4 + 1] = (c >> 8) & 255;
    img.data[k * 4 + 2] = c & 255;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toTexture(kind: DeerKind, pose: DeerPose, frame: number, back: boolean): Texture {
  const tex = Texture.from(deerCanvas(kind, pose, frame, back));
  tex.source.scaleMode = 'nearest';
  return tex;
}
