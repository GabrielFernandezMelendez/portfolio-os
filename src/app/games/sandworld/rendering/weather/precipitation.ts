import { Container, Sprite, Texture } from 'pixi.js';
import { PrecipitationLook } from '../../domain/models/weather.model';
import { TERRAIN_RAMPS } from '../../config/palette.config';

/** Gotas o copos en pantalla con intensidad 1 */
const MAX_PARTICLES = 420;
/** Gotas del mismo azul que el agua (los dos tonos claros de su rampa) */
const RAIN_COLORS = [TERRAIN_RAMPS.water[3], TERRAIN_RAMPS.water[4]] as const;
const SNOW_COLOR = 0xffffff;

interface Particle {
  sprite: Sprite;
  speed: number;
  drift: number;
  phase: number;
}

/**
 * Lluvia y nieve en píxeles sobre la pantalla (no sobre el mundo: no se mueven con la cámara).
 * Siempre los mismos sprites; la intensidad decide cuántos se ven.
 */
export class Precipitation {
  readonly view = new Container();
  private readonly particles: Particle[] = [];
  private look: PrecipitationLook = 'none';
  private width = 1;
  private height = 1;
  private seed = 7;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const sprite = new Sprite(Texture.WHITE);
      sprite.visible = false;
      this.view.addChild(sprite);
      this.particles.push({ sprite, speed: 0, drift: 0, phase: 0 });
    }
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  update(dtMs: number, look: PrecipitationLook, intensity: number): void {
    if (look !== this.look) {
      this.look = look;
      for (const p of this.particles) this.respawn(p, true);
    }
    const visible = look === 'none' ? 0 : Math.round(MAX_PARTICLES * Math.min(1, intensity));
    const dt = dtMs / 1000;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.sprite.visible = i < visible;
      if (!p.sprite.visible) continue;
      p.phase += dt;
      p.sprite.y += p.speed * dt;
      p.sprite.x += (look === 'snow' ? Math.sin(p.phase * 2) * 12 : p.drift) * dt;
      if (p.sprite.y > this.height) this.respawn(p, false);
    }
  }

  private respawn(p: Particle, anywhere: boolean): void {
    const s = p.sprite;
    const snow = this.look === 'snow';
    s.tint = snow ? SNOW_COLOR : RAIN_COLORS[this.rand() < 0.5 ? 0 : 1];
    s.alpha = snow ? 0.95 : 0.7 + this.rand() * 0.3;
    // Gotas: rayitas de 1×4 (o 1×6 las cercanas); copos: puntos de 2×2
    const near = this.rand() < 0.3;
    s.width = snow ? (near ? 3 : 2) : 1;
    s.height = snow ? (near ? 3 : 2) : near ? 8 : 5;
    p.speed = snow ? 30 + this.rand() * 25 : 260 + this.rand() * 120;
    p.drift = snow ? 0 : -25;
    p.phase = this.rand() * 6;
    s.x = Math.round(this.rand() * (this.width + 40));
    s.y = anywhere ? Math.round(this.rand() * this.height) : -s.height - this.rand() * 40;
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}
