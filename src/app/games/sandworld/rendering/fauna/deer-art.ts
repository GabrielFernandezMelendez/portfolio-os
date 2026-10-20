import { DEER_CANVAS, DEER_COLORS as K, DEER_SCALE } from '../../config/fauna-art.config';

/*
  Ciervo isométrico generado por código (sin imágenes): piezas (cuerpo, cuello, cabeza, orejas, cornamenta,
  patas) colocadas según una pose. Mira hacia abajo a la izquierda (de frente) o arriba a la derecha (de espaldas);
  las otras dos direcciones salen en espejo. Pura: devuelve los colores de cada píxel, sin Pixi (lo usan el mapa
  y el retrato de la ficha).
*/

export type DeerKind = 'male' | 'female' | 'fawn';
export type DeerPose = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead';

export interface DeerArt {
  readonly w: number;
  readonly h: number;
  /** Píxel del pie (centro entre las pezuñas, en el suelo) */
  readonly footX: number;
  readonly footY: number;
  /** Color 0xRRGGBB por píxel (fila a fila); -1 = transparente */
  readonly colors: Int32Array;
}

const { w: W, h: H, ground: GROUND, footX: FOOT_X } = DEER_CANVAS;
const FUR = K.fur, CREAM = K.cream, ANT = K.antler;

/** Lienzo de píxeles: lo último que se pinta queda encima */
class Pixels {
  readonly px = new Int32Array(W * H).fill(-1);
  put(x: number, y: number, c: number): void {
    const ix = Math.trunc(x), iy = Math.trunc(y);
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) this.px[iy * W + ix] = c;
  }
  /** Elipse orientada a lo largo de (ux, uy): semieje `a` en esa dirección y `b` en la perpendicular */
  ellipse(cx: number, cy: number, ux: number, uy: number, a: number, b: number, shade: (x: number, y: number, d: number) => number): void {
    const vx = -uy, vy = ux;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const p = dx * ux + dy * uy, q = dx * vx + dy * vy;
        const d = (p / a) ** 2 + (q / b) ** 2;
        if (d <= 1) this.put(x, y, shade(x, y, d));
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    const n = Math.trunc(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c);
    }
  }
  /** Contorno de 1 px alrededor de lo pintado (solo por los 4 lados) */
  outlined(): Int32Array {
    const out = this.px.slice();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.px[y * W + x] >= 0) continue;
        const near = (x > 0 && this.px[y * W + x - 1] >= 0) || (x < W - 1 && this.px[y * W + x + 1] >= 0) ||
          (y > 0 && this.px[(y - 1) * W + x] >= 0) || (y < H - 1 && this.px[(y + 1) * W + x] >= 0);
        if (near) out[y * W + x] = K.outline;
      }
    }
    return out;
  }
}

