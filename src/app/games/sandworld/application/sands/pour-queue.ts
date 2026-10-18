import { SAND_ORDER, SandId } from '../../domain/models/sand.model';
import { WORLD } from '../../domain/models/world.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { POUR_DAYS_MAX, POUR_DAYS_MIN, POUR_MERGE_EXTENSION } from '../../config/pour.config';
import { TerrainPhysics } from '../physics/terrain-physics';
import { TerrainGrid } from '../physics/terrain-grid';
import { SAND_EFFECTS } from './sand-effects';
import { Stroke } from './stroke';

const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
const MINUTES_PER_DAY = 1440;

/** Un vertido que se está asentando */
export interface Pour {
  readonly id: number;
  readonly sand: SandId;
  /** Cantidad que falta por aplicar en cada celda */
  readonly remaining: Map<number, number>;
  /** Cantidad total de cada celda (para repartir por minutos) */
  readonly total: Map<number, number>;
  duration: number;
  elapsed: number;
}

/** Aviso de vertido asentado: arena y celdas */
export interface SettledPour {
  readonly sand: SandId;
  readonly cells: readonly [number, number][];
}

/**
 * Cola de vertidos. Cada trazo se convierte en un vertido que dura de 1 a 2 días de juego (al azar)
 * y aplica su efecto poco a poco, minuto a minuto. La arena pendiente se ve como capa sin asentar
 * (chunk.pending). Si un trazo nuevo de la misma arena toca un tile de un vertido pendiente, se suman
 * y la duración se alarga un poco (amontonar arena no acelera el efecto).
 */
export class PourQueue {
  private readonly pours: Pour[] = [];
  private nextId = 1;

  constructor(
    private readonly physics: TerrainPhysics,
    private readonly random: RandomSource,
  ) {}

  get active(): readonly Pour[] {
    return this.pours;
  }

  /** Mientras el dedo vierte: muestra la arena como capa sin asentar (todavía no es un vertido) */
  preview(sand: SandId, cells: readonly [number, number, number][]): void {
    const index = SAND_ORDER.indexOf(sand) + 1;
    for (const [gx, gy, amount] of cells) {
      const cell = this.physics.grid.cell(gx, gy);
      if (!cell) continue;
      cell.chunk.pending[cell.k] += amount;
      cell.chunk.pendingSand[cell.k] = index;
    }
  }

  /** El dedo se levanta: el trazo pasa a la cola (la capa ya está puesta por preview) */
  commit(stroke: Stroke): Pour | null {
    const cells = [...stroke.cells].filter(([key]) => {
      const [gx, gy] = TerrainGrid.fromKey(key);
      return this.physics.grid.cell(gx, gy) !== null;
    });
    if (cells.length === 0) return null;

    // ¿Toca algún tile de un vertido pendiente de la misma arena? Entonces se suma a ese
    const tiles = new Set(cells.map(([key]) => tileKey(key)));
    const target = this.pours.find(p => p.sand === stroke.sand && [...p.total.keys()].some(k => tiles.has(tileKey(k))));
    if (target) {
      const before = sum(target.total);
      for (const [key, amount] of cells) {
        target.total.set(key, (target.total.get(key) ?? 0) + amount);
        target.remaining.set(key, (target.remaining.get(key) ?? 0) + amount);
      }
      const added = sum(new Map(cells));
      target.duration += (target.duration - target.elapsed) * POUR_MERGE_EXTENSION * (added / Math.max(before, added));
      return target;
    }

    const days = POUR_DAYS_MIN + this.random.next() * (POUR_DAYS_MAX - POUR_DAYS_MIN);
    const pour: Pour = {
      id: this.nextId++,
      sand: stroke.sand,
      remaining: new Map(cells),
      total: new Map(cells),
      duration: Math.round(days * MINUTES_PER_DAY),
      elapsed: 0,
    };
    this.pours.push(pour);
    return pour;
  }

  /** Un minuto de juego: cada vertido aplica su parte. Devuelve los vertidos que han terminado. */
  minute(): SettledPour[] {
    const settled: SettledPour[] = [];
    for (let i = this.pours.length - 1; i >= 0; i--) {
      const pour = this.pours[i];
      pour.elapsed++;
      const effect = SAND_EFFECTS[pour.sand];
      const last = pour.elapsed >= pour.duration;
      for (const [key, total] of pour.total) {
        const left = pour.remaining.get(key) ?? 0;
        if (left <= 0) continue;
        const step = last ? left : Math.min(left, total / pour.duration);
        pour.remaining.set(key, left - step);
        const [gx, gy] = TerrainGrid.fromKey(key);
        effect.apply(this.physics, gx, gy, step);
        const cell = this.physics.grid.cell(gx, gy);
        if (cell) {
          cell.chunk.pending[cell.k] = Math.max(0, cell.chunk.pending[cell.k] - step);
          if (cell.chunk.pending[cell.k] <= 1e-4) {
            cell.chunk.pending[cell.k] = 0;
            cell.chunk.pendingSand[cell.k] = 0;
          }
        }
      }
      if (last) {
        const cells = [...pour.total.keys()].map(k => TerrainGrid.fromKey(k));
        effect.settled?.(this.physics, cells);
        settled.push({ sand: pour.sand, cells });
        this.pours.splice(i, 1);
      }
    }
    return settled;
  }

  /** Chunks con vertidos en curso (para volver a dibujar su capa) */
  chunksWithPours(): Set<string> {
    const set = new Set<string>();
    for (const p of this.pours) {
      for (const key of p.total.keys()) {
        const [gx, gy] = TerrainGrid.fromKey(key);
        set.add(`${Math.floor(gx / C)},${Math.floor(gy / C)}`);
      }
    }
    return set;
  }
}

function tileKey(cellKey: number): string {
  const [gx, gy] = TerrainGrid.fromKey(cellKey);
  return `${Math.floor(gx / G)},${Math.floor(gy / G)}`;
}

function sum(map: Map<number, number>): number {
  let s = 0;
  for (const v of map.values()) s += v;
  return s;
}
