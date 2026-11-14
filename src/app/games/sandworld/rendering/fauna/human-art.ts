import { Pixels, over } from './pixel-canvas';
import { column, lit, sphere } from './volume';

/*
  Humano isométrico en alta densidad (mockup v3): el mismo tamaño en la isla, pero dibujado en una rejilla el doble
  de fina (D = 2: cada píxel del dibujo ocupa medio píxel de mundo). Así caben detalles que a la densidad de los
  animales no caben: ojos con blanco, cejas, mechones, costuras de la piel, cinturón con nudo, collar de dientes,
  la atadura de la punta de la lanza.
  De tres cuartos con volumen (luz arriba a la izquierda), como la v2.
*/

export type HumanKind = 'man' | 'woman' | 'child';
export type HumanPose = 'idle' | 'walk' | 'run' | 'gather' | 'hunt' | 'sleep' | 'dead';

export const D = 2;
const U = D;                                         // un "píxel de mundo" en píxeles del dibujo
const W = 20 * U, H = 30 * U, GROUND = 27 * U, FOOT_X = 10 * U;
const K = {
  outline: 0x22140c,
  skin: [[0x6a3e26, 0x8a5838, 0xa87048, 0xc48a62, 0xdca27a, 0xf2bf98], [0x3e2414, 0x58361e, 0x724a2c, 0x8c5e3c, 0xa8764e, 0xc29068]],
  hair: [[0x100a06, 0x1e120a, 0x2e1c10, 0x422a18, 0x583a22], [0x2e1a0a, 0x4a2c12, 0x6a421c, 0x8a5a28, 0xa87436]],
  hide: [0x26180c, 0x3a2614, 0x50361e, 0x684828, 0x825c34, 0x9c7242],
  fur: [0x8a7a60, 0xb4a488, 0xd6c8aa, 0xeee4cc],
  spear: [0x4a3018, 0x6e4c2a, 0x94703e],
  stone: [0x4a4a52, 0x74747e, 0xa4a4b0],
  tooth: 0xf0ead8,
  beads: [0xc84a2a, 0x2a8aa0, 0xe8c050],
  dress: [0x30200e, 0x4a3218, 0x664624, 0x845c30, 0xa0743e, 0xba8c50],
  eyeWhite: 0xeae4dc,
  pupil: 0x1a0e08,
};