/** Pone `top` encima de `base` (los transparentes de `top` dejan ver `base`) */
function over(base: Int32Array, top: Int32Array): Int32Array {
  const out = base.slice();
  for (let k = 0; k < out.length; k++) if (top[k] >= 0) out[k] = top[k];
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Un fotograma. `t` (0..1) es el momento de la animación: el paso al andar o correr, el cabeceo al estar quieto.
 * `back`: de espaldas (va hacia arriba en la pantalla).
 */
export function deerArt(kind: DeerKind, pose: DeerPose, t: number, back: boolean): DeerArt {
  const s = DEER_SCALE[kind];
  const n = Math.hypot(2, 1);
  const ux = (back ? 2 : -2) / n, uy = (back ? -1 : 1) / n;      // hacia la cabeza
  const sx = 0.9;                                                  // lado cercano (hacia quien mira)
  const wave = Math.sin(t * Math.PI * 2);
  const bob = pose === 'walk' ? -Math.abs(wave) * 0.6 : pose === 'run' ? -Math.abs(wave) * 1.6 : 0;
  const legL = 6.5 * s;
  let cx = FOOT_X, cy = GROUND - legL - 3 * s + bob;
  if (pose === 'sleep') cy = GROUND - 2.6 * s;
  if (pose === 'dead') cy = GROUND - 2.2 * s;
  const a = (pose === 'dead' ? 5.8 : 6.4) * s, b = (pose === 'dead' ? 2.4 : 2.7) * s;

  const body = new Pixels();
  const farLegs = new Pixels();
  const nearLegs = new Pixels();
  const antlers = new Pixels();

  // ── Patas: delante y detrás a lo largo del cuerpo; cerca y lejos a los lados. Las de delante pisan más abajo (profundidad).
  const legs: { near: boolean; tx: number; ty: number; fx: number; fy: number }[] = [];
  for (const front of [true, false]) {
    for (const near of [true, false]) {
      const along = 4.0 * s * (front ? 1 : -1);
      const tx = cx + ux * along + sx * (near ? 1 : -1) * 1.6 * s;
      const ty = cy + uy * along * 0.8 + b * 0.5;
      const ph = t + (front === near ? 0 : 0.5);
      const swing = pose === 'walk' ? Math.sin(ph * Math.PI * 2) * 1.4 * s : pose === 'run' ? Math.sin(ph * Math.PI * 2) * 3.0 * s : 0;
      const lift = Math.max(0, -Math.cos(ph * Math.PI * 2)) * (pose === 'run' ? 1.2 : pose === 'walk' ? 0.6 : 0);
      legs.push({ near, tx, ty, fx: tx + ux * swing, fy: GROUND + uy * 4.4 * s * (front ? 1 : -1) - lift + (near ? 0 : -0.8) });
    }
  }
  const drawLegs = (cv: Pixels, nearSide: boolean) => {
    if (pose === 'sleep') return;
    for (const l of legs) {
      if (l.near !== nearSide) continue;
      let { fx, fy } = l;
      if (pose === 'dead') {
        fx = l.tx + sx * 5 * s;
        fy = l.ty + 1.5;
      }
      const [light, dark] = nearSide ? [FUR[3], FUR[1]] : [FUR[1], FUR[0]];
      cv.line(l.tx, l.ty, fx, fy - 1, light);
      cv.line(l.tx + 1, l.ty, fx + 1, fy - 1, dark);
      cv.put(fx, fy - 1, K.hoof);
      cv.put(fx + 1, fy - 1, K.hoof);
    }
  };

  // ── Cabeza: dónde está según la pose
  let hpx: number, hpy: number;
  if (pose === 'eat' || pose === 'drink') {
    hpx = cx + ux * 6.6 * s;
    hpy = GROUND - 2.2 * s - (t >= 0.5 ? 0.8 : 0);   // segundo fotograma: masca / levanta un poco
  } else if (pose === 'sleep') {
    hpx = cx + ux * 4.0 * s + sx * 1.5;
    hpy = cy - 2.6 * s;
  } else if (pose === 'dead') {
    hpx = cx + ux * 6.8 * s;
    hpy = GROUND - 1.6;
  } else if (pose === 'run') {
    hpx = cx + ux * 7.0 * s;
    hpy = cy - 4.2 * s;
  } else {
    const nod = pose === 'walk' ? wave * 0.5 : pose === 'idle' && t > 0.75 ? 1 : 0;
    hpx = cx + ux * 5.8 * s;
    hpy = cy - 6.6 * s + nod;
  }
  const nbx = cx + ux * 3.6 * s, nby = cy - b * 0.4;

  const drawHead = () => {
    for (let k = 0; k < 3; k++) body.line(nbx + (k - 1) * 0.8, nby, hpx + (k - 1) * 0.5, hpy + 1, FUR[k === 0 ? 3 : 2]);
    body.ellipse(hpx, hpy, ux, uy, 2.4 * s, 1.8 * s, (x, y) => FUR[clamp(Math.round(3 - (x + 0.5 - hpx) * 0.5 - (y + 0.5 - hpy) * 0.8), 1, 5)]);
    const snx = hpx + ux * 2.2 * s, sny = hpy + 1.2 * s;
    body.ellipse(snx, sny, ux, uy, 1.4 * s, 1.1 * s, (_x, _y, d) => (d < 0.6 ? CREAM[1] : FUR[3]));
    if (!back) {
      body.put(snx + ux * 1.2, sny + 0.3, K.nose);
      if (pose === 'sleep') body.put(hpx - 0.3, hpy - 0.2, FUR[0]);              // ojo cerrado
      else if (pose === 'dead') body.put(hpx - 0.5, hpy - 0.5, K.outline);
      else body.put(hpx - 0.2, hpy - 0.4, K.eye);
    }
    // Orejas hacia atrás y arriba (la cercana, clara; la lejana, en sombra)
    for (const [side, col] of [[1, FUR[3]], [-1, FUR[1]]] as const) {
      const ex = hpx - ux * 0.8 + sx * side * 1.1, ey = hpy - 1.6 * s;
      body.line(ex, ey, ex - ux * 1.4 + side * 0.4, ey - 1.8 * s, col);
      body.put(ex - ux * 0.7 + side * 0.2, ey - 0.8, side === 1 ? K.innerEar : FUR[2]);
    }
    // Cornamenta del macho: dos varas con dos puntas cada una
    if (kind === 'male' && pose !== 'dead') {
      for (const side of [1, -1]) {
        const bx = hpx - ux * 0.3 + sx * side * 0.6, by = hpy - 2.0;
        const tipx = bx - ux * 1.5 + side * 1.4, tipy = by - 5.0;
        antlers.line(bx, by, tipx, tipy, side === 1 ? ANT[1] : ANT[0]);
        [[-1.6, -1.0], [1.6, -1.2]].forEach(([ox, oy], k) => {
          const f = 0.4 + k * 0.3;
          const jx = bx + (tipx - bx) * f, jy = by + (tipy - by) * f;
          antlers.line(jx, jy, jx + ox * side, jy + oy, side === 1 ? ANT[2] : ANT[0]);
        });
      }
    }
  };

  const drawBody = () => {
    body.ellipse(cx, cy, ux, uy, a, b, (x, y, d) => {
      // Vientre crema; el resto con luz arriba a la izquierda; la cría con motas
      if (y + 0.5 - cy > b * 0.55 && pose !== 'dead') return d < 0.85 ? CREAM[1] : CREAM[0];
      const l = -(x + 0.5 - cx) * 0.35 - (y + 0.5 - cy) * 0.9;
      if (kind === 'fawn' && (x * 7 + y * 13) % 11 === 0 && d < 0.7 && y + 0.5 - cy < 0.5) return K.spot;
      return FUR[clamp(Math.round(2.6 + (l * 0.75) / s), 0, 5)];
    });
    // Culera clara y cola
    const rx = cx - ux * (a - 1.2), ry = cy - 0.6;
    body.ellipse(rx, ry, ux, uy, 1.3 * s, 1.6 * s, (_x, _y, d) => (d < 0.7 ? CREAM[2] : CREAM[1]));
    body.put(rx - ux * 1.2, ry - 0.8, FUR[1]);
  };

  drawLegs(farLegs, false);
  // De frente la cabeza va delante del cuerpo; de espaldas, detrás
  if (back) {
    drawHead();
    drawBody();
  } else {
    drawBody();
    drawHead();
  }
  drawLegs(nearLegs, true);

  let colors = over(farLegs.px, body.outlined());
  colors = back ? over(antlers.px, colors) : over(colors, antlers.px);
  colors = over(colors, nearLegs.px);
  return { w: W, h: H, footX: FOOT_X, footY: GROUND, colors };
}
