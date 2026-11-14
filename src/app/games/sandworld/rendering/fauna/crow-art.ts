import { Pixels, clamp, over } from './pixel-canvas';

/*
  Cuervo isométrico generado por código (mockup): de pie va erguido (cuerpo inclinado, cabeza arriba), con pico
  grueso gris y cola en cuña. Poses: posado, andando a saltitos, picoteando, graznando, volando (alas abiertas,
  arriba y abajo), dormido (hecho una bola) y muerto. Pollo: gris, con la comisura amarilla.
*/

export type CrowKind = 'adult' | 'chick';
export type CrowPose = 'idle' | 'walk' | 'eat' | 'fly' | 'sleep' | 'dead' | 'caw';

const W = 22, H = 18, GROUND = 15, FOOT_X = 11;
const K = {
  outline: 0x0a0810,
  body: [0x121018, 0x1c1926, 0x272336, 0x36314c, 0x4a4566, 0x666a98],
  chick: [0x34323a, 0x46444e, 0x5c5a64, 0x76747e, 0x908e98, 0xaeacb6],
  beak: [0x2a2a30, 0x55555e, 0x7a7a84],
  gape: 0xf2d24a,
  eye: 0xff1a1a,
  leg: 0x2a2830,
};

function tri(p: Pixels, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: (x: number, y: number) => number): void {
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(d) < 1e-6) return;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d;
    const w2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d;
    const w3 = 1 - w1 - w2;
    if (w1 >= 0 && w2 >= 0 && w3 >= 0) p.put(x, y, col(x, y));
  }
}

