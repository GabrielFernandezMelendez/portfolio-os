import { Container, Sprite, Texture } from 'pixi.js';
import { WORLD } from '../../domain/models/world.model';
import { isoToWorld } from '../iso';
import { hash2 } from '../../application/world/noise';
import { REVEAL_MS, REVEAL_RISE } from '../../config/clouds.config';

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number): number => t * t;
const span = (t: number, a: number, b: number): number => Math.min(1, Math.max(0, (t - a) / (b - a)));
/** Opacidad por escalones (0, ⅓, ⅔, 1): los fundidos suaves no casan con el pixel art */
const stepped = (v: number): number => Math.round(v * 3) / 3;

interface Puff {
  sprite: Sprite;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/**
 * Aparición de un chunk: el terreno sube desde el mar de nubes mientras el manto de nubes
 * que lo cubría se abre hacia fuera y se deshace. Da la impresión de que el terreno ya estaba ahí.
 *
 *   0 %──────30 %─────────────────────────100 %
 *   manto quieto │ las nubes se apartan y se deshacen
 *          │ 20 %: el terreno asoma y sube ──┤ 90 %
 *                 │ 35 %: la sombra aparece ────┤
 */
export class RevealEffect {
  readonly blanket = new Container();
  private readonly puffs: Puff[] = [];
  private elapsed = 0;
  private readonly baseY: number;

  constructor(
    cx: number,
    cy: number,
    private readonly terrain: Container,
    private readonly shadow: Sprite,
    puffTextures: readonly Texture[],
    seed: number,
  ) {
    this.baseY = terrain.y;
    this.blanket.zIndex = 10_000;

    // Manto de nubes: una rejilla G×G de copos grandes sobre el rombo del chunk, cada uno con su dirección de salida
    const N = WORLD.TILES;
    const G = 5;
    const center = isoToWorld(cx * N + N / 2 - 0.5, cy * N + N / 2 - 0.5);
    let i = 0;
    for (let j = 0; j < G; j++) {
      for (let k = 0; k < G; k++, i++) {
        const u = cx * N + (k + 0.5) * (N / G) - 0.5 + (hash2(i, 1, seed) - 0.5) * 0.8;
        const v = cy * N + (j + 0.5) * (N / G) - 0.5 + (hash2(i, 2, seed) - 0.5) * 0.8;
        const p = isoToWorld(u, v);
        const sprite = new Sprite(puffTextures[i % puffTextures.length]);
        sprite.anchor.set(0.5, 0.6);
        sprite.scale.set(2);
        sprite.position.set(Math.round(p.x), Math.round(p.y - 10));
        const ox = p.x - center.x, oy = p.y - center.y;
        const len = Math.hypot(ox, oy * 2) || 1;
        const dist = 70 + hash2(i, 3, seed) * 50;
        this.puffs.push({ sprite, x: p.x, y: p.y - 10, dx: (ox / len) * dist, dy: (oy / len) * dist * 0.5 - 18 });
        this.blanket.addChild(sprite);
      }
    }

    this.apply(0);
  }

  /** Devuelve true cuando termina */
  update(dtMs: number): boolean {
    this.elapsed = Math.min(REVEAL_MS, this.elapsed + dtMs);
    this.apply(this.elapsed / REVEAL_MS);
    return this.elapsed >= REVEAL_MS;
  }

  /** Salta al final (por ejemplo, si se destruye el runtime a mitad) */
  finish(): void {
    this.apply(1);
  }

  private apply(t: number): void {
    // Terreno: asoma y sube desde las nubes
    const rise = easeOut(span(t, 0.2, 0.9));
    this.terrain.y = this.baseY + Math.round((1 - rise) * REVEAL_RISE);
    this.terrain.alpha = stepped(span(t, 0.22, 0.5));

    // Sombra: aparece cuando la isla ya está arriba
    this.shadow.alpha = stepped(span(t, 0.35, 0.9));

    // Nubes: se apartan hacia fuera y hacia arriba, y se deshacen por escalones
    const open = easeIn(span(t, 0.3, 1));
    for (const p of this.puffs) {
      p.sprite.position.set(Math.round(p.x + p.dx * open), Math.round(p.y + p.dy * open));
      p.sprite.alpha = stepped(1 - span(t, 0.5, 0.95));
    }
  }
}