export function humanArt(kind: HumanKind, pose: HumanPose, t: number, back: boolean, tone = 0): { w: number; h: number; colors: Int32Array } {
  const s = (kind === 'child' ? 0.66 : kind === 'woman' ? 0.93 : 1) * U;
  const SK = K.skin[tone], HR = K.hair[tone];
  const n = Math.hypot(2, 1);
  const fx = (back ? 2 : -2) / n, fy = (back ? -1 : 1) / n;
  const sx = 2 / n, sy = 1 / n;
  const wave = Math.sin(t * Math.PI * 2);
  const far = new Pixels(W, H), mid = new Pixels(W, H), near = new Pixels(W, H), top = new Pixels(W, H), gear = new Pixels(W, H), det = new Pixels(W, H);
  const dim = (r: readonly number[], k: number) => r.map((_, i) => r[Math.max(0, i - k)]);

  if (pose === 'sleep' || pose === 'dead') {
    const ax = -2 / n, ay = 1 / n, cx = FOOT_X, cy = GROUND - 2.5 * U;
    mid.ellipse(cx + ax * 1.5 * s, cy + ay * 1.5 * s, ax, ay, 5.5 * s, 2.2 * s, (x, y) => lit(K.hide, -(x + 0.5 - cx) * 0.08 - (y + 0.5 - cy) * 0.3));
    near.ellipse(cx - ax * 4.5 * s, cy - ay * 4.5 * s + 0.6 * U, ax, ay, 2.8 * s, 1.3 * s, (x, y) => lit(SK, -(y + 0.5 - cy) * 0.25));
    const hx = cx + ax * 7.5 * s, hy = cy + ay * 7.5 * s - U;
    sphere(top, hx, hy, 2.2 * s, SK);
    sphere(top, hx + 0.6 * U, hy - 0.8 * U, 2.2 * s, HR, (x, y) => y + 0.5 < hy - 0.4 * U || x + 0.5 > hx + 0.8 * U);
    if (pose === 'dead') { det.put(hx - 1.2 * U, hy, K.pupil); det.put(hx - 1.2 * U + 1, hy + 1, K.pupil); }
    else for (let k = 0; k < 3; k++) det.put(hx - 1.6 * U + k, hy + 0.2 * U, HR[0]);   // ojos cerrados
    let colors = mid.outlined(K.outline);
    colors = over(colors, near.outlined(K.outline));
    colors = over(colors, top.outlined(K.outline));
    return { w: W, h: H, colors: over(colors, det.px) };
  }

  const crouch = pose === 'gather' ? 4.5 * s : 0;
  const bob = pose === 'walk' || pose === 'run' ? Math.abs(wave) * (pose === 'run' ? 1.2 : 0.6) * U : 0;
  const hipY = GROUND - 8 * s + crouch - bob;
  const shY = hipY - 6.6 * s + (pose === 'gather' ? 1.2 * U : 0);
  const lean = (pose === 'run' ? 1.3 : pose === 'gather' ? 1.8 : 0) * U;
  const cx = FOOT_X, topX = cx + fx * lean, topY = shY + fy * lean * 0.5;

  // ── Piernas (muslo con la falda de piel, pierna desnuda, pie con abarca)
  const stride = (pose === 'walk' ? wave * 1.8 : pose === 'run' ? wave * 3 : 0) * U;
  for (const [side, layer] of [[-1, far], [1, near]] as const) {
    const st = stride * (side === 1 ? 1 : -1);
    const hx = cx + sx * side * 1.2 * s, hy = hipY + sy * side * 0.6 * U;
    const kx = hx + fx * (pose === 'gather' ? 2 * U : st * 0.4), ky = (hy + GROUND) / 2 + (pose === 'gather' ? -U : 0);
    const ftx = hx + fx * st + (pose === 'gather' ? fx * 1.2 * U : 0), fty = GROUND - 0.6 * U + sy * side * 0.6 * U + fy * st * 0.5;
    const k = side === 1 ? 0 : 1;
    column(layer, hx, hy, kx, ky, 1.1 * s, 1.0 * s, dim(K.hide, k));
    column(layer, kx, ky, ftx, fty - 0.8 * U, 0.85 * s, 0.75 * s, dim(SK, k));
    // Abarca de piel atada al tobillo
    layer.ellipse(ftx + fx * 0.7 * U, fty - 0.2 * U, fx, fy, 1.5 * U, 0.8 * U, (x) => lit(dim(K.hide, k), -(x - ftx) * 0.2));
    det.line(ftx - 0.8 * U, fty - 1.2 * U, ftx + 0.8 * U, fty - 1.2 * U, K.hide[1]);
  }

  // ── Tronco: túnica con costuras, cinturón con nudo, cuello de piel con pelo. La mujer, vestido largo hasta
  // las rodillas con flecos, más claro, y collar de cuentas de colores
  const woman = kind === 'woman';
  column(mid, topX, topY, cx, hipY + U, (woman ? 2.2 : 2.4) * s, 2.8 * s, woman ? K.dress : K.hide, 1.1 * s);
  if (woman) {
    const hem = hipY + 3.6 * s;
    column(mid, cx, hipY, cx + fx * stride * 0.15, hem, 2.8 * s, 3.3 * s, K.dress);
    for (let x = Math.floor(cx - 3.3 * s); x <= Math.ceil(cx + 3.3 * s); x += 2) det.line(x, hem, x + fx * 0.5, hem + 2, K.dress[x % 4 === 0 ? 4 : 2]);
  }
  for (let y = Math.round(topY + 2 * U); y < hipY; y += 3) det.put(topX + fx * 0.6 * U + (y - topY) * 0.05, y, K.hide[1]);   // costura
  for (let x = Math.floor(cx - 2.7 * s); x <= Math.ceil(cx + 2.7 * s); x++) { det.put(x, hipY - 0.6 * U, K.hide[0]); det.put(x, hipY - 0.6 * U + 1, K.hide[1]); }
  det.put(cx + fx * 0.8 * U, hipY - 0.6 * U + 2, K.hide[0]); det.put(cx + fx * 0.8 * U - 1, hipY - 0.6 * U + 3, K.hide[0]);   // nudo
  mid.ellipse(topX, topY + 0.3 * U, 1, 0, 2.7 * s, 1.15 * s, (x, y) => lit(K.fur, -(x + 0.5 - topX) / (2.7 * s) + ((x * 7 + y * 3) % 5 === 0 ? -0.6 : 0)));
  if (kind === 'man' && !back) for (let k = -2; k <= 2; k++) det.put(topX + k * 1.4, topY + 1.8 * U + Math.abs(k) * -0.3, K.tooth);   // collar de dientes
  if (woman && !back) for (let k = -3; k <= 3; k++) det.put(topX + k * 1.1, topY + 1.6 * U + Math.abs(k) * 0.35, K.beads[(k + 3) % 3]);   // collar de cuentas

  // ── Brazos
  const swing = (pose === 'walk' ? wave * 1.6 : pose === 'run' ? wave * 2.6 : 0) * U;
  const aF = { x: topX - sx * 2.3 * s, y: topY + U }, aN = { x: topX + sx * 2.4 * s, y: topY + 1.2 * U };
  const arm = (layer: Pixels, x0: number, y0: number, x1: number, y1: number, k: number) => {
    column(layer, x0, y0, x1, y1, 0.75 * U, 0.65 * U, dim(SK, k));
    layer.ellipse(x1, y1 + 0.4 * U, 1, 0, 0.8 * U, 0.8 * U, (x) => lit(dim(SK, k), -(x - x1) * 0.3));   // mano
  };
  if (pose === 'gather') {
    arm(near, aN.x, aN.y, aN.x + fx * 3 * U, GROUND - 2 * U, 0);
    arm(far, aF.x, aF.y, aF.x + fx * 3.4 * U, GROUND - 2.4 * U, 1);
  } else if (pose === 'hunt') {
    arm(near, aN.x, aN.y, aN.x + 0.5 * U, aN.y - 4.5 * s, 0);
    arm(far, aF.x, aF.y, aF.x + fx * 2 * U, aF.y + 3 * s, 1);
    if (kind !== 'child') spear(gear, det, aN.x + 0.5 * U - fx * 4 * U, aN.y - 4.5 * s + 3 * U, aN.x + 0.5 * U + fx * 6 * U, aN.y - 4.5 * s - 3 * U);
  } else {
    arm(far, aF.x, aF.y, aF.x - fx * swing * 0.5, aF.y + 4.6 * s, 1);
    arm(near, aN.x, aN.y, aN.x + fx * swing * 0.5, aN.y + 4.6 * s, 0);
    if (kind === 'man' && pose !== 'run') {
      const hx = aN.x + 0.3 * U;
      spear(gear, det, hx, GROUND - 0.5 * U, hx + 0.8 * U, aN.y - 5 * U);
    }
  }

  // ── Cabeza: cara de tres cuartos con ojos (blanco y pupila), ceja, nariz, boca; pelo con mechones
  const hr = (kind === 'child' ? 2.4 * U : 2.3 * s);
  const hx = topX + fx * 0.4 * U + (pose === 'gather' ? fx * 1.2 * U : 0), hy = topY - hr - 0.8 * U + (pose === 'gather' ? 0.8 * U : 0);
  sphere(top, hx, hy, hr, SK);
  const hairMask = (x: number, y: number) => {
    const dx = x + 0.5 - hx, dy = y + 0.5 - hy;
    return back || dy < -hr * 0.4 + Math.sin(x * 1.7) * 0.6 || dx * fx + dy * fy < -hr * 0.2;
  };
  sphere(top, hx, hy, hr + 0.3 * U, HR, hairMask);
  // Mechones: rayas claras y oscuras en el pelo
  for (let y = Math.floor(hy - hr); y < hy + hr; y++) for (let x = Math.floor(hx - hr); x < hx + hr; x++) {
    if (!hairMask(x, y) || (x + 0.5 - hx) ** 2 + (y + 0.5 - hy) ** 2 > hr * hr) continue;
    if ((x * 2 + y) % 5 === 0) det.put(x, y, HR[4]);
    else if ((x * 2 + y) % 5 === 2) det.put(x, y, HR[1]);
  }
  if (woman) {
    // Melena larga: por la espalda hasta media espalda, y un mechón que cae por delante del hombro
    column(far, hx - fx * hr * 0.8, hy, hx - fx * hr * 1.2, topY + 4.5 * U, 1.8 * U, 2.1 * U, HR);
    if (!back) column(near, hx + sx * hr * 0.7, hy + hr * 0.3, hx + sx * hr * 0.9, topY + 3 * U, 0.8 * U, 0.7 * U, HR);
    // Cinta en la frente
    for (let x = Math.floor(hx - hr); x <= Math.ceil(hx + hr); x++) if ((x + 0.5 - hx) ** 2 < hr * hr) det.put(x, hy - hr * 0.45, K.beads[0]);
  }
  if (!back) {
    const ex = Math.round(hx + fx * hr * 0.5), ey = Math.round(hy);
    det.put(ex - 1, ey, K.pupil); det.put(ex, ey, K.pupil);                         // ojo de delante (sin blanco, como los animales)
    det.put(ex + 2, ey, K.pupil);                                                   // el de detrás, de perfil
    det.line(ex - 1, ey - 2, ex + 2, ey - 2, HR[1]);                                // ceja
    det.put(hx + fx * (hr + 0.6 * U), hy + 0.8 * U, SK[3]); det.put(hx + fx * (hr + 0.6 * U), hy + 1.3 * U, SK[2]);   // nariz
    det.line(ex - 1, ey + 3, ex + 1, ey + 3, SK[1]);                                 // boca
    if (kind === 'man') for (let x = ex - 2; x <= ex + 3; x++) for (const y of [ey + 4, ey + 5]) if ((x + y) % 2) det.put(x, y, HR[2]);   // barba
  }

  let colors = far.outlined(K.outline);
  colors = over(colors, mid.outlined(K.outline));
  colors = over(colors, near.outlined(K.outline));
  colors = over(colors, top.outlined(K.outline));
  colors = over(colors, det.px);
  colors = over(colors, gear.outlined(K.outline));
  return { w: W, h: H, colors };
}

