import { Pixels, clamp } from './pixel-canvas';

/*
  Volumen para figuras de pie (humanos, goblins): columnas y esferas sombreadas con la luz arriba a la izquierda,
  para que se lean con profundidad en la isométrica y no como recortes planos.
*/

/** Tono de una rampa (oscuro → claro) según cuánto le da la luz (-1 sombra, 1 luz) */
export function lit(ramp: readonly number[], l: number): number {
  return ramp[clamp(Math.round(((l + 1) / 2) * (ramp.length - 1)), 0, ramp.length - 1)];
}

/**
 * Columna (tronco, pierna, brazo): sección elíptica de radio `rx` (y `ry` de fondo, por la perspectiva) desde y0
 * (arriba) a y1 (abajo), con el centro moviéndose de (x0) a (x1). Luz de la izquierda; el canto de arriba, más claro.
 */
export function column(p: Pixels, x0: number, y0: number, x1: number, y1: number, rx0: number, rx1: number, ramp: readonly number[], capRy = 0): void {
  const steps = Math.max(1, Math.ceil(Math.abs(y1 - y0) * 2));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f, rx = rx0 + (rx1 - rx0) * f;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const t = (x + 0.5 - cx) / Math.max(0.5, rx);
      if (Math.abs(t) > 1.05) continue;
      p.put(x, cy, lit(ramp, -t * 0.9 + 0.1 - f * 0.2));
    }
  }
  // Tapa de arriba (hombros, cintura): una elipse aplanada más clara
  if (capRy > 0) p.ellipse(x0, y0, 1, 0, rx0, capRy, (x, y) => lit(ramp, 0.6 - (x + 0.5 - x0) / rx0 * 0.4 - (y + 0.5 - y0) * 0.2));
}

/** Esfera (cabeza): luz arriba a la izquierda */
export function sphere(p: Pixels, cx: number, cy: number, r: number, ramp: readonly number[], keep?: (x: number, y: number) => boolean): void {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r;
      if (dx * dx + dy * dy > 1.05) continue;
      if (keep && !keep(x, y)) continue;
      p.put(x, y, lit(ramp, -dx * 0.7 - dy * 0.6 + 0.15));
    }
  }
}

/** Triángulo relleno (con color por píxel) */
export function tri(p: Pixels, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: (x: number, y: number) => number): void {
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(d) < 1e-6) return;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d;
    const w2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d;
    if (w1 >= 0 && w2 >= 0 && 1 - w1 - w2 >= 0) p.put(x, y, col(x, y));
  }
}
