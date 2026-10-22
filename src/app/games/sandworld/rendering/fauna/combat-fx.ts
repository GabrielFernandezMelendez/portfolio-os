import { Container, Sprite, Texture } from 'pixi.js';
import { COMBAT_FX } from '../../config/fauna-art.config';

/*
  Efectos del combate, solo dibujo (nunca cambian la simulación): gotas de sangre que saltan en arco y se quedan en
  el suelo, charco bajo los cadáveres de los que mueren luchando, rastro de gotas del que huye herido, polvo al
  embestir y, con la sangre desactivada, una chispa blanca en cada golpe. Cada mancha es un sprite de un píxel de
  mundo (textura blanca teñida): baratos, con tope de cuántos hay a la vez, y se borran con el tiempo de juego.
*/

interface Drop {
  readonly sprite: Sprite;
  readonly parent: Container;
  vx: number;
  vy: number;
  /** Altura del suelo (y de mundo) donde cae */
  readonly ground: number;
  readonly color: number;
}

interface Puff {
  readonly sprite: Sprite;
  readonly vx: number;
  ms: number;
  readonly life: number;
}

interface Stain {
  readonly sprite: Sprite;
  /** Minuto de juego en que cayó (se desvanece con el tiempo) */
  readonly at: number;
}

export class CombatFx {
  private readonly drops: Drop[] = [];
  private readonly puffs: Puff[] = [];
  private readonly stains: Stain[] = [];
  private readonly pools = new Map<number, Sprite[]>();

  /** Golpe: con sangre, gotas en arco hacia donde va el golpe; sin ella, una chispa blanca */
  hit(parent: Container, x: number, y: number, dir: number, blood: boolean, big: boolean): void {
    const F = COMBAT_FX;
    if (!blood) {
      for (const [ox, oy] of F.spark) this.puff(parent, x + ox, y - F.hitHeight + oy, 0xfff6c8, 0, F.sparkMs, y + 0.08);
      return;
    }
    const n = big ? F.drops[1] : F.drops[0];
    for (let k = 0; k < n; k++) {
      const color = F.blood[1 + (k % 2)];
      const sprite = this.pixel(parent, x, y - F.hitHeight, color, y + 0.08);
      this.drops.push({
        sprite, parent, color,
        vx: dir * (0.2 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.3,
        vy: -(0.6 + Math.random() * 0.6),
        ground: y + (Math.random() - 0.3) * 2,
      });
    }
  }

  /** Polvo a los pies (embestida, arrancar a correr) */
  dust(parent: Container, x: number, y: number, dir: number): void {
    const F = COMBAT_FX;
    for (let k = 0; k < F.dustPuffs; k++) {
      this.puff(parent, x + (Math.random() - 0.5) * 4, y - 0.5, F.dust, dir * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 0.3, F.dustMs, y + 0.07);
    }
  }

  /** Una gota en el suelo (rastro del que huye herido) */
  drip(parent: Container, x: number, y: number, now: number): void {
    this.stain(parent, x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.3), COMBAT_FX.blood[Math.random() < 0.5 ? 0 : 1], now);
  }

  /** Charco bajo un cadáver (se quita cuando desaparece el cadáver); `r`: medio ancho en px de mundo */
  pool(id: number, parent: Container, x: number, y: number, r: number, alpha: number): void {
    let p = this.pools.get(id);
    if (!p) {
      p = [];
      const F = COMBAT_FX;
      // Rombo aplanado de píxeles (2:1, como el suelo), oscuro por fuera y algo más claro en el centro
      for (let dy = -Math.ceil(r / 2); dy <= Math.ceil(r / 2); dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = (dx / r) ** 2 + (dy / (r / 2)) ** 2;
          if (d > 1 || (d > 0.7 && (dx * 7 + dy * 3) % 3 === 0)) continue;
          p.push(this.pixel(parent, x + dx, y + dy + 1, d < 0.35 ? F.blood[1] : F.blood[0], y - 2.5));
        }
      }
      this.pools.set(id, p);
    }
    for (const s of p) s.alpha = alpha;
  }

  /** Quita los charcos de los cadáveres que ya no están */
  keepPools(alive: ReadonlySet<number>): void {
    for (const [id, p] of this.pools) {
      if (alive.has(id)) continue;
      for (const s of p) s.destroy();
      this.pools.delete(id);
    }
  }

  /** Un frame: gotas en vuelo (caen y manchan), polvo que sube y se apaga, manchas viejas que se borran */
  update(dtMs: number, now: number): void {
    const F = COMBAT_FX;
    const k = Math.min(3, dtMs / 16.7);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.sprite.x += d.vx * k;
      d.sprite.y += d.vy * k;
      d.vy += F.gravity * k;
      if (d.sprite.y >= d.ground && d.vy > 0) {
        this.stain(d.parent, d.sprite.x, d.ground, d.color, now);
        d.sprite.destroy();
        this.drops.splice(i, 1);
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.ms += dtMs;
      p.sprite.x += p.vx * k;
      p.sprite.y -= 0.12 * k;
      p.sprite.alpha = Math.max(0, 1 - p.ms / p.life);
      if (p.ms >= p.life) {
        p.sprite.destroy();
        this.puffs.splice(i, 1);
      }
    }
    // Las manchas se borran con el tiempo de juego (y si hay demasiadas, las más viejas antes)
    while (this.stains.length > F.maxStains) this.stains.shift()!.sprite.destroy();
    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i];
      const age = (now - s.at) / F.stainMinutes;
      if (age >= 1) {
        s.sprite.destroy();
        this.stains.splice(i, 1);
      } else s.sprite.alpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
    }
  }

  /** Quita toda la sangre del suelo (al desactivarla en Ajustes) */
  clearBlood(): void {
    for (const s of this.stains) s.sprite.destroy();
    this.stains.length = 0;
    for (const d of this.drops) d.sprite.destroy();
    this.drops.length = 0;
    this.keepPools(new Set());
  }

  destroy(): void {
    this.clearBlood();
    for (const p of this.puffs) p.sprite.destroy();
    this.puffs.length = 0;
  }

  private stain(parent: Container, x: number, y: number, color: number, now: number): void {
    if (parent.destroyed) return;
    this.stains.push({ sprite: this.pixel(parent, x, y, color, y - 2.5), at: now });
  }

  private puff(parent: Container, x: number, y: number, color: number, vx: number, life: number, z: number): void {
    this.puffs.push({ sprite: this.pixel(parent, x, y, color, z), vx, ms: 0, life });
  }

  private pixel(parent: Container, x: number, y: number, color: number, z: number): Sprite {
    const s = new Sprite(Texture.WHITE);
    s.width = s.height = 1;
    s.tint = color;
    s.position.set(Math.round(x), Math.round(y));
    s.zIndex = z;
    parent.addChild(s);
    return s;
  }
}
