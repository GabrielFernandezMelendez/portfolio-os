import { RABBIT_CANVAS, RABBIT_COLORS as K, RABBIT_SCALE } from '../../config/fauna-art.config';
import { Pixels, clamp, over } from './pixel-canvas';

/*
  Conejo isométrico generado por código (sin imágenes), como el ciervo: piezas (cuartos traseros, cuerpo, cabeza,
  orejas largas, cola blanca, patas) colocadas según una pose. Mira abajo a la izquierda (de frente) o arriba a la
  derecha (de espaldas, enseñando la cola blanca); las otras dos direcciones, en espejo. Puro: colores por píxel.
*/

export type RabbitKind = 'male' | 'female' | 'kit';
export type RabbitPose = 'idle' | 'walk' | 'run' | 'eat' | 'drink' | 'sleep' | 'dead';

export interface RabbitArt {
  readonly w: number;
  readonly h: number;
  readonly footX: number;
  readonly footY: number;
  readonly colors: Int32Array;
}

const { w: W, h: H, ground: GROUND, footX: FOOT_X } = RABBIT_CANVAS;
const FUR = K.fur;

/**
 * Un fotograma. `t` (0..1): momento del salto al andar o correr; quieto, el tic de las orejas.
 * Corre estirado con las orejas atrás; come con la cabeza abajo; duerme hecho una bola con las orejas pegadas.
 */
