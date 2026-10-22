import { Texture } from 'pixi.js';
import { deerArt, DeerKind } from './deer-art';
import { rabbitArt, RabbitKind } from './rabbit-art';
import { wolfArt, WolfKind } from './wolf-art';
import { crowArt, CrowPose } from './crow-art';
import { humanArt, HumanKind, HumanPose } from './human-art';
import { goblinArt, GoblinPose } from './goblin-art';
import { refugeArt, RefugeKind, RefugeState } from './burrow-art';
import { FAUNA_ANIM, SPECIES_ART } from '../../config/fauna-art.config';

/*
  Texturas de la fauna a partir de los sprites generados por código: una por especie, tipo, pose, fotograma y
  vista (de frente o de espaldas), creada una sola vez. Las otras dos direcciones se dibujan en espejo (escala x
  = -1). Añadir una especie = su generador aquí (ART) y su entrada en SPECIES_ART.
*/

export type FaunaPose = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead' | 'howl' | 'fly' | 'hunt';

/** Lo que devuelve el generador de una especie: colores por píxel (-1 transparente) */
interface Art {
  readonly w: number;
  readonly h: number;
  readonly colors: Int32Array;
}
type ArtFn = (kind: string, pose: FaunaPose, t: number, back: boolean, variant: number) => Art;

/** Pose común → la que tiene dibujada la especie (lo que no tiene, con la que más se le parece) */
type Basic = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead';
const basic = (p: FaunaPose): Basic => (p === 'howl' ? 'idle' : p === 'fly' ? 'run' : p === 'hunt' ? 'run' : p);
const CROW_POSE: Readonly<Record<FaunaPose, CrowPose>> = {
  idle: 'idle', walk: 'walk', run: 'fly', eat: 'eat', drink: 'eat', sleep: 'sleep', dead: 'dead', howl: 'caw', fly: 'fly', hunt: 'walk',
};
const HUMAN_POSE: Readonly<Record<FaunaPose, HumanPose>> = {
  idle: 'idle', walk: 'walk', run: 'run', eat: 'gather', drink: 'gather', sleep: 'sleep', dead: 'dead', howl: 'idle', fly: 'run', hunt: 'hunt',
};
const GOBLIN_POSE: Readonly<Record<FaunaPose, GoblinPose>> = {
  idle: 'idle', walk: 'walk', run: 'run', eat: 'eat', drink: 'eat', sleep: 'idle', dead: 'dead', howl: 'attack', fly: 'run', hunt: 'attack',
};
const HUMAN_KIND: Readonly<Record<string, HumanKind>> = { male: 'man', female: 'woman', child: 'child' };

/** Generador de cada especie */
const ART: Readonly<Record<string, ArtFn>> = {
  // Solo el lobo aúlla: las demás especies lo dibujan quietas
  deer: (k, p, t, b) => deerArt(k as DeerKind, basic(p), t, b),
  rabbit: (k, p, t, b) => rabbitArt(k as RabbitKind, basic(p), t, b),
  wolf: (k, p, t, b) => wolfArt(k as WolfKind, p === 'fly' || p === 'hunt' ? 'run' : p, t, b),
  crow: (k, p, t, b) => crowArt(k === 'chick' ? 'chick' : 'adult', CROW_POSE[p], t, b),
  human: (k, p, t, b, v) => humanArt(HUMAN_KIND[k] ?? 'man', HUMAN_POSE[p], t, b, v % 2),
  goblin: (k, p, t, b) => goblinArt(k === 'young' ? 'young' : 'adult', GOBLIN_POSE[p], t, b),
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

export function animalTexture(species: string, kind: string, pose: FaunaPose, frame: number, back: boolean, variant = 0): Texture {
  const id = `${species}|${kind}|${pose}|${frame}|${back ? 1 : 0}|${variant}`;
  let tex = cache.get(id);
  if (!tex) {
    tex = toTexture(animalCanvas(species, kind, pose, frame, back, variant));
    cache.set(id, tex);
  }
  return tex;
}

/** Píxeles de un fotograma volcados a un canvas (también lo usa el retrato de la ficha) */
export function animalCanvas(species: string, kind: string, pose: FaunaPose, frame: number, back: boolean, variant = 0): HTMLCanvasElement {
  const art = animalPixels(species, kind, pose, frame, back, variant);
  return toCanvas(art.colors, art.w, art.h);
}

/** Píxeles de un fotograma (también los usa la moneda con retrato) */
export function animalPixels(species: string, kind: string, pose: FaunaPose, frame: number, back: boolean, variant = 0): Art {
  return (ART[species] ?? ART['deer'])(kind, pose, frameTime(pose, frame), back, variant);
}

/** Variante de dibujo de un individuo (p. ej. tono de piel), fija para toda su vida */
export function artVariant(species: string, id: number): number {
  const n = SPECIES_ART[species]?.variants ?? 1;
  return n > 1 ? id % n : 0;
}

/** Refugio (madriguera, cueva, guarida, nido, choza...) en su estado, el punto de su entrada en el dibujo y su densidad */
export function refugeTexture(kind: RefugeKind, state: RefugeState): { texture: Texture; footX: number; footY: number; w: number; h: number; density: number; lift: number } {
  const id = `refuge|${kind}|${state}`;
  const art = refugeArt(kind, state);
  let tex = cache.get(id);
  if (!tex) {
    tex = toTexture(toCanvas(art.colors, art.w, art.h));
    cache.set(id, tex);
  }
  return { texture: tex, footX: art.footX, footY: art.footY, w: art.w, h: art.h, density: art.density, lift: art.lift };
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
