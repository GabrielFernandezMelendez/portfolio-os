import { ArtPart, ArtSpec, PLANT_ART, PLANT_FLAT, PLANT_RAMPS, RampKey, YOUNG_SCALE } from '../../config/plant-art.config';

/*
  Generador de los sprites de las plantas: cada pieza (racimo, tronco, piso de pino…) se ilumina como un pequeño
  sólido con una sola luz arriba a la izquierda (la misma que el terreno), con rampas de 6 tonos con el tono
  desplazado, sombra de contacto entre racimos y contorno selectivo abajo a la derecha.
  No depende de Pixi: devuelve píxeles con etiqueta (hoja, madera, fruto, color plano) y paso de rampa, para que
  el dibujo pueda secarlos, volverlos ocres, quitarles el fruto o hacerles perder las hojas.
*/

export type PixelTag = 'leaf' | 'wood' | 'fruit' | 'flat';

export interface ArtPixel {
  readonly ramp: RampKey | null;
  step: number;
  readonly tag: PixelTag;
  /** Color fijo (piezas planas: flores, setas, piedras) */
  readonly color?: number;
  readonly depth: number;
}

/** Sprite generado: tres capas del mismo tamaño (índice = j * w + i). El pie está en (footX, h - 1). */
export interface PlantArt {
  readonly w: number;
  readonly h: number;
  readonly footX: number;
  /** Lo que se ve normalmente */
  readonly base: readonly (ArtPixel | null)[];
  /** Ramas que quedan a la vista cuando caen las hojas */
  readonly under: readonly (ArtPixel | null)[];
  /** Frutos (encima de todo; desaparecen al comérselos) */
  readonly fruit: readonly (ArtPixel | null)[];
}

const STEPS = 6;
const L = normalize([-0.6, -0.7, 0.3]);   // luz: x derecha, y abajo, z hacia quien mira

