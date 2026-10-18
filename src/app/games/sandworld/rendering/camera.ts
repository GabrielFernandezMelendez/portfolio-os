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

/** Niveles de zoom. Desde ×3 se mostrarán todos los animales (LOD de la fase 4). */
export const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6] as const;

/** Margen lateral al encajar el mundo en pantalla */
const FIT_MARGIN = 24;
/** Velocidad del scroll por bordes, en píxeles de pantalla por milisegundo */
const EDGE_SPEED = 0.45;
/** Constantes de tiempo (ms) de la animación de zoom y del frenado de la inercia */
const ZOOM_TAU = 70;
const FRICTION_TAU = 220;

export class Camera {
  cx = 0;
  cy = 0;
  scale: number = ZOOM_LEVELS[0];

  private zoomIndex = 0;
  private targetScale: number = ZOOM_LEVELS[0];
  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private vx = 0;   // inercia, en unidades de mundo por ms
  private vy = 0;
  private vw = 1;
  private vh = 1;
  private bounds: Rect = { x: -1, y: -1, w: 2, h: 2 };

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

  /** Mayor nivel de zoom con el que el mundo entra a lo ancho, centrado */
  fit(): void {
    let index = 0;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
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

  /** Arrastre: mueve la cámara tantos píxeles de pantalla como se ha movido el dedo */
  panBy(dsx: number, dsy: number): void {
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
