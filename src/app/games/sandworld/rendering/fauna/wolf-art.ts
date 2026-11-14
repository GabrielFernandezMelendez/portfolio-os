import { WOLF_CANVAS, WOLF_COLORS as K, WOLF_SCALE } from '../../config/fauna-art.config';
import { Pixels, clamp, over } from './pixel-canvas';

/*
  Lobo isométrico generado por código (sin imágenes), como el ciervo y el conejo: cuerpo largo y bajo, cabeza con
  hocico, orejas en punta, cola espesa caída y patas finas, colocados según una pose. Mira abajo a la izquierda
  (de frente) o arriba a la derecha (de espaldas); las otras dos direcciones, en espejo. Puro: colores por píxel.
  Además de las poses comunes tiene 'howl' (aullando, con la cabeza al cielo).
*/

export type WolfKind = 'male' | 'female' | 'pup';
export type WolfPose = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead' | 'howl';

export interface WolfArt {
  readonly w: number;
  readonly h: number;
  readonly footX: number;
  readonly footY: number;
  readonly colors: Int32Array;
}

const { w: W, h: H, ground: GROUND, footX: FOOT_X } = WOLF_CANVAS;
const FUR = K.fur;

export function wolfArt(kind: WolfKind, pose: WolfPose, t: number, back: boolean): WolfArt {
  const s = WOLF_SCALE[kind];
  const n = Math.hypot(2, 1);
  const ux = (back ? 2 : -2) / n, uy = (back ? -1 : 1) / n;      // hacia la cabeza
  const sx = 0.9;
  const wave = Math.sin(t * Math.PI * 2);
  const run = pose === 'run';
  const bob = pose === 'walk' ? -Math.abs(wave) * 0.5 : run ? -Math.abs(wave) * 1.4 : 0;
  const lying = pose === 'sleep' || pose === 'dead';
  const legL = 4.6 * s;
  let cx = FOOT_X, cy = GROUND - legL - 2.4 * s + bob;
  if (pose === 'sleep') cy = GROUND - 2.4 * s;
  if (pose === 'dead') cy = GROUND - 2.2 * s;
  const stretch = run ? 1.12 : 1;
  const a = 6.6 * s * stretch, b = (lying ? 2.4 : 2.5) * s;

  const body = new Pixels(W, H);
  const farLegs = new Pixels(W, H);
  const nearLegs = new Pixels(W, H);

  // ── Patas finas; al galope se estiran hacia delante y atrás
  const legs: { near: boolean; tx: number; ty: number; fx: number; fy: number; front: boolean }[] = [];
  for (const front of [true, false]) {
    for (const near of [true, false]) {
      const along = 4.4 * s * (front ? 1 : -1) * stretch;
      const tx = cx + ux * along + sx * (near ? 1 : -1) * 1.3 * s;
      const ty = cy + uy * along * 0.8 + b * 0.5;
      const ph = t + (front === near ? 0 : 0.5);
      const swing = pose === 'walk' ? Math.sin(ph * Math.PI * 2) * 1.4 * s : run ? Math.sin(ph * Math.PI * 2) * 3.4 * s : 0;
      const lift = Math.max(0, -Math.cos(ph * Math.PI * 2)) * (run ? 1.4 : pose === 'walk' ? 0.6 : 0);
      legs.push({ near, front, tx, ty, fx: tx + ux * swing, fy: GROUND + uy * 4.6 * s * (front ? 1 : -1) * stretch - lift + (near ? 0 : -0.8) });
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
      // Patas de 2 px (luz y sombra) con la pata oscura
      const [light, dark] = nearSide ? [FUR[3], FUR[1]] : [FUR[1], FUR[0]];
      cv.line(l.tx, l.ty, fx, fy - 1, light);
      cv.line(l.tx + 1, l.ty, fx + 1, fy - 1, dark);
      cv.put(fx, fy - 1, K.saddle[0]);
      cv.put(fx + 1, fy - 1, K.saddle[0]);
    }
  };

  // ── Cabeza según la pose: al aullar, al cielo
  let hpx = cx + ux * 6.6 * s * stretch, hpy = cy - 3.6 * s;
  if (pose === 'eat' || pose === 'drink') {
    hpx = cx + ux * 7.2 * s;
    hpy = GROUND - 2 * s - (t >= 0.5 ? 0.7 : 0);
  } else if (pose === 'sleep') {
    hpx = cx + ux * 4.4 * s + sx * 1.4;
    hpy = cy - 1.4 * s;
  } else if (pose === 'dead') {
    hpx = cx + ux * 7 * s;
    hpy = GROUND - 1.6;
  } else if (run) {
    hpx = cx + ux * 7.4 * s * stretch;
    hpy = cy - 2 * s;
  } else if (pose === 'howl') {
    hpx = cx + ux * 5.4 * s;
    hpy = cy - 6.4 * s;
  } else if (pose === 'idle' && t > 0.75) hpy += 0.8;    // olfatea
  // Hocico: hacia delante; aullando, hacia arriba
  const [mx, my] = pose === 'howl' ? [ux * 0.9, -1] : [ux, uy];
  const nbx = cx + ux * 4.2 * s, nby = cy - b * 0.5;

  const drawHead = () => {
    for (let k = 0; k < 3; k++) body.line(nbx + (k - 1) * 0.8, nby, hpx + (k - 1) * 0.4, hpy + 1, FUR[k === 0 ? 3 : 2]);
    body.ellipse(hpx, hpy, ux, uy, 2.5 * s, 2.1 * s, (x, y) => FUR[clamp(Math.round(3.2 - (x + 0.5 - hpx) * 0.5 - (y + 0.5 - hpy) * 0.8), 1, 5)]);
    // Hocico largo y claro, con la nariz negra en la punta
    const snx = hpx + mx * 3 * s, sny = hpy + my * 1.4 * s + (pose === 'howl' ? -0.8 : 0.7 * s);
    body.ellipse(snx, sny, mx, my, 2.2 * s, 1 * s, (_x, _y, d) => (d < 0.6 ? K.cream[1] : K.cream[0]));
    if (!back) {
      body.put(snx + mx * 2 * s, sny + my * 0.4, K.nose);
      if (pose === 'sleep') body.put(hpx - 0.2, hpy - 0.3, FUR[0]);
      else if (pose === 'dead') body.put(hpx - 0.4, hpy - 0.4, K.outline);
      else body.put(hpx - 0.1, hpy - 0.5, K.eye);
    }
    // Orejas en punta, triangulares (al correr, hacia atrás; durmiendo, gachas)
    for (const [side, col] of [[1, FUR[3]], [-1, FUR[1]]] as const) {
      const ex = hpx - ux * 0.8 + sx * side * 1, ey = hpy - 1.5 * s;
      const back2 = run || lying ? 1.6 : 0.3;
      const tipx = ex - ux * back2 + side * 0.2, tipy = ey - (lying ? 1 : 2.6) * s;
      body.line(ex - 0.8, ey + 0.3, tipx, tipy, col);
      body.line(ex + 0.8, ey + 0.3, tipx, tipy, col);
      body.line(ex, ey, tipx, tipy, col);
      if (!back && !lying && side === 1) body.put(ex - ux * 0.1, ey - 0.6, K.innerEar);
    }
  };

  const drawBody = () => {
    body.ellipse(cx, cy, ux, uy, a, b, (x, y, d) => {
      if (y + 0.5 - cy > b * 0.5 && pose !== 'dead') return d < 0.85 ? K.cream[0] : FUR[2];
      // Lomo más oscuro (la "silla" del lobo)
      if (y + 0.5 - cy < -b * 0.35 && kind !== 'pup') return d < 0.6 ? K.saddle[1] : K.saddle[0];
      const l = -(x + 0.5 - cx) * 0.35 - (y + 0.5 - cy) * 0.9;
      return FUR[clamp(Math.round(2.6 + (l * 0.75) / s), 0, 5)];
    });
    // Cola espesa: caída al andar, estirada al correr, enroscada al dormir
    const rx = cx - ux * (a - 0.4), ry = cy - 0.4;
    const tailLen = 5.2 * s;
    const [tx2, ty2] = run ? [rx - ux * tailLen, ry - uy * tailLen * 0.5 - 0.6]
      : lying ? [rx - ux * 1 + sx * 3 * s, ry + 1.6 * s]
      : [rx - ux * tailLen * 0.6, ry + tailLen * 0.8];
    body.ellipse((rx + tx2) / 2, (ry + ty2) / 2, (tx2 - rx) / (Math.hypot(tx2 - rx, ty2 - ry) || 1), (ty2 - ry) / (Math.hypot(tx2 - rx, ty2 - ry) || 1),
      Math.hypot(tx2 - rx, ty2 - ry) / 2 + 0.8, 1.6 * s, (_x, _y, d) => (d < 0.5 ? FUR[3] : FUR[1]));
    body.put(tx2, ty2, K.saddle[0]);
  };

  drawLegs(farLegs, false);
  if (back) {
    drawHead();
    drawBody();
  } else {
    drawBody();
    drawHead();
  }
  drawLegs(nearLegs, true);
  let colors = over(farLegs.px, body.outlined(K.outline));
  colors = over(colors, nearLegs.px);
  return { w: W, h: H, footX: FOOT_X, footY: GROUND, colors };
}
