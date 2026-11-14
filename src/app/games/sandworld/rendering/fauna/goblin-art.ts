import { Pixels, clamp, over } from './pixel-canvas';
import { column, lit, sphere, tri } from './volume';

/*
  Goblin de la Tierra Quemada (mockup): pequeño (como un niño humano), verde, encorvado, con la cabeza grande,
  orejas largas y puntiagudas, ojos amarillos que brillan de noche, boca ancha con colmillos, taparrabos y un
  garrote de hueso. De tres cuartos, con volumen (luz arriba a la izquierda), como los humanos.
  Poses: quieto, andando, corriendo, atacando (garrote en alto), comiendo (agachado), muerto.
*/

export type GoblinKind = 'adult' | 'young';
export type GoblinPose = 'idle' | 'walk' | 'run' | 'attack' | 'eat' | 'dead';

const W = 22, H = 24, GROUND = 21, FOOT_X = 11;
const K = {
  outline: 0x101a08,
  skin: [0x1e3a12, 0x2e5418, 0x427022, 0x5a8c2e, 0x76a83e, 0x96c454],
  belly: [0x5a7a30, 0x7a9a44],
  cloth: [0x2a1a0e, 0x40281a, 0x5a3a24],
  bone: [0x9a907a, 0xcfc4a8, 0xece4cc],
  eye: [0xffd040, 0xfff2a0],
  mouth: 0x1a0a06,
  tooth: 0xf4ecd8,
};

export function goblinArt(kind: GoblinKind, pose: GoblinPose, t: number, back: boolean): { w: number; h: number; colors: Int32Array } {
  const s = kind === 'young' ? 0.7 : 1;
  const n = Math.hypot(2, 1);
  const fx = (back ? 2 : -2) / n, fy = (back ? -1 : 1) / n;
  const sx = 2 / n, sy = 1 / n;
  const wave = Math.sin(t * Math.PI * 2);
  const far = new Pixels(W, H), mid = new Pixels(W, H), near = new Pixels(W, H), top = new Pixels(W, H), gear = new Pixels(W, H);
  const dim = (r: readonly number[], k: number) => r.map((_, i) => r[Math.max(0, i - k)]);

  if (pose === 'dead') {
    const ax = -2 / n, ay = 1 / n, cx = FOOT_X, cy = GROUND - 2;
    mid.ellipse(cx, cy, ax, ay, 4 * s, 2 * s, (x, y) => lit(K.skin, -(y + 0.5 - cy) * 0.6));
    mid.ellipse(cx - ax * 0.5, cy + 0.6, ax, ay, 2.5 * s, 1.2 * s, () => K.cloth[1]);
    const hx = cx + ax * 5 * s, hy = cy + ay * 5 * s - 1;
    sphere(top, hx, hy, 2.8 * s, K.skin);
    top.line(hx - 2 * s, hy - 1, hx - 5 * s, hy - 2.5, K.skin[2]);
    top.put(hx - 0.5, hy, K.mouth);
    gear.line(cx + 4, GROUND - 1, cx + 9, GROUND - 3, K.bone[1]);
    return { w: W, h: H, colors: over(over(over(mid.outlined(K.outline), top.outlined(K.outline)), gear.outlined(K.outline)), new Int32Array(W * H).fill(-1)) };
  }

  const crouch = pose === 'eat' ? 3 * s : 0;
  const bob = pose === 'walk' || pose === 'run' ? Math.abs(wave) * (pose === 'run' ? 1.2 : 0.6) : 0;
  const hipY = GROUND - 5 * s + crouch - bob;
  const hunch = 1.6 + (pose === 'run' ? 1.2 : pose === 'attack' ? 0.6 : 0);     // encorvado hacia delante
  const shY = hipY - 4.6 * s + (pose === 'eat' ? 1 : 0);
  const cx = FOOT_X, topX = cx + fx * hunch, topY = shY + fy * hunch * 0.5;

  // Piernas cortas y arqueadas
  const stride = pose === 'walk' ? wave * 1.6 : pose === 'run' ? wave * 2.6 : 0;
  for (const [side, layer] of [[-1, far], [1, near]] as const) {
    const st = stride * side;
    const hx = cx + sx * side * 1.3 * s, hy = hipY + sy * side * 0.5;
    const kx = hx + sx * side * 0.8 + fx * st * 0.4, ky = (hy + GROUND) / 2;
    const ftx = hx + fx * st + sx * side * 0.3, fty = GROUND - 0.6 + sy * side * 0.6;
    const ramp = side === 1 ? K.skin : dim(K.skin, 2);
    column(layer, hx, hy, kx, ky, 0.9 * s, 0.8 * s, ramp);
    column(layer, kx, ky, ftx, fty - 0.5, 0.8 * s, 0.8 * s, ramp);
    layer.put(ftx + fx * 1.4, fty, ramp[1]); layer.put(ftx + fx * 0.6, fty, ramp[2]);   // pies grandes
  }

  // Cuerpo: barriga redonda, taparrabos
  column(mid, topX, topY, cx, hipY, 2.2 * s, 2.6 * s, K.skin, 1 * s);
  mid.ellipse(cx + fx * 0.8, hipY - 1.6 * s, 1, 0, 1.4 * s, 1.2 * s, (x) => K.belly[x % 2]);
  for (let x = Math.floor(cx - 2.6 * s); x <= Math.ceil(cx + 2.6 * s); x++) { mid.put(x, hipY, K.cloth[1]); mid.put(x, hipY + 1, K.cloth[x % 2 ? 0 : 2]); }

  // Brazos largos (casi hasta el suelo) y el garrote de hueso
  const swing = pose === 'walk' ? wave * 1.6 : pose === 'run' ? wave * 2.6 : 0;
  const aF = { x: topX - sx * 2.2 * s, y: topY + 0.8 }, aN = { x: topX + sx * 2.3 * s, y: topY + 1 };
  column(far, aF.x, aF.y, aF.x - fx * swing * 0.5 + fx * 0.6, aF.y + 5 * s, 0.6, 0.6, dim(K.skin, 2));
  if (pose === 'attack') {
    column(near, aN.x, aN.y, aN.x + 0.6, aN.y - 4 * s, 0.7, 0.7, K.skin);
    gear.line(aN.x + 0.6, aN.y - 4 * s, aN.x - fx * 2 + 2, aN.y - 10 * s, K.bone[1]);
    sphere(gear, aN.x - fx * 2 + 2.3, aN.y - 10.5 * s, 1.3, K.bone);
  } else {
    column(near, aN.x, aN.y, aN.x + fx * swing * 0.5 + fx * 0.6, aN.y + 5 * s, 0.7, 0.6, K.skin);
    if (kind === 'adult') {
      const hx = aN.x + fx * swing * 0.5 + fx * 0.6, hy = aN.y + 5 * s;
      gear.line(hx, hy, hx - fx * 1 + 2.5, hy + 2.5, K.bone[1]);
      sphere(gear, hx - fx + 3, hy + 3, 1.2, K.bone);
    }
  }

  // Cabeza grande, orejas largas hacia los lados, ojos amarillos, boca ancha con colmillos
  const hr = 3.1 * (kind === 'young' ? 0.82 : 1);
  const hx = topX + fx * 1.4 + (pose === 'eat' ? fx * 1 : 0), hy = topY - hr * 0.7 + (pose === 'eat' ? 1.5 : 0);
  // Orejas: triángulos largos, la de detrás más oscura
  for (const side of [-1, 1]) {
    const ex = hx + sx * side * hr * 0.6 - fx * 0.6, ey = hy - hr * 0.3;
    const tipx = ex + side * 5 * s - fx * 1.5, tipy = ey - 1.6 - (pose === 'run' ? -1 : 0);
    tri(side === 1 ? top : far, ex, ey - 1.2, ex, ey + 1.2, tipx, tipy, (x) => lit(side === 1 ? K.skin : dim(K.skin, 2), side === 1 ? 0.3 : -0.4));
  }
  sphere(top, hx, hy, hr, K.skin);
  if (!back) {
    const ex = hx + fx * hr * 0.45, ey = hy - 0.4;
    top.put(ex, ey, K.eye[1]); top.put(ex + 1, ey, K.eye[0]);
    top.put(ex + 2.2, ey + 0.2, K.eye[0]);
    // Boca ancha y colmillos
    const my = hy + hr * 0.45;
    for (let x = Math.round(ex - 0.5); x <= Math.round(ex + 2.6); x++) top.put(x, my, pose === 'attack' || pose === 'eat' ? K.mouth : K.skin[0]);
    top.put(ex, my + (pose === 'attack' ? 1 : 0), K.tooth); top.put(ex + 2, my + (pose === 'attack' ? 1 : 0), K.tooth);
    top.put(hx + fx * (hr + 0.5), hy + 0.4, K.skin[3]);                 // nariz ganchuda
    top.put(hx + fx * (hr + 1.2), hy + 1, K.skin[2]);
  }

  let colors = far.outlined(K.outline);
  colors = over(colors, mid.outlined(K.outline));
  colors = over(colors, near.outlined(K.outline));
  colors = over(colors, top.outlined(K.outline));
  colors = over(colors, gear.outlined(K.outline));
  return { w: W, h: H, colors };
}