function normalize(v: number[]): [number, number, number] {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Azar fijo por píxel (mismo resultado siempre) */
export function pixelHash(i: number, j: number, salt: number): number {
  let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Paso de rampa (0..5) de una superficie con esta normal */
function shade(nx: number, ny: number, nz: number, bias: number): number {
  const d = nx * L[0] + ny * L[1] + nz * L[2];
  const v = 0.02 + (d * 0.5 + 0.5) * 0.85 + bias;
  return Math.max(0, Math.min(STEPS - 1, Math.floor(v * (STEPS - 0.2))));
}

type Layer = Map<string, ArtPixel & { x: number; y: number }>;
const key = (x: number, y: number): string => `${x},${y}`;

function put(layer: Layer, x: number, y: number, p: ArtPixel, force = false): void {
  const old = layer.get(key(x, y));
  if (force || !old || p.depth >= old.depth) layer.set(key(x, y), { ...p, x, y });
}

const cache = new Map<string, PlantArt>();

/** Sprite de una planta (o de una etapa o resto compartido) por clave; `young` = planta joven (más pequeña) */
export function plantArt(artKey: string, young = false): PlantArt {
  const id = `${artKey}|${young}`;
  let art = cache.get(id);
  if (!art) {
    art = build(PLANT_ART[artKey] ?? PLANT_ART['grass'], young);
    cache.set(id, art);
  }
  return art;
}

function build(spec: ArtSpec, young: boolean): PlantArt {
  const s = young ? YOUNG_SCALE : 1;
  const base: Layer = new Map(), under: Layer = new Map(), fruit: Layer = new Map();
  const blobs: { x: number; y: number }[] = [];
  let trunkTop = 0;

  for (const part of spec.parts) {
    switch (part.kind) {
      case 'map': drawMap(base, part.rows, spec.ramp, young); break;
      case 'trunk': {
        const x0 = Math.round(part.x0 * s), x1 = Math.round(part.x1 * s), y1 = Math.max(1, Math.round(part.y1 * s));
        trunkTop = Math.max(trunkTop, y1);
        drawTrunk(base, x0, x1, Math.round(part.y0 * s), y1, part.ramp ?? 'trunk');
        break;
      }
      case 'blob':
        blobs.push({ x: part.x * s, y: part.y * s });
        drawBlob(base, part.x * s, -part.y * s, Math.max(1.2, part.rx * s), Math.max(1, part.ry * s), part.ramp ?? spec.ramp, part.d, part.bias ?? 0);
        break;
      case 'cone': drawCone(base, part.x * s, part.y * s, Math.max(1.2, part.rx * s), Math.max(2, part.h * s), spec.ramp, part.d); break;
      case 'hang': drawHang(base, Math.round(part.x * s), Math.round(part.y * s), Math.max(1, Math.round(part.len * s)), spec.ramp); break;
      case 'branch':
        drawLine(base, Math.round(part.from[0] * s), -Math.round(part.from[1] * s), Math.round(part.to[0] * s), -Math.round(part.to[1] * s),
          part.ramp ?? 'trunk', spec.parts.some(p => p.kind === 'blob') ? -0.5 : 0);
        break;
      case 'fruit':
        if (young) break;
        for (const [x, y] of part.at) {
          put(fruit, x, -y, { ramp: part.ramp, step: 3, tag: 'fruit', depth: 9 }, true);
          put(fruit, x, -y + 1, { ramp: part.ramp, step: 1, tag: 'fruit', depth: 9 }, true);
        }
        break;
    }
  }
  // Ramas automáticas del tronco hacia cada racimo: quedan debajo de las hojas y se ven en invierno
  if (spec.branches) {
    for (const b of blobs) {
      const tx = Math.round(b.x * 1.3), ty = -Math.round(b.y + 1);
      drawLine(under, 0, -trunkTop, tx, ty, 'trunk', 0);
      // Una ramita que sale de la mitad hacia fuera y arriba
      const mx = Math.round(tx / 2), my = Math.round((ty - trunkTop) / 2);
      drawLine(under, mx, my, mx + (tx >= 0 ? 2 : -2), my - 2, 'trunk', 0);
    }
  }
  if (blobs.length) contactShadows(base);
  if (spec.outline) outline(base);
  return pack(base, under, fruit);
}

// ── Piezas ──

function drawMap(layer: Layer, rows: readonly string[], ramp: RampKey, young: boolean): void {
  const use = young ? rows.slice(rows.length - Math.max(2, Math.ceil(rows.length * YOUNG_SCALE))) : rows;
  const R = use.length, W = use[0].length, half = Math.floor(W / 2);
  const STEP: Record<string, number> = { O: 0, g: 1, G: 2, L: 4 };
  use.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    const x = c - half, y = -(R - 1 - r);
    if (STEP[ch] !== undefined) put(layer, x, y, { ramp, step: STEP[ch], tag: 'leaf', depth: 0 });
    else if (PLANT_FLAT[ch] !== undefined) put(layer, x, y, { ramp: null, step: 0, tag: 'flat', color: PLANT_FLAT[ch], depth: 0 });
  }));
  // Luz automática: el borde izquierdo de cada hoja, más claro; el derecho, más oscuro
  for (const p of layer.values()) {
    if (p.tag !== 'leaf') continue;
    if (!layer.has(key(p.x - 1, p.y)) && p.step < STEPS - 1) p.step++;
    else if (!layer.has(key(p.x + 1, p.y)) && p.step > 0) p.step--;
  }
}

function drawTrunk(layer: Layer, x0: number, x1: number, y0: number, y1: number, ramp: RampKey): void {
  const width = x1 - x0 + 1;
  const steps = width >= 3 ? [4, 2, 1] : width === 2 ? [3, 1] : [2];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const st = steps[Math.min(steps.length - 1, Math.floor(((x - x0) / width) * steps.length))];
      put(layer, x, -y, { ramp, step: st, tag: 'wood', depth: -1 });
    }
  }
  // Raíces: el pie se ensancha un poco
  if (width >= 2) {
    put(layer, x0 - 1, 0, { ramp, step: 2, tag: 'wood', depth: -1 });
    put(layer, x1 + 1, 0, { ramp, step: 0, tag: 'wood', depth: -1 });
  }
}

