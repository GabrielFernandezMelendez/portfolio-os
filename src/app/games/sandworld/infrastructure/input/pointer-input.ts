/*
  Adaptador de entrada del navegador (ratón, táctil y lápiz con Pointer Events).

  Gestos:
  - 1 dedo / clic izquierdo  → con una arena seleccionada: pincel (start, move, end; cancel si se convierte
                               en gesto de 2 dedos). Sin arena: arrastra la cámara, y un toque sin moverse señala la celda.
  - 2 dedos                  → arrastre de cámara + pellizco para zoom por niveles
  - botón derecho o central  → arrastre de cámara
  - rueda                    → zoom por niveles
  - ratón cerca del borde    → scroll por bordes (tras un instante, para no moverse al entrar en la app)
*/

export type BrushPhase = 'start' | 'move' | 'end' | 'cancel';

export interface InputHandlers {
  brush(phase: BrushPhase, x: number, y: number): void;
  hover(x: number, y: number): void;
  /** Toque corto sin arrastrar cuando el pincel está desactivado */
  tap(x: number, y: number): void;
  leave(): void;
  pan(dx: number, dy: number): void;
  /** Velocidad al soltar el arrastre, en px de pantalla por ms */
  fling(vx: number, vy: number): void;
  zoom(direction: 1 | -1, x: number, y: number): void;
}

/** El trazo de pincel no empieza hasta moverse esto o esperar BRUSH_DELAY_MS: da tiempo a poner el segundo dedo */
const BRUSH_SLOP_PX = 4;
/** Sin arena, un dedo que se mueve menos que esto sigue siendo un toque (los dedos tiemblan unos píxeles) */
const TAP_SLOP_PX = 10;
const BRUSH_DELAY_MS = 90;
/** Cambio de distancia entre dedos necesario para saltar un nivel de zoom */
const PINCH_STEP = 1.3;
/** Desplazamiento de rueda acumulado por nivel de zoom */
const WHEEL_STEP = 80;
/** Banda del borde que activa el scroll y espera antes de empezar */
const EDGE_BAND_PX = 28;
const EDGE_DWELL_MS = 350;

interface Tracked {
  x: number;
  y: number;
}

type Mode = 'idle' | 'brush-pending' | 'brush' | 'gesture' | 'mouse-pan' | 'drag-pan';

export class PointerInput {
  private readonly pointers = new Map<number, Tracked>();
  private mode: Mode = 'idle';

  private brushStart = { x: 0, y: 0, time: 0 };
  private brushTimer: ReturnType<typeof setTimeout> | null = null;

  private gestureMid = { x: 0, y: 0 };
  private pinchBase = 0;
  private velocity = { x: 0, y: 0, time: 0 };

  private wheelAcc = 0;
  private mouse: { x: number; y: number; inside: boolean; since: number } = { x: 0, y: 0, inside: false, since: 0 };

  private dragStart = { x: 0, y: 0 };
  private dragMoved = false;

