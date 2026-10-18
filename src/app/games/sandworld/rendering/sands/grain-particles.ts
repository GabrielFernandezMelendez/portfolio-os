import { Container, Sprite, Texture } from 'pixi.js';

/** Granos que caen por segundo mientras el dedo vierte */
const GRAINS_PER_SECOND = 80;
/** Altura (px de mundo) desde la que caen */
const DROP_HEIGHT = 34;
const GRAVITY = 0.0009;   // px/ms²
const POOL = 160;

interface Grain {
  sprite: Sprite;
  x: number;
  y: number;
  vy: number;
  groundY: number;
  bounced: boolean;
  life: number;
}

/**
 * Granos de arena que caen sobre el terreno mientras se vierte (decorativo).
 * Usa siempre los mismos sprites (un grupo fijo): no crea objetos nuevos por grano.
 */
export class GrainParticles {
  readonly view = new Container();
  private readonly free: Sprite[] = [];
  private readonly live: Grain[] = [];
  private carry = 0;
  private seed = 1;

  constructor() {
    this.view.zIndex = 9_500;
    for (let i = 0; i < POOL; i++) {
      const s = new Sprite(Texture.WHITE);
      s.width = 1;
      s.height = 1;
      s.visible = false;
      this.view.addChild(s);
      this.free.push(s);
    }
  }

  /** Emite granos sobre un punto del mundo (la superficie de la zona donde cae la arena) */
  emit(x: number, groundY: number, color: number, dtMs: number): void {
    this.carry += (GRAINS_PER_SECOND * dtMs) / 1000;
    while (this.carry >= 1 && this.free.length) {
      this.carry -= 1;
      const s = this.free.pop()!;
      // Mezcla de granos claros y oscuros para que el chorro se lea sobre cualquier suelo (también sobre arena)
      const r = this.rand();
      s.tint = r < 0.2 ? 0xffffff : r < 0.55 ? darken(color, 0.4) : color;
      const big = this.rand() < 0.45;
      s.width = big ? 2 : 1;
      s.height = 2;
      s.alpha = 1;
      s.visible = true;
      const gx = x + Math.round((this.rand() - 0.5) * 8);
      const gy = groundY + Math.round((this.rand() - 0.5) * 6);
      this.live.push({ sprite: s, x: gx, y: gy - DROP_HEIGHT - this.rand() * 10, vy: 0.02, groundY: gy, bounced: false, life: 0 });
    }
    if (this.carry > 3) this.carry = 3;
  }

  update(dtMs: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      g.life += dtMs;
      g.vy += GRAVITY * dtMs;
      g.y += g.vy * dtMs;
      if (g.y >= g.groundY) {
        if (!g.bounced) {
          // Pequeño rebote al tocar el suelo
          g.bounced = true;
          g.y = g.groundY;
          g.vy = -0.06;
          g.x += this.rand() < 0.5 ? -1 : 1;
        } else {
          g.sprite.visible = false;
          this.free.push(g.sprite);
          this.live.splice(i, 1);
          continue;
        }
      }
      g.sprite.position.set(Math.round(g.x), Math.round(g.y));
    }
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}

/** Oscurece un color 0xRRGGBB una fracción */
function darken(c: number, f: number): number {
  const k = 1 - f;
  return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
}