function drawBlob(layer: Layer, cx: number, cy: number, rx: number, ry: number, ramp: RampKey, depth: number, bias: number): void {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const r2 = dx * dx + dy * dy;
      // Borde mordido: el follaje no es un óvalo perfecto
      if (r2 > 1 - 0.35 * (pixelHash(x, y, depth + 3) - 0.5) * 0.6) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      const st = shade(dx, dy, nz, bias + (pixelHash(x, y, depth + 10) - 0.5) * 0.18);
      put(layer, x, y, { ramp, step: st, tag: 'leaf', depth });
    }
  }
}

function drawCone(layer: Layer, cx: number, baseY: number, rx: number, h: number, ramp: RampKey, depth: number): void {
  for (let k = 0; k <= Math.ceil(h); k++) {
    const t = k / h;
    if (t > 1) break;
    const y = -Math.round(baseY + k);
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const half = rx * (1 - t) - 0.2 * pixelHash(x, y, depth);
      if (Math.abs(x - cx) > half) continue;
      let st = shade((x - cx) / rx, 0.3 - t * 0.6, 0.6, -0.05 + depth * 0.04 + (pixelHash(x, y, 9) - 0.5) * 0.15);
      if (k === 0) st = Math.max(0, st - 2);     // la base de cada piso, en sombra
      put(layer, x, y, { ramp, step: st, tag: 'leaf', depth });
    }
  }
}

function drawHang(layer: Layer, x: number, y: number, len: number, ramp: RampKey): void {
  for (let k = 0; k < len; k++) {
    if (pixelHash(x, k, 41) < 0.12) continue;
    const st = Math.max(1, 4 - Math.floor((k * 4) / len));
    put(layer, x, -y + k, { ramp, step: st, tag: 'leaf', depth: 6 });
  }
}

function drawLine(layer: Layer, x0: number, y0: number, x1: number, y1: number, ramp: RampKey, depth: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
    put(layer, x, y, { ramp, step: k % 3 === 0 ? 3 : 2, tag: 'wood', depth });
  }
}

/** Un racimo delantero oscurece el borde del de detrás (sombra de contacto) */
function contactShadows(layer: Layer): void {
  for (const p of layer.values()) {
    const up = layer.get(key(p.x - 1, p.y - 1));
    if (up && up.depth > p.depth && p.tag === 'leaf' && p.step > 0) p.step--;
  }
}

/** Contorno selectivo: abajo y a la derecha, el tono más oscuro; arriba a la izquierda, un brillo de luz rasante */
function outline(layer: Layer): void {
  const add: [number, number, ArtPixel][] = [];
  for (const p of layer.values()) {
    if (p.tag === 'flat') continue;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
      const k = key(p.x + dx, p.y + dy);
      if (!layer.has(k) && p.y + dy <= 0) add.push([p.x + dx, p.y + dy, { ramp: p.ramp, step: 0, tag: p.tag, depth: -2 }]);
    }
  }
  for (const p of layer.values()) {
    if (p.tag === 'leaf' && !layer.has(key(p.x - 1, p.y)) && !layer.has(key(p.x, p.y - 1)) && p.step < STEPS - 1) p.step++;
  }
  for (const [x, y, p] of add) if (!layer.has(key(x, y))) put(layer, x, y, p);
}

