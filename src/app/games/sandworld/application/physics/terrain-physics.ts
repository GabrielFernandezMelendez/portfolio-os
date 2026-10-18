import { Material, MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { ChunkCoord } from '../../domain/events/game-events';
import { LANDSLIDE_PASSES_PER_MINUTE, MAX_GROUND } from '../../config/physics.config';
import { World } from '../world/world';
import { TerrainGrid } from './terrain-grid';
import { LandslideSystem } from './landslides';
import { SpringChange, WaterOptions, WaterSystem } from './water';
import { ThermalSystem } from './thermal';

/**
 * Física del terreno de la partida. Avanza con el tiempo de juego (se para en pausa
 * y va más rápido a x2/x4 porque recibe más minutos).
 * Bloque 1: desprendimientos. Bloque 2: agua y reglas de material. Bloque 3: vertidos.
 * Bloque 4: frío y calor (nieve, hielo, calor de la Brasa) y manantiales que se tapan.
 */
export class TerrainPhysics {
  readonly grid: TerrainGrid;
  readonly water: WaterSystem;
  readonly thermal: ThermalSystem;
  private readonly landslides: LandslideSystem;

  constructor(private readonly world: World, waterOptions?: WaterOptions) {
    this.grid = new TerrainGrid(world);
    this.landslides = new LandslideSystem(this.grid);
    this.water = new WaterSystem(this.grid, waterOptions);
    this.thermal = new ThermalSystem(this.grid, (gx, gy, water) => this.addWater(gx, gy, water));
    // Si cambia la altura de una celda, su agua y la de alrededor vuelven a moverse
    this.grid.onHeightChange = (gx, gy) => this.water.wake(gx, gy);
    for (const { cx, cy } of world.exploration.list()) {
      this.water.addChunk(world.chunk(cx, cy));
      this.thermal.addChunk(world.chunk(cx, cy));
    }
  }

  /** Un chunk recién descubierto entra en la física */
  chunkRevealed(cx: number, cy: number): void {
    this.water.addChunk(this.world.chunk(cx, cy));
    this.thermal.addChunk(this.world.chunk(cx, cy));
  }

  /** Manantiales que se han tapado o abierto desde la última llamada (se vacía al leerla) */
  takeSpringChanges(): SpringChange[] {
    return this.water.springChanges.splice(0);
  }

  /** Celdas que todavía se están asentando (útil para tests y depuración) */
  get settling(): number {
    return this.landslides.activeCount;
  }

  /** Un minuto de juego. Devuelve los chunks que han cambiado (para volver a hornearlos). */
  minute(): ChunkCoord[] {
    const changed = new Set<string>();
    for (let i = 0; i < LANDSLIDE_PASSES_PER_MINUTE; i++) this.landslides.step(changed);
    this.thermal.minute(changed);
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

  /**
   * Pone (o quita, con rate 0) un manantial en la celda global (gx, gy).
   * Un manantial nuevo recuerda la altura del terreno: si se entierra por encima, deja de manar.
   */
  setSpring(gx: number, gy: number, rate: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    if (cell.chunk.spring[cell.k] <= 0) cell.chunk.springBase[cell.k] = this.grid.ground(cell) - cell.chunk.cover[cell.k];
    cell.chunk.spring[cell.k] = Math.max(0, rate);
    this.water.wake(gx, gy);
  }

  /** Quita hasta `amount` niveles de capa helada y luego de sedimento (Marea). Devuelve lo que se ha quitado. */
  dig(gx: number, gy: number, amount: number): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell || amount <= 0) return 0;
    const fromCover = Math.min(cell.chunk.cover[cell.k], amount);
    if (fromCover > 0) this.grid.setCover(cell, cell.chunk.cover[cell.k] - fromCover);
    const removed = Math.min(cell.chunk.sediment[cell.k], amount - fromCover);
    if (removed > 0) this.grid.setSediment(cell, cell.chunk.sediment[cell.k] - removed);
    this.landslides.wake(gx, gy);
    // Excavar alrededor también hace que se deslice lo de las vecinas hacia el hoyo
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.landslides.wake(gx + dx, gy + dy);
    return fromCover + removed;
  }

  /** Escarcha: nieve encima y el agua de la celda (hasta `freeze` niveles) se congela en hielo */
  freeze(gx: number, gy: number, snow: number, freeze: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    const frozen = Math.min(cell.chunk.water[cell.k], freeze);
    if (frozen > 0) {
      cell.chunk.water[cell.k] -= frozen;
      this.thermal.addCover(gx, gy, Material.ICE, frozen);
    }
    if (snow > 0) this.thermal.addCover(gx, gy, Material.SNOW, snow);
  }

  /**
   * Brasa: evapora el agua, seca el suelo (y el barro), funde lo helado y acumula calor.
   * Devuelve true si el calor acumulado ha calcinado el suelo en este paso.
   */
  scorch(gx: number, gy: number, opts: { evaporate: number; dry: number; melt: number; heat: number; ash: number; charAt: number }): boolean {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return false;
    const c = cell.chunk, k = cell.k;
    c.water[k] = Math.max(0, c.water[k] - opts.evaporate);
    c.moisture[k] = Math.max(0, c.moisture[k] - opts.dry);
    if (c.material[k] === Material.MUD && c.moisture[k] < 0.3) c.material[k] = Material.SOIL;
    // Lo que se funde se evapora con el calor (no se suma agua)
    const melted = Math.min(c.cover[k], opts.melt);
    if (melted > 0) this.grid.setCover(cell, c.cover[k] - melted);
    const before = c.heat[k];
    const heat = this.thermal.addHeat(gx, gy, opts.heat);
    if (c.material[k] === Material.CHARRED || c.sediment[k] <= 0.02) return false;
    if (heat >= opts.charAt) {
      c.material[k] = Material.CHARRED;
      this.water.wake(gx, gy);
      this.landslides.wake(gx, gy);
      return before < opts.charAt;
    }
    if (opts.ash > 0) this.deposit(gx, gy, Material.ASH, opts.ash);
    return false;
  }

  /** Coordenadas globales de celda a partir de chunk + celda local */
  static global(cx: number, cy: number, ci: number, cj: number): [number, number] {
    return [cx * WORLD.CELLS + ci, cy * WORLD.CELLS + cj];
  }
}
