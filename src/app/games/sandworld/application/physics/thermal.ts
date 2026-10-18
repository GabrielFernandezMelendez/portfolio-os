import { CellRef, TerrainGrid } from './terrain-grid';
import { ChunkData, temperatureAt, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import {
  BRASA_HEAT_HALF_LIFE, SNOW_WATER, TEMP_SHIFT_HALF_LIFE, THAW_RATE, THAW_TEMPERATURE,
} from '../../config/sand-effects.config';

const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
const MINUTES_PER_DAY = 1440;
/**
 * Por debajo de esto, la capa helada, el calor o el desvío de temperatura se dan por desaparecidos.
 * Tiene que ser muy pequeño: las arenas los suben poco a poco, minuto a minuto (milésimas).
 */
const EPSILON = 1e-5;

/** Factor por minuto para que un valor se reduzca a la mitad en `days` días */
const halfLifeFactor = (days: number): number => Math.pow(0.5, 1 / (days * MINUTES_PER_DAY));

/**
 * Frío y calor: capa helada (nieve/hielo) que se funde según la temperatura del tile, calor acumulado
 * por la Brasa y desvíos temporales de temperatura (Brasa sube, Escarcha baja) que vuelven solos a 0.
 * Solo se procesan las celdas y tiles afectados.
 */
export class ThermalSystem {
  private readonly frozen = new Set<number>();
  private readonly hot = new Set<number>();
  private readonly shifted = new Map<string, { chunk: ChunkData; t: number }>();
  private readonly heatDecay = halfLifeFactor(BRASA_HEAT_HALF_LIFE);
  private readonly shiftDecay = halfLifeFactor(TEMP_SHIFT_HALF_LIFE);

  constructor(
    private readonly grid: TerrainGrid,
    /** Se llama con el agua que deja una celda al fundirse */
    private readonly onMelt: (gx: number, gy: number, water: number) => void,
    /** Desvío global de temperatura del momento (estación y hora) */
    private readonly climateOffset: () => number = () => 0,
  ) {}

  /** Registra las celdas heladas de un chunk (p. ej. al cargarlo) */
  addChunk(chunk: ChunkData): void {
    for (let k = 0; k < C * C; k++) {
      if (chunk.cover[k] > EPSILON) this.frozen.add(TerrainGrid.key(chunk.cx * C + (k % C), chunk.cy * C + Math.floor(k / C)));
    }
  }

  /**
   * Añade nieve o hielo encima de la celda. `seasonal` = viene del tiempo (nevada, hielo de invierno):
   * se funde igual, pero no cuenta para el bioma. Si se mezcla con la de una arena, deja de ser de temporada.
   */
  addCover(gx: number, gy: number, material: typeof Material.SNOW | typeof Material.ICE, amount: number, seasonal = false): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell || amount <= 0) return;
    const c = cell.chunk, k = cell.k;
    const fresh = c.cover[k] <= EPSILON;
    // El hielo manda sobre la nieve (es lo que bloquea el agua)
    if (fresh || material === Material.ICE) c.coverMaterial[k] = material;
    c.coverSeasonal[k] = (fresh || c.coverSeasonal[k] === 1) && seasonal ? 1 : 0;
    this.grid.setCover(cell, cell.chunk.cover[cell.k] + amount);
    this.frozen.add(TerrainGrid.key(gx, gy));
  }

  /** Funde hasta `amount` niveles de capa helada (Brasa). Devuelve el agua que sale. */
  melt(gx: number, gy: number, amount: number): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return 0;
    return this.meltCell(cell, gx, gy, amount);
  }

  addHeat(gx: number, gy: number, amount: number): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return 0;
    cell.chunk.heat[cell.k] += amount;
    this.hot.add(TerrainGrid.key(gx, gy));
    return cell.chunk.heat[cell.k];
  }

  /** Desvía la temperatura del tile que contiene la celda */
  shiftTemperature(gx: number, gy: number, delta: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    const c = cell.chunk;
    const t = tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G));
    c.tempShift[t] = Math.max(-1, Math.min(1, c.tempShift[t] + delta));
    this.shifted.set(`${c.cx},${c.cy},${t}`, { chunk: c, t });
  }

  /** Un minuto: se funde lo helado según el calor, y el calor y los desvíos se disipan */
  minute(changed: Set<string>): void {
    for (const key of this.frozen) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell || cell.chunk.cover[cell.k] <= EPSILON) {
        if (cell) cell.chunk.cover[cell.k] = 0;
        this.frozen.delete(key);
        continue;
      }
      const c = cell.chunk;
      const t = tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G));
      const warmth = temperatureAt(c, t) + this.climateOffset() - THAW_TEMPERATURE;
      if (warmth <= 0) continue;
      const before = c.cover[cell.k];
      this.meltCell(cell, gx, gy, THAW_RATE * warmth);
      // Solo se redibuja cuando la capa desaparece o cambia de forma visible
      if (c.cover[cell.k] <= EPSILON || Math.floor(before * 20) !== Math.floor(c.cover[cell.k] * 20)) changed.add(`${c.cx},${c.cy}`);
    }
    for (const key of this.hot) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) { this.hot.delete(key); continue; }
      cell.chunk.heat[cell.k] *= this.heatDecay;
      if (cell.chunk.heat[cell.k] <= EPSILON) {
        cell.chunk.heat[cell.k] = 0;
        this.hot.delete(key);
      }
    }
    for (const [key, { chunk, t }] of this.shifted) {
      chunk.tempShift[t] *= this.shiftDecay;
      if (Math.abs(chunk.tempShift[t]) <= EPSILON) {
        chunk.tempShift[t] = 0;
        this.shifted.delete(key);
      }
    }
  }

  private meltCell(cell: CellRef, gx: number, gy: number, amount: number): number {
    const c = cell.chunk;
    const melted = Math.min(c.cover[cell.k], amount);
    if (melted <= 0) return 0;
    const water = melted * (c.coverMaterial[cell.k] === Material.ICE ? 1 : SNOW_WATER);
    this.grid.setCover(cell, c.cover[cell.k] - melted);
    this.onMelt(gx, gy, water);
    return water;
  }
}