export function crowArt(kind: CrowKind, pose: CrowPose, t: number, back: boolean): { w: number; h: number; colors: Int32Array } {
  const s = kind === 'chick' ? 0.5 : 0.78;
  const F = kind === 'chick' ? K.chick : K.body;
  const n = Math.hypot(2, 1);
  const ux = (back ? 2 : -2) / n, uy = (back ? -1 : 1) / n;          // hacia la cabeza
  const wave = Math.sin(t * Math.PI * 2);
  const hop = pose === 'walk' ? Math.max(0, wave) * 1.4 : 0;
  const flying = pose === 'fly';
  const lying = pose === 'sleep' || pose === 'dead';
  const shade = (cx: number, cy: number) => (x: number, y: number) => F[clamp(Math.round(2.6 - (x + 0.5 - cx) * 0.3 - (y + 0.5 - cy) * 0.75), 0, 5)];

  const body = new Pixels(W, H), wingsBack = new Pixels(W, H), wingsFront = new Pixels(W, H), legs = new Pixels(W, H), hp = new Pixels(W, H);

  // Eje del cuerpo: de pie, erguido hacia la cabeza (sube); volando o tumbado, horizontal
  const rise = flying || lying || pose === 'eat' ? 0.15 : 0.75;
  const ax0 = ux, ay0 = uy - rise, an = Math.hypot(ax0, ay0);
  const ax = ax0 / an, ay = ay0 / an;
  const legLen = lying || flying ? 0 : 2.2 * s;
  const bx = FOOT_X, by = GROUND - legLen - 2.6 * s - hop - (flying ? 5 : 0) + (lying ? 1.2 : 0);
  body.ellipse(bx, by, ax, ay, 3.4 * s, (pose === 'sleep' ? 2.8 : 2.2) * s, shade(bx, by));
  // Cola en cuña hacia atrás y abajo
  if (pose !== 'sleep') {
    const tx = bx - ax * 3.6 * s, ty = by - ay * 3.6 * s + (flying ? 0 : 0.6);
    body.ellipse(tx, ty, ax, ay, 2.0 * s, 1.0 * s, () => F[1]);
  }
  // Patas (2 px de alto) y dedos
  if (legLen) {
    for (const off of [-0.7, 0.9]) {
      const lx = bx + off * 0.8, ly = by + 1.6 * s;
      legs.line(lx, ly, lx + ux * 0.3, GROUND - 0.6 - hop, K.leg);
      legs.put(lx + ux * 1.2, GROUND - 0.6 - hop, K.leg);
    }
  }
  if (pose === 'dead') for (const off of [-0.5, 0.8]) legs.line(bx + off, by - 1.8, bx + off + 0.3, by - 3.6, K.leg);

  // Cabeza y pico
  let hx = bx + ax * 3.1 * s, hy = by + ay * 3.1 * s - 0.6 * s;
  if (pose === 'eat') { hx = bx + ux * 3.8 * s; hy = GROUND - 1.4 * s - (t >= 0.5 ? 0.7 : 0); }
  if (pose === 'sleep') { hx = bx + ux * 1.5 * s; hy = by - 1.8 * s; }
  if (pose === 'dead') { hx = bx + ux * 3.4 * s; hy = by + 0.6; }
  if (flying) { hx = bx + ux * 3.6 * s; hy = by + uy * 3.6 * s - 0.4; }
  hp.ellipse(hx, hy, ux, uy, 1.9 * s, 1.7 * s, shade(hx, hy));
  if (pose !== 'sleep') {
    const len = (kind === 'chick' ? 1.6 : 2.8) * s;
    const bxp = hx + ux * 1.5 * s, byp = hy + uy * 1.5 * s + (pose === 'eat' ? 0.4 : 0.1);
    const open = pose === 'caw' ? 0.9 : 0;
    const down = pose === 'eat' ? 0.8 : 0.15;
    hp.line(bxp, byp - 0.5, bxp + ux * len, byp + down * len - 0.3 - open, K.beak[2]);
    hp.line(bxp, byp + 0.5, bxp + ux * len * 0.85, byp + down * len * 0.85 + 0.4 + open, K.beak[1]);
    if (kind === 'chick') hp.put(bxp, byp + 0.5, K.gape);
    if (!back) hp.put(hx + ux * 0.25, hy - 0.6, pose === 'dead' ? K.outline : K.eye);
  }

  // Alas: plegadas sobre el costado; volando, abiertas (arriba o abajo con el aleteo)
  if (flying) {
    // Visto desde arriba en la isométrica: alas abiertas a los lados de la pantalla (se lee mejor), con las
    // puntas arriba o abajo según el aleteo
    const up = wave > 0;
    for (const side of [1, -1]) {
      const span = 8 * s;
      const rx = bx + side * 0.8, ry = by - 0.6;
      const tipX = rx + side * span, tipY = ry + (up ? -4.2 : 2.2) * s;
      const midX = rx + side * span * 0.55, midY = ry + (up ? -2.4 : 1.2) * s;
      const target = (side === 1) === back ? wingsBack : wingsFront;
      tri(target, rx, ry - 1.2 * s, rx, ry + 1.4 * s, midX, midY + 0.8, (x, y) => F[clamp(Math.round(3 - (y + 0.5 - ry) * 0.5), 0, 5)]);
      tri(target, midX, midY - 0.6, midX, midY + 1.4, tipX, tipY, () => F[up ? 2 : 1]);
      // Plumas de la punta separadas
      target.put(tipX - side * 1, tipY + 1.2, F[1]);
    }
  } else if (pose !== 'dead') {
    const wx = bx - ax * 0.3, wy = by - ay * 0.3 + 0.2;
    wingsFront.ellipse(wx, wy, ax, ay, 2.9 * s, 1.4 * s, (x, y) => F[clamp(Math.round(3.6 - (y + 0.5 - wy) * 0.9), 1, 5)]);
  }

  let colors = wingsBack.outlined(K.outline);
  colors = over(colors, body.outlined(K.outline));
  colors = over(colors, wingsFront.outlined(K.outline));
  const head = hp.outlined(K.outline);
  colors = back ? over(head, colors) : over(colors, head);
  colors = over(colors, legs.px);
  return { w: W, h: H, colors };
}

/** Nido de ramas (en la copa de un árbol o en una repisa de roca) */
export function crowNestArt(): { w: number; h: number; colors: Int32Array } {
  const w = 16, h = 8;
  const p = new Pixels(w, h);
  const twigs = [0x3a2614, 0x5a3c20, 0x7a5430, 0x9a7044];
  p.ellipse(8, 5, 1, 0, 7, 2.6, (x, y) => twigs[(x * 7 + y * 3) % 4]);
  p.ellipse(8, 3.6, 1, 0, 5, 1.2, () => 0x1e140c);
  return { w, h, colors: p.outlined(0x1a1008) };
}
