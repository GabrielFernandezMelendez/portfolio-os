import { Container, Graphics } from 'pixi.js';

/** Cuánto dura el rayo y el destello (ms reales) */
const BOLT_MS = 450;
const FLASH_MS = 220;
const FLASH_ALPHA = 0.45;
const CORE = 0xffffff;
const GLOW = 0x9ab8ff;

interface Bolt { readonly g: Graphics; life: number }

/**
 * Rayos de la tormenta eléctrica: un tronco quebrado que baja del cielo hasta el punto donde cae, con ramas que
 * se abren y se apagan antes de tocar el suelo, y un destello blanco en toda la pantalla.
 * `view` va dentro del mundo (se mueve con la cámara); `flash`, encima de todo en coordenadas de pantalla.
 */
export class Lightning {
  readonly view = new Container();
  readonly flash = new Graphics();
  private readonly bolts: Bolt[] = [];
  private flashLife = 0;

  constructor() {
    this.flash.alpha = 0;
  }

  /** Cae un rayo en este punto del mundo */
  strike(x: number, y: number): void {
    const g = new Graphics();
    const main = path(x + 18, y - 150, x, y, 10);
    const branches: [number, number][][] = [];
    for (let b = 0; b < 3; b++) {
      const i = 2 + b * 2;
      if (i >= main.length - 2) break;
      const [bx, by] = main[i];
      const side = b % 2 ? -1 : 1;
      branches.push(path(bx, by, bx + side * (22 + b * 8), by + 26 + b * 6, 4));
    }
    for (const [pts, width] of [[main, 3], ...branches.map(p => [p, 2] as const)] as const) draw(g, pts, width + 1, GLOW);
    for (const pts of [main, ...branches]) draw(g, pts, 1, CORE);
    this.view.addChild(g);
    this.bolts.push({ g, life: BOLT_MS });
    this.flashLife = FLASH_MS;
  }

  /** Tamaño de la pantalla (para el destello) */
  resize(w: number, h: number): void {
    this.flash.clear().rect(0, 0, w, h).fill(0xffffff);
  }

  update(dtMs: number): void {
    for (let n = this.bolts.length - 1; n >= 0; n--) {
      const b = this.bolts[n];
      b.life -= dtMs;
      // Parpadea un par de veces antes de apagarse
      b.g.alpha = b.life > BOLT_MS * 0.6 ? 1 : b.life > BOLT_MS * 0.45 ? 0.2 : b.life > 0 ? 0.8 * (b.life / (BOLT_MS * 0.45)) : 0;
      if (b.life <= 0) {
        b.g.destroy();
        this.bolts.splice(n, 1);
      }
    }
    this.flashLife = Math.max(0, this.flashLife - dtMs);
    this.flash.alpha = FLASH_ALPHA * (this.flashLife / FLASH_MS);
  }

  destroy(): void {
    for (const b of this.bolts) b.g.destroy();
    this.view.destroy({ children: true });
    this.flash.destroy();
  }
}

/** Línea quebrada de (x0, y0) a (x1, y1) en `steps` tramos */
function path(x0: number, y0: number, x1: number, y1: number, steps: number): [number, number][] {
  const pts: [number, number][] = [[Math.round(x0), Math.round(y0)]];
  let x = x0, y = y0;
  for (let n = 1; n <= steps; n++) {
    const left = steps - n + 1;
    x += (x1 - x) / left + (n < steps ? (Math.random() - 0.5) * 12 : 0);
    y += (y1 - y) / left;
    pts.push([Math.round(x), Math.round(y)]);
  }
  return pts;
}

function draw(g: Graphics, pts: readonly [number, number][], width: number, color: number): void {
  g.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
  g.stroke({ width, color, cap: 'round', join: 'round' });
}