/** Colores del nido: carbón, ceniza y brasas (heredados del diseño de "las cosas" de la Tierra Quemada) */
const L = {
  outline: 0x08060a,
  coal: [0x0e0c0e, 0x1a1618, 0x262022, 0x342c2c, 0x463c38],
  ash: [0x5a524c, 0x7a706a, 0x9a908a],
  ember: [0x9a2a10, 0xd8501a, 0xff8a2a, 0xffd060],
};

/** Nido de los goblins: un montículo de carbón con la boca oscura y brasas; helado (escarcha) o hundido (ceniza) */
export function goblinLairArt(state: 'alive' | 'frozen' | 'collapsed'): { w: number; h: number; colors: Int32Array } {
  const w = 28, h = 16;
  const p = new Pixels(w, h), g = new Pixels(w, h);
  if (state === 'collapsed') {
    p.ellipse(14, 11, 1, 0, 11, 3.5, (x, y) => L.ash[(x + y * 2) % 3]);
    return { w, h, colors: p.outlined(L.outline) };
  }
  p.ellipse(14, 10, 1, 0, 12, 5.5, (x, y) => L.coal[clamp(Math.round(3 - (x - 10) * 0.12 - (y - 7) * 0.4), 0, 4)]);
  // Boca
  p.ellipse(14, 10.5, 1, 0, 4, 2.2, () => 0x050304);
  const ember = state === 'frozen' ? [0x6a8aa8, 0xa8c8e0] : [L.ember[1], L.ember[2]];
  for (const [x, y] of [[11, 9], [17, 9], [14, 12], [12, 12], [16, 12]]) g.put(x, y, ember[(x + y) % 2]);
  for (const [x, y] of [[7, 7], [20, 8], [10, 5]]) g.put(x, y, ember[0]);
  if (state === 'frozen') for (let x = 4; x < 25; x += 2) g.put(x, 5 + ((x * 3) % 3), 0xe0f0ff);
  return { w, h, colors: over(p.outlined(L.outline), g.px) };
}
