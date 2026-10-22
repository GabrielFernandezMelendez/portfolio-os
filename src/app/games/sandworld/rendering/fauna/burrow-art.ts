import { BURROW_COLORS as K } from '../../config/fauna-art.config';
import { Pixels, clamp } from './pixel-canvas';

/*
  Refugios en isométrico, generados por código (luz arriba a la izquierda):
  - 'burrow' (conejo): un agujero en el suelo, un rombo redondeado 2:1 en el que se ve la pared de tierra del
    fondo y la oscuridad; alrededor, el anillo de tierra removida y algo de tierra echada a un lado.
  - 'cave' (guarida natural del lobo): un peñasco de roca con musgo y una boca oscura en la cara que da al jugador.
  - 'den' (guarida que construyen los lobos): un montón de ramas cruzadas y piedras con la boca delante.
  Estados: 'digging' (cavándose o a medio construir), 'open' y 'blocked' (tapada de arena).
*/

export type RefugeKind = 'burrow' | 'cave' | 'den';
export type RefugeState = 'digging' | 'open' | 'blocked';

export interface RefugeArt {
  readonly w: number;
  readonly h: number;
  /** Píxel de la entrada en el suelo (donde está la madriguera en el mundo) */
  readonly footX: number;
  readonly footY: number;
  readonly colors: Int32Array;
}

const SIZE = { burrow: { w: 16, h: 9 }, cave: { w: 30, h: 22 }, den: { w: 26, h: 17 } } as const;

export function refugeArt(kind: RefugeKind, state: RefugeState): RefugeArt {
  const { w: W, h: H } = SIZE[kind];
  const cv = new Pixels(W, H);
  const foot = kind === 'burrow' ? burrow(cv, W, H, state) : kind === 'cave' ? cave(cv, W, H, state) : den(cv, W, H, state);
  return { w: W, h: H, footX: foot.x, footY: foot.y, colors: cv.outlined(K.outline) };
}

/** Rombo redondeado 2:1 (elipse isométrica): ¿está (x, y) dentro? y a qué "distancia" del centro (0..1) */
const iso = (x: number, y: number, cx: number, cy: number, rx: number): number => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / (rx / 2)) ** 2;

/** Boca oscura en la tierra: pared del fondo iluminada (se ve desde delante) y negro abajo */
function hole(cv: Pixels, cx: number, cy: number, rx: number, state: RefugeState): void {
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const d = iso(x, y, cx, cy, rx);
      if (d > 1) continue;
      if (state === 'blocked') {
        cv.put(x, y, d < 0.5 ? K.sand[1] : K.sand[0]);
        continue;
      }
      // La mitad de atrás deja ver la pared de tierra (más clara arriba); la de delante, oscuridad
      const back = y + 0.5 - cy < -rx * 0.12;
      cv.put(x, y, back ? (y + 0.5 - cy < -rx * 0.32 ? K.dirt[1] : K.dirt[0]) : d < 0.6 ? K.hole[0] : K.hole[1]);
    }
  }
}

/** Boca en arco (plana por abajo, en el suelo): oscura, algo más clara hacia el borde izquierdo (luz) */
function arch(cv: Pixels, mx: number, my: number, rw: number, rh: number, state: RefugeState): void {
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const dx = (x + 0.5 - mx) / rw, dy = (y + 0.5 - my) / rh;
      if (dy > 0 || dx * dx + dy * dy > 1) continue;
      if (state === 'blocked') cv.put(x, y, dy > -0.5 ? K.sand[1] : K.sand[0]);
      else cv.put(x, y, dx < -0.7 && dy < -0.3 ? K.hole[1] : K.hole[0]);
    }
  }
}

/** Madriguera de conejo: agujero en el suelo con su anillo de tierra removida */
function burrow(cv: Pixels, W: number, H: number, state: RefugeState): { x: number; y: number } {
  const cx = W / 2, cy = H / 2 + 0.5;
  const ring = state === 'digging' ? 4.6 : 7;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = iso(x, y, cx, cy, ring);
      if (d > 1 || (d > 0.75 && (x * 5 + y * 3) % 3 === 0)) continue;      // borde irregular
      const l = -(x + 0.5 - cx) * 0.25 - (y + 0.5 - cy) * 0.6;
      cv.put(x, y, K.dirt[clamp(Math.round(1 + l * 0.5), 0, 2)]);
    }
  }
  // Tierra echada a un lado (delante a la derecha)
  for (const [x, y] of [[cx + 4, cy + 2], [cx + 5, cy + 2], [cx + 6, cy + 1], [cx + 3, cy + 3]]) cv.put(x, y, K.dirt[2]);
  if (state !== 'digging') hole(cv, cx - 0.5, cy, 4.4, state);
  else hole(cv, cx, cy, 2, 'open');
  return { x: Math.round(cx), y: Math.round(cy) };
}

