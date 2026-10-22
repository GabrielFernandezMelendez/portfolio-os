import { Texture } from 'pixi.js';
import { deerArt, DeerKind } from './deer-art';
import { rabbitArt, RabbitKind } from './rabbit-art';
import { wolfArt, WolfKind } from './wolf-art';
import { refugeArt, RefugeKind, RefugeState } from './burrow-art';
import { FAUNA_ANIM, SPECIES_ART } from '../../config/fauna-art.config';

/*
  Texturas de la fauna a partir de los sprites generados por código: una por especie, tipo, pose, fotograma y
  vista (de frente o de espaldas), creada una sola vez. Las otras dos direcciones se dibujan en espejo (escala x
  = -1). Añadir una especie = su generador aquí (ART) y su entrada en SPECIES_ART.
*/

export type FaunaPose = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead' | 'howl';

/** Lo que devuelve el generador de una especie: colores por píxel (-1 transparente) */
interface Art {
  readonly w: number;
  readonly h: number;
  readonly colors: Int32Array;
}
type ArtFn = (kind: string, pose: FaunaPose, t: number, back: boolean) => Art;

/** Generador de cada especie */
const ART: Readonly<Record<string, ArtFn>> = {
  // Solo el lobo aúlla: las demás especies lo dibujan quietas
  deer: (k, p, t, b) => deerArt(k as DeerKind, p === 'howl' ? 'idle' : p, t, b),
  rabbit: (k, p, t, b) => rabbitArt(k as RabbitKind, p === 'howl' ? 'idle' : p, t, b),
  wolf: (k, p, t, b) => wolfArt(k as WolfKind, p, t, b),
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

/** Refugio (madriguera, cueva o guarida de ramas) en su estado, y el punto de su entrada en el dibujo */
export function refugeTexture(kind: RefugeKind, state: RefugeState): { texture: Texture; footX: number; footY: number; w: number; h: number } {
  const id = `refuge|${kind}|${state}`;
  const art = refugeArt(kind, state);
  let tex = cache.get(id);
  if (!tex) {
    tex = toTexture(toCanvas(art.colors, art.w, art.h));
    cache.set(id, tex);
  }
  return { texture: tex, footX: art.footX, footY: art.footY, w: art.w, h: art.h };
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