/** Pasa las capas a arrays del mismo tamaño, con el pie centrado abajo */
function pack(base: Layer, under: Layer, fruit: Layer): PlantArt {
  let maxX = 0, minY = 0;
  for (const l of [base, under, fruit]) {
    for (const p of l.values()) {
      maxX = Math.max(maxX, Math.abs(p.x));
      minY = Math.min(minY, p.y);
    }
  }
  const footX = maxX, w = maxX * 2 + 1, h = -minY + 1;
  const toArray = (l: Layer): (ArtPixel | null)[] => {
    const a: (ArtPixel | null)[] = new Array(w * h).fill(null);
    for (const p of l.values()) {
      const i = p.x + footX, j = p.y + h - 1;
      if (i >= 0 && i < w && j >= 0 && j < h) a[j * w + i] = { ramp: p.ramp, step: p.step, tag: p.tag, color: p.color, depth: p.depth };
    }
    return a;
  };
  return { w, h, footX, base: toArray(base), under: toArray(under), fruit: toArray(fruit) };
}

/** Partes de un dibujo (para tests) */
export type { ArtPart };

/**
 * Aspecto de una planta en un momento (cada valor 0..1, ya redondeado a pasos por quien lo pide):
 * - autumn: cuánto se ha vuelto ocre · leaves: cuántas hojas le quedan (hoja caduca)
 * - dry: hierba seca de invierno · stress: cuánto sufre (sequía, frío) · dead: cuánto se ha secado del todo
 * - fruit: cuánto fruto le queda · gone: cuánto se ha deshecho (al morir) · snow: nieve encima
 */
export interface ArtLook {
  readonly autumn: number;
  readonly leaves: number;
  readonly dry: number;
  readonly stress: number;
  readonly dead: number;
  readonly fruit: number;
  readonly gone: number;
  readonly snow: boolean;
}

export const FRESH: ArtLook = { autumn: 0, leaves: 1, dry: 0, stress: 0, dead: 0, fruit: 1, gone: 0, snow: false };

const SNOW_TOP = 0xfafcff;
const SNOW_SIDE = 0xdce8f4;

/** Colores del sprite con este aspecto (-1 = transparente), en el mismo orden que las capas */
export function paint(art: PlantArt, look: ArtLook): Int32Array {
  const { w, h } = art;
  const out = new Int32Array(w * h).fill(-1);
  const dry = Math.max(look.dry, look.stress);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (look.gone > 0 && pixelHash(i, j, 6) < look.gone) continue;
      let p = art.base[k];
      if (p && p.tag === 'leaf' && pixelHash(i, j, 1) >= look.leaves) p = art.under[k];
      if (!p) continue;
      if (p.tag === 'flat') {
        out[k] = look.dead > 0 && pixelHash(i, j, 4) < look.dead ? PLANT_RAMPS.dead[2] : p.color!;
        continue;
      }
      let ramp = p.ramp!;
      if (p.tag === 'leaf') {
        if (pixelHash(i, j, 2) < look.autumn) ramp = 'autumn';
        if (pixelHash(i, j, 3) < dry) ramp = 'dry';
        if (pixelHash(i, j, 4) < look.dead) ramp = 'dead';
      }
      out[k] = PLANT_RAMPS[ramp][p.step];
    }
  }
  // Frutos encima (los que quedan; una planta seca ya no tiene)
  if (look.fruit > 0 && look.dead < 0.5) {
    for (let k = 0; k < w * h; k++) {
      const f = art.fruit[k];
      const i = k % w, j = Math.floor(k / w);
      if (!f || pixelHash(i, j - (f.step === 1 ? 1 : 0), 11) >= look.fruit) continue;
      if (look.gone > 0 && pixelHash(i, j, 6) < look.gone) continue;
      out[k] = PLANT_RAMPS[f.ramp!][f.step + (pixelHash(i, j, 12) < look.stress ? -1 : 0)];
    }
  }
  // Nieve: el píxel más alto de cada columna y, en columnas alternas, el de debajo
  if (look.snow) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        if (out[j * w + i] < 0) continue;
        out[j * w + i] = SNOW_TOP;
        if (i % 2 === 0 && j + 1 < h - 2 && out[(j + 1) * w + i] >= 0) out[(j + 1) * w + i] = SNOW_SIDE;
        break;
      }
    }
  }
  return out;
}
