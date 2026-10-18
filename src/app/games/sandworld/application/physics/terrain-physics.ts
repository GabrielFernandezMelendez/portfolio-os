import { MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { ChunkCoord } from '../../domain/events/game-events';
import { LANDSLIDE_PASSES_PER_MINUTE, MAX_GROUND } from '../../config/physics.config';
import { World } from '../world/world';
import { TerrainGrid } from './terrain-grid';
import { LandslideSystem } from './landslides';
import { WaterOptions, WaterSystem } from './water';

/**
 * Física del terreno de la partida. Avanza con el tiempo de juego (se para en pausa
 * y va más rápido a x2/x4 porque recibe más minutos).
 * Bloque 1: desprendimientos. Bloque 2: agua y reglas de material. Bloque 3: vertidos.
 */
export class TerrainPhysics {
  readonly grid: TerrainGrid;
  readonly water: WaterSystem;
  private readonly landslides: LandslideSystem;

  constructor(private readonly world: World, waterOptions?: WaterOptions) {
    this.grid = new TerrainGrid(world);
    this.landslides = new LandslideSystem(this.grid);
    this.water = new WaterSystem(this.grid, waterOptions);
    // Si cambia la altura de una celda, su agua y la de alrededor vuelven a moverse
    this.grid.onHeightChange = (gx, gy) => this.water.wake(gx, gy);
    for (const { cx, cy } of world.exploration.list()) this.water.addChunk(world.chunk(cx, cy));
  }

  /** Un chunk recién descubierto entra en la física */
  chunkRevealed(cx: number, cy: number): void {
    this.water.addChunk(this.world.chunk(cx, cy));
  }

  /** Celdas que todavía se están asentando (útil para tests y depuración) */
  get settling(): number {
    return this.landslides.activeCount;
  }

  /** Un minuto de juego. Devuelve los chunks que han cambiado (para volver a hornearlos). */
  minute(): ChunkCoord[] {
    const changed = new Set<string>();
    for (let i = 0; i < LANDSLIDE_PASSES_PER_MINUTE; i++) this.landslides.step(changed);
    this.water.minute(changed);
    // Material cambiado por una regla (p. ej. barro, de talud bajo): puede volver a deslizarse
    for (const [gx, gy] of this.water.transformed.splice(0)) {
      this.landslides.wake(gx, gy);
      changed.add(`${Math.floor(gx / WORLD.CELLS)},${Math.floor(gy / WORLD.CELLS)}`);
    }
    return [...changed].map(k => {
      const [cx, cy] = k.split(',').map(Number);
      return { cx, cy };
    });
  }

  /**
   * Añade `amount` niveles de material en la celda global (gx, gy) y despierta los desprendimientos.
   * Devuelve lo que se ha depositado de verdad (el terreno tiene un techo de altura).
   */
  deposit(gx: number, gy: number, material: MaterialId, amount: number): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell || amount <= 0) return 0;
    const room = Math.max(0, MAX_GROUND - this.grid.ground(cell));
    const added = Math.min(room, amount);
    this.grid.setSediment(cell, cell.chunk.sediment[cell.k] + added);
    cell.chunk.material[cell.k] = material;
    this.landslides.wake(gx, gy);
    return added;
  }

  /** Añade agua en la celda global (gx, gy) (o la quita, con cantidad negativa) */
  addWater(gx: number, gy: number, amount: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    cell.chunk.water[cell.k] = Math.max(0, cell.chunk.water[cell.k] + amount);
    this.water.wake(gx, gy);
  }

  /** Pone (o quita, con rate 0) un manantial en la celda global (gx, gy) */
  setSpring(gx: number, gy: number, rate: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    cell.chunk.spring[cell.k] = Math.max(0, rate);
    this.water.wake(gx, gy);
  }

  /** Quita hasta `amount` niveles de sedimento (Marea). Devuelve lo que se ha quitado. */
  dig(gx: number, gy: number, amount: number): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell || amount <= 0) return 0;
    const removed = Math.min(cell.chunk.sediment[cell.k], amount);
    this.grid.setSediment(cell, cell.chunk.sediment[cell.k] - removed);
    this.landslides.wake(gx, gy);
    return removed;
  }

  /** Coordenadas globales de celda a partir de chunk + celda local */
  static global(cx: number, cy: number, ci: number, cj: number): [number, number] {
    return [cx * WORLD.CELLS + ci, cy * WORLD.CELLS + cj];
  }
}
