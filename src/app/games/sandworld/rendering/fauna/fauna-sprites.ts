import { Texture } from 'pixi.js';
import { deerArt, DeerKind } from './deer-art';
import { rabbitArt, RabbitKind } from './rabbit-art';
import { BURROW_COLORS, FAUNA_ANIM, SPECIES_ART } from '../../config/fauna-art.config';
import { Pixels } from './pixel-canvas';

/*
  Texturas de la fauna a partir de los sprites generados por código: una por especie, tipo, pose, fotograma y
  vista (de frente o de espaldas), creada una sola vez. Las otras dos direcciones se dibujan en espejo (escala x
  = -1). Añadir una especie = su generador aquí (ART) y su entrada en SPECIES_ART.
*/

export type FaunaPose = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead';

/** Lo que devuelve el generador de una especie: colores por píxel (-1 transparente) */
interface Art {
  readonly w: number;
  readonly h: number;
  readonly colors: Int32Array;
}
type ArtFn = (kind: string, pose: FaunaPose, t: number, back: boolean) => Art;

/** Generador de cada especie */
const ART: Readonly<Record<string, ArtFn>> = {
  deer: (k, p, t, b) => deerArt(k as DeerKind, p, t, b),
  rabbit: (k, p, t, b) => rabbitArt(k as RabbitKind, p, t, b),
};

const cache = new Map<string, Texture>();

/** Tipo de dibujo de un animal: su cría ('fawn', 'kit'...) o su sexo */
export function artKind(species: string, young: boolean, sex: 'male' | 'female'): string {
  return young ? SPECIES_ART[species]?.young ?? sex : sex;
}

/** Momento de la animación (0..1) de cada fotograma de una pose */
export function frameTime(pose: FaunaPose, frame: number): number {
  const frames = FAUNA_ANIM[pose].frames;
  if (pose === 'idle') return frame === 1 ? 0.8 : 0;     // segundo fotograma: cabeceo o tic de orejas
  return frames > 1 ? frame / frames : 0;
}

export function animalTexture(species: string, kind: string, pose: FaunaPose, frame: number, back: boolean): Texture {
  const id = `${species}|${kind}|${pose}|${frame}|${back ? 1 : 0}`;
  let tex = cache.get(id);
  if (!tex) {
    tex = toTexture(animalCanvas(species, kind, pose, frame, back));
    cache.set(id, tex);
  }
  return tex;
}

/** Píxeles de un fotograma volcados a un canvas (también lo usa el retrato de la ficha) */
export function animalCanvas(species: string, kind: string, pose: FaunaPose, frame: number, back: boolean): HTMLCanvasElement {
  const art = (ART[species] ?? ART['deer'])(kind, pose, frameTime(pose, frame), back);
  return toCanvas(art.colors, art.w, art.h);
}

/**
 * Entrada de madriguera: agujero oscuro con la tierra removida alrededor (luz arriba a la izquierda). Mientras
 * la cavan, solo el montón de tierra; tapada (Duna), con el agujero lleno de arena.
 */
export function burrowTexture(state: 'digging' | 'open' | 'blocked'): Texture {
  const id = `burrow|${state}`;
  let tex = cache.get(id);
  if (!tex) {
    const W = 15, H = 9, cx = 7, cy = 4.6;
    const cv = new Pixels(W, H);
    const [d0, d1, d2] = BURROW_COLORS.dirt, [h0, h1] = BURROW_COLORS.hole;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - cx) / (state === 'digging' ? 5 : 7.2), dy = (y + 0.5 - cy) / (state === 'digging' ? 3 : 4.2);
        if (dx * dx + dy * dy <= 1) {
          const l = -(x - cx) * 0.3 - (y - cy) * 0.7;
          cv.put(x, y, l > 1.2 ? d2 : l > -0.8 ? d1 : d0);
        }
        if (state === 'digging') continue;
        const hx = (x + 0.5 - cx) / 4.2, hy = (y + 0.5 - (cy + 0.6)) / 2.3, hd = hx * hx + hy * hy;
        if (hd <= 1) cv.put(x, y, state === 'blocked' ? (hd < 0.5 ? BURROW_COLORS.sand[1] : BURROW_COLORS.sand[0]) : hd < 0.55 || y > cy + 0.6 ? h0 : h1);
      }
    }
    // Terrones sueltos alrededor
    for (const [x, y] of [[2, 6], [12, 6], [3, 2]]) cv.put(x, y, d2);
    tex = toTexture(toCanvas(cv.outlined(BURROW_COLORS.outline), W, H));
    cache.set(id, tex);
  }
  return tex;
}

function toCanvas(colors: Int32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let k = 0; k < colors.length; k++) {
    const c = colors[k];
    if (c < 0) continue;
    img.data[k * 4] = c >> 16;
    img.data[k * 4 + 1] = (c >> 8) & 255;
    img.data[k * 4 + 2] = c & 255;
    img.data[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toTexture(canvas: HTMLCanvasElement): Texture {
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}