/** Lanza: astil con veta, punta de piedra y la atadura */
function spear(g: Pixels, det: Pixels, x0: number, y0: number, x1: number, y1: number): void {
  g.line(x0, y0, x1, y1, K.spear[1]);
  g.line(x0 + 1, y0, x1 + 1, y1, K.spear[2]);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
  // Punta de piedra (triángulo) y atadura
  for (let k = 0; k < 5; k++) for (let w = -1; w <= 1; w++) if (Math.abs(w) <= (5 - k) / 2.5) g.put(x1 + ux * k + -uy * w, y1 + uy * k + ux * w, K.stone[k < 2 ? 1 : 2]);
  det.put(x1 - ux * 1, y1 - uy * 1, K.hide[4]); det.put(x1 - ux * 2, y1 - uy * 2, K.hide[2]);
}

/** Choza isométrica en alta densidad: cono de pieles cosidas con palos, base en perspectiva y la entrada */
export function hutArt(): { w: number; h: number; colors: Int32Array } {
  const w = 34 * U, h = 28 * U;
  const p = new Pixels(w, h), poles = new Pixels(w, h);
  const cx = 17 * U, baseY = 22 * U, rx = 13 * U, ry = 6.5 * U, apexY = 3 * U;
  const hides = [0x2e1e10, 0x46301a, 0x5e4224, 0x7a5830, 0x96703e, 0xb08852];
  for (let y = apexY; y <= baseY + ry; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx, py = y + 0.5;
      const f = (py - apexY) / (baseY - apexY);
      const inCone = f >= 0 && f <= 1 && Math.abs(px) <= rx * f;
      const inBase = py > baseY && (px / rx) ** 2 + ((py - baseY) / ry) ** 2 <= 1;
      if (!inCone && !inBase) continue;
      const a = inCone ? px / (rx * Math.max(f, 0.05)) : px / rx;
      let l = -a * 0.9 + 0.1 - (inBase ? 0.15 : 0);
      // Pieles cosidas: paneles separados por costuras hacia la punta, y puntadas
      const panel = (a + 1) * 4;
      if (Math.abs(panel - Math.round(panel)) < 0.06) l -= 0.5;
      if (Math.abs(panel - Math.round(panel)) < 0.12 && y % 4 === 0) l += 0.6;
      if ((x * 3 + y * 5) % 23 === 0) l += 0.25;
      p.put(x, y, lit(hides, l));
    }
  }
  const dx = cx - 3 * U, dyTop = baseY - 7 * U;
  for (let y = dyTop; y <= baseY + 4 * U; y++) {
    const half = Math.min(2.6 * U, (y - dyTop) * 0.7 + 0.8 * U);
    for (let x = Math.round(dx - half); x <= Math.round(dx + half); x++) p.put(x, y, y < dyTop + 2 * U ? 0x2a1a10 : 0x120a06);
  }
  // Borde enrollado de la puerta
  for (let y = dyTop; y <= baseY + 4 * U; y += 2) { const half = Math.min(2.6 * U, (y - dyTop) * 0.7 + 0.8 * U); p.put(dx - half - 1, y, hides[5]); }
  for (const [ex, ey] of [[cx - 4 * U, 0], [cx + 3 * U, 0], [cx + 0.5 * U, -U]]) { poles.line(cx, apexY + 1.5 * U, ex, ey, 0x6a4a28); poles.line(cx + 1, apexY + 1.5 * U, ex + 1, ey, 0x4a3018); }
  return { w, h, colors: over(p.outlined(0x20140a), poles.px) };
}
