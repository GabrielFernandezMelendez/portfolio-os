/*
  Cámara 2D del mundo. Solo matemáticas: no conoce Pixi.
  El runtime lee `scale`, `offsetX` y `offsetY` en cada frame y se los aplica al contenedor del mundo.

  Estado: el punto del mundo que queda en el centro de la pantalla (cx, cy) y la escala.
  El zoom va por niveles fijos para que el pixel art no se deforme; el cambio entre niveles se anima
  manteniendo fijo el punto que hay bajo el dedo o el cursor.
*/

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Niveles de zoom. Desde ×2 se ven los animales (por debajo, monedas). ×0,5 y ×0,33 son para ver la isla entera
 * (crece por parcelas: un 6×6 a ×1 son unas cinco pantallas de ancho).
 */
export const ZOOM_LEVELS = [1 / 3, 0.5, 1, 1.5, 2, 3, 4, 6] as const;
/** Zoom al empezar y el más lejano al que encaja `fit()` (alejarse más es cosa del jugador) */
const FIT_FROM = ZOOM_LEVELS.indexOf(1);

/** Margen lateral al encajar el mundo en pantalla */
const FIT_MARGIN = 24;
/** Velocidad del scroll por bordes, en píxeles de pantalla por milisegundo */
const EDGE_SPEED = 0.45;
/** Constantes de tiempo (ms) de la animación de zoom y del frenado de la inercia */
const ZOOM_TAU = 70;
const FRICTION_TAU = 220;
const GLIDE_TAU = 380;

export class Camera {
  cx = 0;
  cy = 0;
  scale: number = ZOOM_LEVELS[FIT_FROM];

  private zoomIndex = FIT_FROM;
  private targetScale: number = ZOOM_LEVELS[FIT_FROM];
  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private vx = 0;   // inercia, en unidades de mundo por ms
  private vy = 0;
  private vw = 1;
  private vh = 1;
  private bounds: Rect = { x: -1, y: -1, w: 2, h: 2 };
  private glide: { x: number; y: number } | null = null;

  get zoomLevel(): number {
    return this.zoomIndex;
  }

  /** Desplazamiento del contenedor del mundo, redondeado a píxel entero */
  get offsetX(): number {
    return Math.round(this.vw / 2 - this.cx * this.scale);
  }

  get offsetY(): number {
    return Math.round(this.vh / 2 - this.cy * this.scale);
  }

  setViewport(width: number, height: number): void {
    this.vw = Math.max(1, width);
    this.vh = Math.max(1, height);
    this.clamp();
  }

  setBounds(rect: Rect): void {
    this.bounds = rect;
    this.clamp();
  }

  /** Mayor nivel de zoom con el que el mundo entra a lo ancho, centrado (desde ×1: si no entra, ×1) */
  fit(): void {
    let index = FIT_FROM;
    for (let i = FIT_FROM; i < ZOOM_LEVELS.length; i++) {
      if (ZOOM_LEVELS[i] * this.bounds.w <= this.vw - FIT_MARGIN) index = i;
    }
    this.zoomIndex = index;
    this.scale = this.targetScale = ZOOM_LEVELS[index];
    this.anchor = null;
    this.vx = this.vy = 0;
    this.cx = this.bounds.x + this.bounds.w / 2;
    this.cy = this.bounds.y + this.bounds.h / 2;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  /** Alto de la pantalla (px) */
  get viewportHeight(): number {
    return this.vh;
  }

  /** ¿Se ve algo de este rectángulo de mundo en pantalla? (con un margen en px de pantalla) */
  sees(r: { x: number; y: number; w: number; h: number }, margin = 0): boolean {
    const x0 = r.x * this.scale + this.offsetX, y0 = r.y * this.scale + this.offsetY;
    return x0 + r.w * this.scale > -margin && y0 + r.h * this.scale > -margin && x0 < this.vw + margin && y0 < this.vh + margin;
  }

  /** Desliza la cámara con suavidad hasta centrar (x, y). El jugador la interrumpe al arrastrar. */
  glideTo(x: number, y: number): void {
    this.glide = { x, y };
  }

  /** Arrastre: mueve la cámara tantos píxeles de pantalla como se ha movido el dedo */
  panBy(dsx: number, dsy: number): void {
    this.glide = null;
    this.cx -= dsx / this.scale;
    this.cy -= dsy / this.scale;
    this.vx = this.vy = 0;
    this.clamp();
  }

  /** Al soltar el arrastre: la cámara sigue deslizándose con la velocidad del dedo (px de pantalla por ms) */
  fling(vsx: number, vsy: number): void {
    this.vx = -vsx / this.scale;
    this.vy = -vsy / this.scale;
  }

  /** Sube (+1) o baja (-1) un nivel de zoom manteniendo fijo el punto de pantalla (sx, sy) */
  zoomStep(direction: 1 | -1, sx: number, sy: number): void {
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, this.zoomIndex + direction));
    if (next === this.zoomIndex) return;
    // El ancla se toma con la escala actual (aunque esté a mitad de animación)
    const w = this.screenToWorld(sx, sy);
    this.anchor = { sx, sy, wx: w.x, wy: w.y };
    this.zoomIndex = next;
    this.targetScale = ZOOM_LEVELS[next];
    this.vx = this.vy = 0;
  }

  /** Avanza animaciones. `edge` es la dirección del scroll por bordes (-1..1 en cada eje). */
  update(dtMs: number, edge: { x: number; y: number } = { x: 0, y: 0 }): void {
    if (this.scale !== this.targetScale) {
      this.scale += (this.targetScale - this.scale) * (1 - Math.exp(-dtMs / ZOOM_TAU));
      if (Math.abs(this.targetScale - this.scale) < 0.003) this.scale = this.targetScale;
      if (this.anchor) {
        this.cx = this.anchor.wx - (this.anchor.sx - this.vw / 2) / this.scale;
        this.cy = this.anchor.wy - (this.anchor.sy - this.vh / 2) / this.scale;
      }
    } else {
      this.anchor = null;
    }

    if (this.vx !== 0 || this.vy !== 0) {
      this.cx += this.vx * dtMs;
      this.cy += this.vy * dtMs;
      const f = Math.exp(-dtMs / FRICTION_TAU);
      this.vx *= f;
      this.vy *= f;
      if (Math.hypot(this.vx, this.vy) * this.scale < 0.01) this.vx = this.vy = 0;
    }

    if (this.glide) {
      const k = 1 - Math.exp(-dtMs / GLIDE_TAU);
      this.cx += (this.glide.x - this.cx) * k;
      this.cy += (this.glide.y - this.cy) * k;
      if (Math.hypot(this.glide.x - this.cx, this.glide.y - this.cy) * this.scale < 0.5) this.glide = null;
    }

    if (edge.x !== 0 || edge.y !== 0) {
      this.cx += (edge.x * EDGE_SPEED * dtMs) / this.scale;
      this.cy += (edge.y * EDGE_SPEED * dtMs) / this.scale;
    }

    this.clamp();
  }

  /** El centro de la pantalla nunca sale del rectángulo del mundo */
  private clamp(): void {
    const b = this.bounds;
    this.cx = Math.min(b.x + b.w, Math.max(b.x, this.cx));
    this.cy = Math.min(b.y + b.h, Math.max(b.y, this.cy));
  }
}
