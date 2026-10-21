// Rutas a pie para la fauna. Solo se usan cuando el camino recto se atasca (un lago, una terraza alta) y el
// destino está lejos: andar en línea recta es gratis y casi siempre basta. Lógica pura: del mundo solo sabe la
// altura de cada celda (o que no se pisa) y el desnivel que se puede subir de un paso.
//
// Rendimiento (móvil): trabaja en una ventana acotada alrededor de la salida y la llegada, con arrays tipados
// (nada de mapas ni cadenas), pregunta por cada celda una sola vez y mira como mucho `maxNodes` celdas.

/** Altura de una celda o NaN si no se pisa (agua, fuera de la isla...) */
export type HeightAt = (x: number, y: number) => number;

/** Margen (celdas) alrededor de la salida y la llegada en que busca, y lado máximo de la ventana */
const MARGIN = 24;
const MAX_SIDE = 160;
/** Peso de la estimación: algo más de 1 encuentra caminos casi tan buenos mirando muchas menos celdas */
const GREED = 1.2;
/** Celdas por delante que mira al simplificar el camino */
const LOOKAHEAD = 40;

// Memoria de trabajo reutilizada entre búsquedas (una sola reserva, del tamaño de la ventana más grande)
const CELLS = MAX_SIDE * MAX_SIDE;
const HEIGHT = new Float32Array(CELLS);
const KNOWN = new Uint8Array(CELLS);
const COSTS = new Float32Array(CELLS);
const PARENT = new Int32Array(CELLS);
const CLOSED = new Uint8Array(CELLS);

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
const COST = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

/**
 * Camino (A*) de la celda (fx, fy) a la (gx, gy). Devuelve puntos de paso (centros de celda, en pares x, y) sin
 * el de salida, ya simplificado (solo donde hay que girar). Si no llega, vale el camino a la celda más cercana
 * al destino siempre que acerque de verdad; si ni eso, null.
 */
