import { Texture } from 'pixi.js';
import { ArtLook, PlantArt, paint, plantArt } from './plant-art';

/*
  Texturas de las plantas a partir de los sprites generados (plant-art.ts): una por planta, etapa y aspecto
  (redondeado a pasos), creada una sola vez. También la sombra proyectada y los fotogramas de un árbol que cae.
*/

/** Pasos en los que se redondea cada valor del aspecto (cada combinación es una textura en caché) */
export const LOOK_STEPS = 6;

const cache = new Map<string, Texture>();

const lookId = (l: ArtLook): string =>
  `${l.autumn}|${l.leaves}|${l.dry}|${l.stress}|${l.dead}|${l.fruit}|${l.gone}|${l.snow ? 1 : 0}`;

/** Redondea un valor 0..1 a los pasos del aspecto */
export const lookStep = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * LOOK_STEPS) / LOOK_STEPS;

/** Textura de una planta: `artKey` (planta, 'seed', 'sprout'…), joven o adulta, con un aspecto */
export function plantTexture(artKey: string, young: boolean, look: ArtLook): Texture {
  const id = `${artKey}|${young}|${lookId(look)}`;
  let tex = cache.get(id);
  if (!tex) {
    tex = toTexture(plantArt(artKey, young), paint(plantArt(artKey, young), look));
    cache.set(id, tex);
  }
  return tex;
}

/** Tamaño y pie de un sprite (para colocarlo con el pie en su celda) */
export function plantSize(artKey: string, young = false): { w: number; h: number; footX: number } {
  const a = plantArt(artKey, young);
  return { w: a.w, h: a.h, footX: a.footX };
}

function toTexture(art: PlantArt, colors: Int32Array, w = art.w, h = art.h): Texture {
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
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/**
 * Sombra proyectada en el suelo: un óvalo isométrico (2:1) de este ancho, más oscuro en el centro.
 * La luz viene de arriba a la izquierda, así que se dibuja un poco desplazada a la derecha del pie.
 */
export function shadowTexture(width: number): Texture {
  const rx = Math.max(2, Math.round(width * 0.55));
  const id = `shadow|${rx}`;
  let tex = cache.get(id);
  if (tex) return tex;
  const ry = rx / 2;
  const w = rx * 2 + 1, h = Math.ceil(ry) * 2 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = ((x - rx) / rx) ** 2 + ((y - (h - 1) / 2) / ry) ** 2;
      if (d > 1) continue;
      const k = (y * w + x) * 4;
      img.data[k] = 16; img.data[k + 1] = 40; img.data[k + 2] = 44;
      img.data[k + 3] = d < 0.55 ? 128 : 77;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  cache.set(id, tex);
  return tex;
}

/**
 * Fotograma de un árbol que cae hacia delante a la derecha, siguiendo el eje isométrico (2:1).
 * `angle` en grados (0 = de pie, 90 = tumbado). Sin las dos filas de abajo (se quedan como tocón).
 * Devuelve la textura y dónde queda el pie dentro de ella.
 */
export function fallTexture(artKey: string, look: ArtLook, angle: number): { tex: Texture; footX: number; footY: number } {
  const id = `fall|${artKey}|${lookId(look)}|${angle}`;
  const hit = fallCache.get(id);
  if (hit) return hit;
  const art = plantArt(artKey);
  const colors = paint(art, look);
  const a = (angle * Math.PI) / 180;
  const pivX = art.footX, pivY = art.h - 1;
  // Puntos proyectados (con submuestreo para que no queden huecos al girar)
  const pts: [number, number, number][] = [];
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (let j = 0; j < art.h - 2; j++) {
    for (let i = 0; i < art.w; i++) {
      const c = colors[j * art.w + i];
      if (c < 0) continue;
      for (const si of [-0.33, 0, 0.33]) {
        for (const sj of [-0.33, 0, 0.33]) {
          const l = i + si - pivX, z = pivY - (j + sj);
          const along = z * Math.sin(a);
          const x = Math.round(l + along * 0.9), y = Math.round(-z * Math.cos(a) + along * 0.45);
          pts.push([x, y, c]);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const out = new Int32Array(w * h).fill(-1);
  // De arriba abajo: lo de delante (más abajo en pantalla) queda encima
  pts.sort((p, q) => p[1] - q[1]);
  for (const [x, y, c] of pts) out[(y - minY) * w + (x - minX)] = c;
  const res = { tex: toTexture(art, out, w, h), footX: -minX, footY: -minY };
  fallCache.set(id, res);
  return res;
}

const fallCache = new Map<string, { tex: Texture; footX: number; footY: number }>();
