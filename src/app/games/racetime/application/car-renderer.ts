import { CarState, CarConfig, CarColors } from '../domain/car.model';
import { TrackGenerator } from './track-generator';

// Renders the car sprite, trail, and particles onto Canvas 2D.
// Cars face downward in the sprite, so we add PI to the tangent angle.

const PIXEL_SIZE = 3;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

export class CarRenderer {
  private particles: Particle[] = [];
  private trailPoints: TrailPoint[] = [];
  private glintFrame = 0;

  // Main render call — draws trail, car sprite, and particles
  render(
    ctx: CanvasRenderingContext2D,
    car: CarState,
    carConfig: CarConfig,
    track: TrackGenerator,
    dt: number,
  ): void {
    const info = track.getTrackInfo(car.distance);
    const pos = track.getRailPosition(car.distance, car.railPosition);

    this.updateTrail(car, pos, dt);
    this.updateParticles(car, pos, info.tangentAngle, dt);

    this.drawTrail(ctx, car.isGlued);
    this.drawSprite(ctx, pos.x, pos.y, info.tangentAngle, carConfig);
    this.drawParticles(ctx);

    this.glintFrame++;
  }

  // ── Sprite rendering ──

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    config: CarConfig,
  ): void {
    const { sprite, colors } = config;

    ctx.save();
    ctx.translate(x, y);
    // Rotate car to face forward along track (sprite faces up, track angle is horizontal)
    ctx.rotate(angle + Math.PI / 2);

    const offsetX = -(sprite.width * PIXEL_SIZE) / 2;
    const offsetY = -(sprite.height * PIXEL_SIZE) / 2;

    sprite.pixels.forEach((row, py) => {
      [...row].forEach((ch, px) => {
        if (ch === '.') return;

        const colorKey = sprite.colorMap[ch];
        if (!colorKey) return;

        let color = (colors as unknown as Record<string, string>)[colorKey] || '#ff00ff';
        
        // Left-side shading for depth
        const isLeftEdge = px <= 1 || (px <= 2 && py > 3 && py < 15);
        if (isLeftEdge && colorKey === 'body') {
          color = colors.bodyDark;
        }

        // Windshield glint animation
        if (ch === 'G') {
          const glintPos = Math.floor(this.glintFrame / 12) % 6;
          const localPx = px - 3;
          if (localPx >= 0 && localPx === glintPos) {
            color = colors.glassGlint;
          }
        }

        ctx.fillStyle = color;
        ctx.fillRect(offsetX + px * PIXEL_SIZE, offsetY + py * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      });
    });

    ctx.restore();
  }

  // ── Trail ──

  private updateTrail(car: CarState, pos: { x: number; y: number }, dt: number): void {
    if (car.speed > 40) {
      this.trailPoints.push({ x: pos.x, y: pos.y, life: 0.7 });
    }

    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      this.trailPoints[i].life -= dt * 2;
      if (this.trailPoints[i].life <= 0) {
        this.trailPoints.splice(i, 1);
      }
    }

    if (this.trailPoints.length > 80) {
      this.trailPoints.splice(0, this.trailPoints.length - 80);
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D, isGlued: boolean): void {
    for (let i = 1; i < this.trailPoints.length; i++) {
      const prev = this.trailPoints[i - 1];
      const curr = this.trailPoints[i];
      const alpha = curr.life * 0.55;

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = isGlued ? `rgba(78,205,196,${alpha})` : `rgba(255,107,53,${alpha})`;
      ctx.lineWidth = 2.8 * curr.life;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // ── Particles ──

  private updateParticles(
    car: CarState,
    pos: { x: number; y: number },
    angle: number,
    dt: number,
  ): void {
    // Spawn particles when accelerating
    if (car.isAccelerating && car.speed > 30) {
      if (Math.random() < Math.min(car.speed / 80, 4) * dt * 30) {
        this.spawnParticles(pos.x, pos.y, angle, 2, car.isGlued ? '#4ecdc4' : '#ff6b35', 0.8);
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    angle: number,
    count: number,
    color: string,
    spread: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = angle + Math.PI + (Math.random() - 0.5) * spread;
      const spd = 30 + Math.random() * 100;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 1,
        decay: 1.8 + Math.random() * 3,
        color,
        size: 1.8 + Math.random() * 3,
      });
    }

    if (this.particles.length > 100) {
      this.particles.splice(0, this.particles.length - 100);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
