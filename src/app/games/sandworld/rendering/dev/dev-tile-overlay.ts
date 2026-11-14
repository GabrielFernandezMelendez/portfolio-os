import { Container, Graphics, Text } from 'pixi.js';
import { World } from '../../application/world/world';
import { WORLD } from '../../domain/models/world.model';
import { cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { isoToWorld } from '../iso';
import { BiomeId } from '../../domain/models/biome.model';
import { BIOME_BY_ID } from '../../config/biomes.config';
import { TERRAIN_RAMPS } from '../../config/palette.config';

/** Qué muestra la capa de desarrollo */
export type DevTileView = 'values' | 'biomes';

/** Abreviatura de cada bioma en la capa de desarrollo */
const BIOME_SHORT: Readonly<Record<string, string>> = {
  forest: 'BOS', desert: 'DES', tundra: 'TUN', wetland: 'HUM', swamp: 'PAN', rockland: 'ROQ', burnt: 'QUE', glade: 'CLA',
};
const RAMPS = TERRAIN_RAMPS as unknown as Record<string, readonly number[]>;

/** Cada cuánto se vuelve a dibujar mientras está visible (los valores cambian poco a poco) */
const REFRESH_MS = 500;
const ESSENCE = 0x9b6ad6;
const AFFINITY = 0xf08bc4;

/**
 * Herramienta de desarrollo (no es para el jugador). Dos vistas:
 * - 'values': esencia (mitad izquierda, morado) y afinidad (mitad derecha, rosa) de cada tile, con su número.
 *   Sirve para comprobar dónde caen Despertar y Afinidad mientras esos valores no tienen uso en el juego.
 * - 'biomes': el bioma de cada tile con su color y su abreviatura, y los días que lleva tendiendo a otro.
 */
export class DevTileOverlay {
  readonly view = new Container();
  private readonly shapes = new Graphics();
  private readonly labels = new Container();
  private elapsed = REFRESH_MS;
  private mode: DevTileView | null = null;

  constructor(private readonly world: World) {
    this.view.zIndex = 9_000;
    this.view.visible = false;
    this.view.addChild(this.shapes, this.labels);
  }

  /** Muestra una vista, o ninguna con null */
  show(mode: DevTileView | null): void {
    this.mode = mode;
    this.view.visible = mode !== null;
    this.elapsed = REFRESH_MS;
  }

  update(dtMs: number): void {
    if (!this.view.visible) return;
    this.elapsed += dtMs;
    if (this.elapsed < REFRESH_MS) return;
    this.elapsed = 0;
    this.redraw();
  }

  private redraw(): void {
    const g = this.shapes.clear();
    for (const t of this.labels.removeChildren()) t.destroy();
    const N = WORLD.TILES, G = WORLD.CELLS_PER_TILE;
    const hw = WORLD.TILE_W / 2, hh = WORLD.TILE_H / 2;
    for (const { cx, cy } of this.world.exploration.list()) {
      const c = this.world.chunk(cx, cy);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const t = tileIndex(i, j);
          const e = c.essence[t], a = c.affinity[t];
          const level = groundAt(c, cellIndex(i * G + G / 2, j * G + G / 2));
          const p = isoToWorld(cx * N + i, cy * N + j, level);
          if (this.mode === 'biomes') {
            const def = BIOME_BY_ID[c.biome[t] as BiomeId];
            g.poly([p.x, p.y - hh, p.x + hw, p.y, p.x, p.y + hh, p.x - hw, p.y])
              .fill({ color: RAMPS[def.ramp][2], alpha: 0.75 })
              .stroke({ width: 0.5, color: 0xffffff, alpha: 0.5 });
            const next = c.biomeNext[t] !== c.biome[t] && c.biomeTimer[t] > 0
              ? `→${BIOME_SHORT[BIOME_BY_ID[c.biomeNext[t] as BiomeId].key]} ${c.biomeTimer[t].toFixed(1)}d` : '';
            this.label(`${BIOME_SHORT[def.key]}${next ? '\n' + next : ''}`, p.x, p.y);
            continue;
          }
          // Rombo del tile partido en dos: izquierda esencia, derecha afinidad
          g.poly([p.x, p.y - hh, p.x, p.y + hh, p.x - hw, p.y]).fill({ color: ESSENCE, alpha: 0.08 + e * 0.7 });
          g.poly([p.x, p.y - hh, p.x + hw, p.y, p.x, p.y + hh]).fill({ color: AFFINITY, alpha: 0.08 + a * 0.7 });
          g.poly([p.x, p.y - hh, p.x + hw, p.y, p.x, p.y + hh, p.x - hw, p.y]).stroke({ width: 0.5, color: 0xffffff, alpha: 0.35 });
          if (e > 0.005 || a > 0.005) this.label(`${Math.round(e * 100)}/${Math.round(a * 100)}`, p.x, p.y);
        }
      }
    }
  }

  private label(text: string, x: number, y: number): void {
    const label = new Text({
      text,
      style: { fontFamily: 'monospace', fontSize: 14, fill: 0xffffff, stroke: { color: 0x2e1a0d, width: 3 }, align: 'center' },
    });
    label.scale.set(0.4);
    label.anchor.set(0.5);
    label.position.set(x, y);
    this.labels.addChild(label);
  }
}
