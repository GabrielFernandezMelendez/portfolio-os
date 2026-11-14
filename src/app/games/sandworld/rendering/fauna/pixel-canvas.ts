/*
  Lienzo de píxeles para dibujar animales por código (común a todas las especies): elipses orientadas, líneas,
  contorno de 1 px y capas. Puro: colores 0xRRGGBB por píxel (-1 = transparente), sin Pixi.
*/

export class Pixels {
  readonly px: Int32Array;

  constructor(readonly w: number, readonly h: number) {
    this.px = new Int32Array(w * h).fill(-1);
  }

  put(x: number, y: number, c: number): void {
    const ix = Math.trunc(x), iy = Math.trunc(y);
    if (ix >= 0 && ix < this.w && iy >= 0 && iy < this.h) this.px[iy * this.w + ix] = c;
  }

  /** Elipse orientada a lo largo de (ux, uy): semieje `a` en esa dirección y `b` en la perpendicular */
  ellipse(cx: number, cy: number, ux: number, uy: number, a: number, b: number, shade: (x: number, y: number, d: number) => number): void {
    const vx = -uy, vy = ux;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
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

  /** Contorno de 1 px del color `outline` alrededor de lo pintado (solo por los 4 lados) */
  outlined(outline: number): Int32Array {
    const { w, h, px } = this;
    const out = px.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[y * w + x] >= 0) continue;
        const near = (x > 0 && px[y * w + x - 1] >= 0) || (x < w - 1 && px[y * w + x + 1] >= 0) ||
          (y > 0 && px[(y - 1) * w + x] >= 0) || (y < h - 1 && px[(y + 1) * w + x] >= 0);
        if (near) out[y * w + x] = outline;
      }
    }
    return out;
  }
}

/** Pone `top` encima de `base` (los transparentes de `top` dejan ver `base`) */
export function over(base: Int32Array, top: Int32Array): Int32Array {
  const out = base.slice();
  for (let k = 0; k < out.length; k++) if (top[k] >= 0) out[k] = top[k];
  return out;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