/** Cueva de roca: peñasco de bloques redondeados, musgo arriba y la boca abajo a la izquierda */
function cave(cv: Pixels, W: number, H: number, state: RefugeState): { x: number; y: number } {
  const R = K.rock, gy = H - 4;
  const blocks: readonly (readonly [number, number, number])[] = [
    [W * 0.62, gy - 6, 7.5], [W * 0.38, gy - 4, 7], [W * 0.72, gy - 1, 6], [W * 0.5, gy - 10, 5.5], [W * 0.3, gy, 5.5],
  ];
  for (const [bx, by, r] of blocks) {
    cv.ellipse(bx, by, 1, 0, r, r * 0.78, (x, y) => {
      const l = -(x + 0.5 - bx) * 0.5 - (y + 0.5 - by) * 0.9;
      return R[clamp(Math.round(2 + l * 0.45), 0, 4)];
    });
  }
  // Grietas
  cv.line(W * 0.55, gy - 12, W * 0.6, gy - 7, R[0]);
  cv.line(W * 0.78, gy - 6, W * 0.74, gy - 2, R[0]);
  // Musgo por arriba
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (cv.px[y * W + x] < 0) continue;
      if (y < gy - 11 && (x * 7 + y) % 3 !== 0) cv.put(x, y, K.moss[(x + y) % 2]);
      break;
    }
  }
  // Boca: arco oscuro en la cara de delante-izquierda, apoyado en el suelo
  const mx = W * 0.36, my = gy + 1;
  arch(cv, mx, my, 4.2, 6, state);
  return { x: Math.round(mx), y: Math.round(my) };
}

/** Guarida de ramas: cúpula baja de ramas apoyadas unas contra otras, piedras en la base y la boca delante */
function den(cv: Pixels, W: number, H: number, state: RefugeState): { x: number; y: number } {
  const B = K.branch, cx = W / 2, gy = H - 3;
  const top = state === 'digging' ? gy - 4 : gy - 9;
  // Fondo oscuro de la cúpula (lo que se ve entre las ramas)
  cv.ellipse(cx, gy - 2, 1, 0, 10, state === 'digging' ? 3 : 4.5, () => B[0]);
  cv.ellipse(cx + 0.5, (gy + top) / 2, 1, 0, 6.5, (gy - top) / 2 + 0.5, () => B[0]);
  // Ramas: de la base hacia la punta, unas claras (delante, con luz) y otras oscuras (detrás)
  const n = state === 'digging' ? 7 : 15;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), bx = cx - 9.5 + f * 19, by = gy - 0.5 + Math.sin(f * Math.PI) * 1.2;
    const tx = cx + (f - 0.5) * 3 + ((i * 7) % 3) - 1, ty = top + ((i * 5) % 3);
    const front = i % 2 === 0;
    cv.line(bx, by, tx, ty, front ? B[3 - (bx < cx ? 0 : 1)] : B[1]);
  }
  // Un par de ramas atravesadas y la punta que sobresale
  if (state !== 'digging') {
    cv.line(cx - 7, gy - 4, cx + 6, gy - 6, B[2]);
    cv.line(cx + 1, top + 1, cx + 3, top - 2, B[2]);
  }
  // Piedras en la base
  for (const [px, py] of [[cx + 8, gy], [cx - 9.5, gy - 0.5], [cx + 4, gy + 0.6]] as const) {
    cv.ellipse(px, py, 1, 0, 1.8, 1.3, (x, y) => (x + 0.5 - px + (y + 0.5 - py) < 0 ? K.rock[3] : K.rock[1]));
  }
  const mx = cx - 3, my = gy + 0.5;
  if (state !== 'digging') arch(cv, mx, my, 3, 4.2, state);
  return { x: Math.round(mx), y: Math.round(my) };
}