export function findPath(fx: number, fy: number, gx: number, gy: number, heightAt: HeightAt, maxStep: number, maxNodes: number): number[] | null {
  // Ventana de búsqueda
  let x0 = Math.min(fx, gx) - MARGIN, y0 = Math.min(fy, gy) - MARGIN;
  let w = Math.abs(gx - fx) + 2 * MARGIN + 1, h = Math.abs(gy - fy) + 2 * MARGIN + 1;
  if (w > MAX_SIDE) { x0 += (w - MAX_SIDE) >> 1; w = MAX_SIDE; }
  if (h > MAX_SIDE) { y0 += (h - MAX_SIDE) >> 1; h = MAX_SIDE; }
  const inside = (x: number, y: number) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;
  if (!inside(fx, fy)) return null;
  const n = w * h;
  const at = (x: number, y: number) => (y - y0) * w + (x - x0);
  // Alturas (pedidas una vez por celda: 0 = sin preguntar, 1 = se pisa, 2 = no)
  const height = HEIGHT, known = KNOWN.fill(0, 0, n);
  const walk = (i: number, x: number, y: number): boolean => {
    if (!known[i]) {
      const v = heightAt(x, y);
      known[i] = Number.isNaN(v) ? 2 : 1;
      height[i] = v;
    }
    return known[i] === 1;
  };
  const cost = COSTS.fill(Infinity, 0, n);
  const parent = PARENT.fill(-1, 0, n);
  const closed = CLOSED.fill(0, 0, n);
  const est = (x: number, y: number) => Math.hypot(gx - x, gy - y);
  const start = at(fx, fy);
  walk(start, fx, fy);
  cost[start] = 0;
  const open = new Heap();
  open.push(start, est(fx, fy) * GREED);
  let best = start, bestH = est(fx, fy), seen = 0;
  while (open.size && seen < maxNodes) {
    const i = open.pop();
    if (closed[i]) continue;
    closed[i] = 1;
    seen++;
    const x = x0 + (i % w), y = y0 + Math.floor(i / w);
    const hi = est(x, y);
    if (hi < bestH) {
      best = i;
      bestH = hi;
    }
    if (x === gx && y === gy) break;
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!inside(nx, ny)) continue;
      const j = at(nx, ny);
      if (closed[j] || !walk(j, nx, ny) || Math.abs(height[j] - height[i]) > maxStep) continue;
      // En diagonal no corta esquinas: las dos celdas de al lado también tienen que pisarse
      if (d >= 4 && (!walk(at(nx, y), nx, y) || !walk(at(x, ny), x, ny))) continue;
      const g = cost[i] + COST[d];
      if (g >= cost[j]) continue;
      cost[j] = g;
      parent[j] = i;
      open.push(j, g + est(nx, ny) * GREED);
    }
  }
  // Sin llegar: solo vale si se acerca de verdad (si no, mejor rendirse que dar vueltas)
  if (best === start || (bestH > 0 && est(fx, fy) - bestH < 2)) return null;
  const cells: number[] = [];
  for (let i = best; i !== start && i >= 0; i = parent[i]) cells.push(i);
  cells.reverse();
  // ¿Se va en línea recta de un punto a otro? (mira cada celda que pisa, como al andar)
  const passable = (from: number, x: number, y: number) => {
    if (!inside(x, y)) return false;
    const j = at(x, y);
    return walk(j, x, y) && Math.abs(height[j] - height[from]) <= maxStep;
  };
  const straight = (ax: number, ay: number, bx: number, by: number): boolean => {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.4);
    let cx = Math.floor(ax), cy = Math.floor(ay);
    for (let s = 1; s <= steps; s++) {
      const x = Math.floor(ax + ((bx - ax) * s) / steps), y = Math.floor(ay + ((by - ay) * s) / steps);
      if (x === cx && y === cy) continue;
      const ci = at(cx, cy);
      if (!passable(ci, x, y)) return false;
      if (x !== cx && y !== cy && (!passable(ci, x, cy) || !passable(ci, cx, y))) return false;
      cx = x;
      cy = y;
    }
    return true;
  };
  // Tira del hilo: desde cada punto, salta a la celda más lejana del camino que se vea en línea recta
  const out: number[] = [];
  let ax = fx + 0.5, ay = fy + 0.5;
  for (let c = 0; c < cells.length;) {
    let far = c;
    for (let m = Math.min(cells.length - 1, c + LOOKAHEAD); m > c; m--) {
      const mx = x0 + (cells[m] % w) + 0.5, my = y0 + Math.floor(cells[m] / w) + 0.5;
      if (straight(ax, ay, mx, my)) {
        far = m;
        break;
      }
    }
    ax = x0 + (cells[far] % w) + 0.5;
    ay = y0 + Math.floor(cells[far] / w) + 0.5;
    out.push(ax, ay);
    c = far + 1;
  }
  return out;
}

/** Montículo binario de mínimos (índice, prioridad) sobre arrays: lo justo para A* sin dependencias */
class Heap {
  private keys = new Int32Array(256);
  private prio = new Float32Array(256);
  size = 0;

  push(k: number, p: number): void {
    if (this.size === this.keys.length) {
      const keys = new Int32Array(this.size * 2), prio = new Float32Array(this.size * 2);
      keys.set(this.keys);
      prio.set(this.prio);
      this.keys = keys;
      this.prio = prio;
    }
    const { keys, prio } = this;
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (prio[parent] <= p) break;
      keys[i] = keys[parent];
      prio[i] = prio[parent];
      i = parent;
    }
    keys[i] = k;
    prio[i] = p;
  }

  pop(): number {
    const { keys, prio } = this;
    const top = keys[0];
    const last = --this.size;
    if (last > 0) {
      const k = keys[last], p = prio[last];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i, mp = p;
        if (l < last && prio[l] < mp) { m = l; mp = prio[l]; }
        if (r < last && prio[r] < mp) { m = r; mp = prio[r]; }
        if (m === i) break;
        keys[i] = keys[m];
        prio[i] = prio[m];
        i = m;
      }
      keys[i] = k;
      prio[i] = p;
    }
    return top;
  }
}