  /**
   * @param brushEnabled se consulta en cada toque: true si hay una arena seleccionada (1 dedo = pincel),
   *                     false si no (1 dedo = mover la cámara)
   */
  constructor(
    private readonly el: HTMLElement,
    private readonly on: InputHandlers,
    private readonly brushEnabled: () => boolean = () => true,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.preventMenu);
  }

  destroy(): void {
    this.clearBrushTimer();
    const el = this.el;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.preventMenu);
  }

  /** Dirección del scroll por bordes (-1..1 por eje). Se consulta en cada frame. */
  /**
   * Mientras se vierte con el dedo cerca de un borde (banda de `band` px), la cámara se desplaza hacia ese lado
   * para poder seguir el trazo más allá de la pantalla. Fuera del pincel devuelve (0, 0).
   */
  brushEdgeVector(band: number): { x: number; y: number } {
    if (this.mode !== 'brush' || this.pointers.size !== 1) return { x: 0, y: 0 };
    const p = this.pointers.values().next().value!;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const axis = (v: number, size: number): number =>
      v < band ? -(1 - v / band) : v > size - band ? 1 - (size - v) / band : 0;
    return { x: axis(p.x, w), y: axis(p.y, h) };
  }

  edgeVector(now = performance.now()): { x: number; y: number } {
    const m = this.mouse;
    if (!m.inside || this.mode !== 'idle' || now - m.since < EDGE_DWELL_MS) return { x: 0, y: 0 };
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const axis = (p: number, size: number): number =>
      p < EDGE_BAND_PX ? -(1 - p / EDGE_BAND_PX) : p > size - EDGE_BAND_PX ? 1 - (size - p) / EDGE_BAND_PX : 0;
    return { x: axis(m.x, w), y: axis(m.y, h) };
  }

  // ── Eventos ──────────────────────────────────────────────────────

  private onDown = (e: PointerEvent): void => {
    const p = this.local(e);
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, p);

    // Ratón: derecho o central arrastran la cámara
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
      e.preventDefault();
      this.mode = 'mouse-pan';
      this.resetVelocity();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (this.pointers.size === 1 && !this.brushEnabled()) {
      this.mode = 'drag-pan';
      this.dragStart = { x: p.x, y: p.y };
      this.dragMoved = false;
      this.resetVelocity();
    } else if (this.pointers.size === 1) {
      this.mode = 'brush-pending';
      this.brushStart = { x: p.x, y: p.y, time: e.timeStamp };
      this.clearBrushTimer();
      this.brushTimer = setTimeout(() => this.beginBrush(), BRUSH_DELAY_MS);
    } else if (this.pointers.size === 2) {
      this.startGesture();
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.local(e);
    if (e.pointerType === 'mouse') this.trackMouse(p);

    const tracked = this.pointers.get(e.pointerId);
    if (!tracked) {
      if (e.pointerType === 'mouse') this.on.hover(p.x, p.y);
      return;
    }
    const prev = { x: tracked.x, y: tracked.y };
    tracked.x = p.x;
    tracked.y = p.y;

    switch (this.mode) {
      case 'brush-pending':
        if (Math.hypot(p.x - this.brushStart.x, p.y - this.brushStart.y) >= BRUSH_SLOP_PX) {
          this.beginBrush();
          this.on.brush('move', p.x, p.y);
        }
        break;
      case 'brush':
        this.on.brush('move', p.x, p.y);
        break;
      case 'drag-pan':
        // Hasta superar el umbral no se mueve nada: así un toque con algo de temblor sigue siendo un toque
        if (!this.dragMoved && Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) < TAP_SLOP_PX) break;
        this.dragMoved = true;
        this.on.pan(p.x - prev.x, p.y - prev.y);
        this.trackVelocity(p.x - prev.x, p.y - prev.y, e.timeStamp);
        break;
      case 'mouse-pan':
        this.on.pan(p.x - prev.x, p.y - prev.y);
        this.trackVelocity(p.x - prev.x, p.y - prev.y, e.timeStamp);
        break;
      case 'gesture':
        this.updateGesture(e.timeStamp);
        break;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);

    switch (this.mode) {
      case 'brush-pending':
        // Toque corto sin moverse: también es un trazo (un solo punto)
        this.beginBrush();
        this.on.brush('end', p.x, p.y);
        this.mode = 'idle';
        break;
      case 'brush':
        this.on.brush('end', p.x, p.y);
        this.mode = 'idle';
        break;
      case 'drag-pan':
        if (this.dragMoved) this.releasePan(e.timeStamp);
        else {
          this.on.tap(p.x, p.y);
          this.mode = 'idle';
        }
        break;
      case 'mouse-pan':
        this.releasePan(e.timeStamp);
        break;
      case 'gesture':
        if (this.pointers.size < 2) this.releasePan(e.timeStamp);
        break;
    }
    if (this.pointers.size === 0 && this.mode !== 'idle') this.mode = 'idle';
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'brush') this.on.brush('cancel', 0, 0);
    this.clearBrushTimer();
    if (this.pointers.size === 0) this.mode = 'idle';
  };

  private onLeave = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    this.mouse.inside = false;
    if (this.mode === 'idle') this.on.leave();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // deltaMode 1 = líneas (Firefox): se pasa a píxeles aproximados
    this.wheelAcc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(this.wheelAcc) < WHEEL_STEP) return;
    const p = this.local(e);
    this.on.zoom(this.wheelAcc < 0 ? 1 : -1, p.x, p.y);
    this.wheelAcc = 0;
  };

  private preventMenu = (e: Event): void => e.preventDefault();

  // ── Pincel ───────────────────────────────────────────────────────

  private beginBrush(): void {
    this.clearBrushTimer();
    if (this.mode !== 'brush-pending') return;
    this.mode = 'brush';
    this.on.brush('start', this.brushStart.x, this.brushStart.y);
  }

  private clearBrushTimer(): void {
    if (this.brushTimer !== null) {
      clearTimeout(this.brushTimer);
      this.brushTimer = null;
    }
  }

  // ── Dos dedos ────────────────────────────────────────────────────

  private startGesture(): void {
    this.clearBrushTimer();
    if (this.mode === 'brush') this.on.brush('cancel', 0, 0);
    this.mode = 'gesture';
    const [a, b] = this.firstTwo();
    this.gestureMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinchBase = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    this.resetVelocity();
  }

  private updateGesture(time: number): void {
    if (this.pointers.size < 2) return;
    const [a, b] = this.firstTwo();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = mid.x - this.gestureMid.x, dy = mid.y - this.gestureMid.y;
    this.gestureMid = mid;
    this.on.pan(dx, dy);
    this.trackVelocity(dx, dy, time);

    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = dist / this.pinchBase;
    if (ratio >= PINCH_STEP || ratio <= 1 / PINCH_STEP) {
      this.on.zoom(ratio > 1 ? 1 : -1, mid.x, mid.y);
      this.pinchBase = dist;
    }
  }

  private firstTwo(): [Tracked, Tracked] {
    const it = this.pointers.values();
    return [it.next().value as Tracked, it.next().value as Tracked];
  }

  // ── Inercia ──────────────────────────────────────────────────────

  private resetVelocity(): void {
    this.velocity = { x: 0, y: 0, time: performance.now() };
  }

  /** Media móvil de la velocidad del arrastre (px/ms) */
  private trackVelocity(dx: number, dy: number, time: number): void {
    const dt = Math.max(1, time - this.velocity.time);
    const k = 0.6;
    this.velocity.x = this.velocity.x * (1 - k) + (dx / dt) * k;
    this.velocity.y = this.velocity.y * (1 - k) + (dy / dt) * k;
    this.velocity.time = time;
  }

  private releasePan(time: number): void {
    // Si el dedo se quedó quieto antes de soltar, no hay inercia
    const still = time - this.velocity.time > 80;
    if (!still) this.on.fling(this.velocity.x, this.velocity.y);
    // Si queda un dedo apoyado no se reanuda el pincel: el gesto termina cuando se levantan todos
    this.mode = 'idle';
  }

  // ── Utilidades ───────────────────────────────────────────────────

  private trackMouse(p: Tracked): void {
    const nearEdge = (q: Tracked): boolean =>
      q.x < EDGE_BAND_PX || q.y < EDGE_BAND_PX ||
      q.x > this.el.clientWidth - EDGE_BAND_PX || q.y > this.el.clientHeight - EDGE_BAND_PX;
    // El contador de espera se reinicia cada vez que el ratón entra en la banda del borde
    if (!this.mouse.inside || (nearEdge(p) && !nearEdge(this.mouse))) this.mouse.since = performance.now();
    this.mouse = { x: p.x, y: p.y, inside: true, since: this.mouse.since };
  }

  private local(e: MouseEvent): Tracked {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