export function rabbitArt(kind: RabbitKind, pose: RabbitPose, t: number, back: boolean): RabbitArt {
  const s = RABBIT_SCALE[kind];
  const n = Math.hypot(2, 1);
  const ux = (back ? 2 : -2) / n, uy = (back ? -1 : 1) / n;      // hacia la cabeza
  const wave = Math.sin(t * Math.PI * 2);
  // Saltos: andando, saltitos; corriendo, saltos largos (sube y se estira)
  const hop = pose === 'walk' ? Math.max(0, wave) * 1.5 : pose === 'run' ? Math.max(0, wave) * 3 : 0;
  const stretch = pose === 'run' ? 1 + Math.max(0, wave) * 0.35 : 1;
  const lying = pose === 'sleep' || pose === 'dead';

  const body = new Pixels(W, H);
  const ears = new Pixels(W, H);
  const feet = new Pixels(W, H);

  // ── Cuartos traseros (grandes, redondos) y cuerpo hacia la cabeza
  const hx = FOOT_X - ux * 1.4 * s, hy = GROUND - 3.2 * s - hop + (lying ? 0.8 : 0);
  const bx = hx + ux * 2.4 * s * stretch, by = hy - (pose === 'eat' || pose === 'drink' ? -0.2 : 0.9) * s;
  const shadeBody = (cx: number, cy: number, r: number) => (x: number, y: number, d: number) => {
    if (y + 0.5 - cy > r * 0.45 && pose !== 'dead') return d < 0.8 ? K.belly[1] : K.belly[0];
    const l = -(x + 0.5 - cx) * 0.4 - (y + 0.5 - cy) * 0.9;
    return FUR[clamp(Math.round(2.6 + (l * 0.8) / s), 0, 5)];
  };
  const haunchA = (pose === 'dead' ? 3.6 : 3.4) * s, haunchB = (lying ? 2.6 : 3.0) * s;
  body.ellipse(hx, hy, ux, uy, haunchA, haunchB, shadeBody(hx, hy, haunchB));
  body.ellipse(bx, by, ux, uy, 2.8 * s * stretch, 2.3 * s, shadeBody(bx, by, 2.3 * s));

  // ── Patas: la trasera larga y plana bajo el cuarto trasero; la delantera, pequeña
  if (pose === 'dead') {
    // Muerto: tumbado de lado, con las patas estiradas hacia fuera
    for (const [ax, ay] of [[hx - ux * 0.8, hy + 1.6 * s], [bx + ux * 0.8, by + 1.6 * s]]) feet.line(ax, ay, ax + 1.2, ay + 2.2 * s, FUR[2]);
  }
  if (!lying) {
    const kick = pose === 'run' ? wave * 2.2 * s : pose === 'walk' ? wave * 0.8 : 0;
    const fx = hx - ux * 0.6 + ux * Math.min(0, kick), fy = GROUND - 1 - (hop > 0 ? hop * 0.5 : 0);
    feet.line(fx - ux * 1.6 * s, fy, fx + ux * 1.4 * s, fy, FUR[3]);
    feet.line(fx - ux * 1.6 * s, fy + 0.6, fx + ux * 1.4 * s, fy + 0.6, FUR[1]);
    const px = bx + ux * 1.6 * s + ux * Math.max(0, kick), py = GROUND - 1 - hop * 0.7;
    feet.line(px, by + 1.2 * s, px + ux * 0.5, py, FUR[2]);
  }

  // ── Cabeza (redonda) según la pose
  let hdx = bx + ux * 2.6 * s, hdy = by - 2.1 * s;
  if (pose === 'eat' || pose === 'drink') {
    hdx = bx + ux * 3.2 * s;
    hdy = GROUND - 2 * s - (t >= 0.5 ? 0.6 : 0);
  } else if (pose === 'run') {
    hdx = bx + ux * 3.0 * s * stretch;
    hdy = by - 1.2 * s;
  } else if (pose === 'sleep') {
    hdx = bx + ux * 1.8 * s;
    hdy = by - 1.2 * s;
  } else if (pose === 'dead') {
    hdx = bx + ux * 3 * s;
    hdy = GROUND - 1.8 * s;
  }
  const head = () => {
    body.ellipse(hdx, hdy, ux, uy, 1.9 * s, 1.7 * s, (x, y) => FUR[clamp(Math.round(3.2 - (x + 0.5 - hdx) * 0.5 - (y + 0.5 - hdy) * 0.8), 1, 5)]);
    const mx = hdx + ux * 1.4 * s, my = hdy + 0.7 * s;
    body.ellipse(mx, my, ux, uy, 0.9 * s, 0.8 * s, () => K.belly[1]);
    if (!back) {
      body.put(mx + ux * 0.8, my - 0.2, K.nose);
      if (pose === 'sleep') body.put(hdx - 0.2, hdy - 0.3, FUR[0]);
      else if (pose === 'dead') body.put(hdx - 0.4, hdy - 0.4, K.outline);
      else body.put(hdx - 0.1, hdy - 0.5, K.eye);
    }
  };

  // ── Orejas largas: de pie al estar quieto (con un tic), hacia atrás al correr, pegadas al dormir
  const earLen = (kind === 'kit' ? 3.2 : 4.6) * s;
  const twitch = pose === 'idle' && t > 0.75 ? 1 : 0;
  for (const [side, col, inner] of [[1, FUR[3], K.innerEar], [-1, FUR[1], FUR[2]]] as const) {
    const ex = hdx - ux * 0.4 + side * 0.7, ey = hdy - 1.3 * s;
    let tx: number, ty: number;
    if (pose === 'run' || lying) {
      tx = ex - ux * earLen;
      ty = ey - uy * earLen * 0.5 - (lying ? -0.5 : 1);
    } else if (pose === 'eat' || pose === 'drink') {
      // Comiendo, la cabeza baja y las orejas caen hacia atrás sobre el lomo
      tx = ex - ux * earLen * 0.95 + side * 0.3;
      ty = ey - earLen * 0.45;
    } else {
      tx = ex - ux * 0.8 + side * (0.6 + (side === 1 ? twitch : 0));
      ty = ey - earLen;
    }
    // De 1 px (con su contorno ya se leen; más gruesas, a este tamaño parecen cuernos) y el rosa por dentro
    ears.line(ex, ey, tx, ty, col);
    if (!back && !lying && side === 1) ears.put((ex + tx) / 2, (ey + ty) / 2, inner);
  }

  // ── Cola blanca (de espaldas se ve bien: la señal de alarma)
  const tx = hx - ux * (haunchA - 0.4), ty = hy - 0.8 * s;
  const tail = () => body.ellipse(tx, ty, ux, uy, 1.1 * s, 1.1 * s, (_x, _y, d) => (d < 0.6 ? K.tail[1] : K.tail[0]));

  if (back) {
    head();
    tail();
  } else {
    tail();
    head();
  }
  let colors = body.outlined(K.outline);
  colors = back ? over(ears.outlined(K.outline), colors) : over(colors, ears.outlined(K.outline));
  colors = over(colors, feet.px);
  return { w: W, h: H, footX: FOOT_X, footY: GROUND, colors };
}
