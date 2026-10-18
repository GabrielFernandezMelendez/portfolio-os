import { ChunkData, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { MATERIAL_DEFS } from '../../config/materials.config';
import { WATER_TABLE } from '../../config/world.config';
import {
  EDGE_DRAIN_RATE, EVAPORATION, INFILTRATION, RULE_INTERVAL_MINUTES, SOIL_DRYING, SOIL_WATER_CAPACITY,
  STAGNANT_FLOW, WATER_FLOW_RATE, WATER_MIN, WATER_PASSES_PER_MINUTE, WATER_TABLE_RECHARGE, WATER_VISUAL_STEP,
  WETTING_DEPTH,
} from '../../config/water.config';
import { CellRef, TerrainGrid } from './terrain-grid';
import { RULES_BY_MATERIAL } from './material-rules';

const NEIGHBOURS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Cuánto se concentra el agua en la pendiente más fuerte (1 = reparto proporcional, más = cauces más definidos) */
const FLOW_FOCUS = 3;

/** Desnivel mínimo para que el agua se mueva (evita temblores de milésimas en las mesetas) */
const MIN_DROP = 0.001;
const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
const MINUTE_IN_DAYS = 1 / 1440;

/** Interruptores para los tests (aislar el flujo de las pérdidas) */
export interface WaterOptions {
  infiltration: boolean;
  evaporation: boolean;
  recharge: boolean;
}

/**
 * Agua dinámica sobre todos los chunks descubiertos.
 * - Flujo: el agua pasa a las vecinas cuya superficie (terreno + agua) está más baja. Se conserva.
 * - Bordes: cualquier celda de borde con agua la deja caer al mar de nubes (se pierde y se dibuja la cascada).
 * - Fuentes: manantiales (naturales o del jugador) y el nivel freático, que mantiene los lagos.
 * - Pérdidas: infiltración en el suelo (según el material) y evaporación (según la temperatura).
 * - Estancamiento: días que lleva quieta el agua de cada celda (base del barro y del pantano).
 * - Reglas: transformaciones de material registradas (encharcamiento → barro, barro seco → tierra...).
 * Solo se procesan las celdas con agua, con humedad o con manantial.
 */
export class WaterSystem {
  /** Celdas con agua o manantial (claves globales) */
  private readonly wet = new Set<number>();
  /** Celdas con humedad en el suelo o con una regla en curso */
  private readonly damp = new Set<number>();
  /** Salida de agua del último minuto por celda (para saber si corre o está quieta) */
  private readonly outflow = new Map<number, number>();
  /** Último valor de agua dibujado por celda, para no re-hornear por cambios invisibles */
  private readonly shown = new Map<number, number>();
  /** Celdas de borde cuya cascada se está dibujando */
  private readonly shownDrain = new Set<number>();
  /** Celdas que han dejado caer agua por el borde en algún minuto reciente (para ponerlas a cero) */
  private readonly draining = new Set<number>();
  private minutes = 0;
  private passes = 0;

  /** Celdas cuyo material ha cambiado por una regla (para despertar desprendimientos) */
  readonly transformed: [number, number][] = [];

  constructor(
    private readonly grid: TerrainGrid,
    private readonly options: WaterOptions = { infiltration: true, evaporation: true, recharge: true },
  ) {}

  get wetCount(): number {
    return this.wet.size;
  }

  /** Registra las celdas con agua o manantial de un chunk recién descubierto */
  addChunk(chunk: ChunkData): void {
    for (let k = 0; k < C * C; k++) {
      const gx = chunk.cx * C + (k % C), gy = chunk.cy * C + Math.floor(k / C);
      const key = TerrainGrid.key(gx, gy);
      if (chunk.water[k] > WATER_MIN || chunk.spring[k] > 0 || groundAt(chunk, k) < WATER_TABLE) this.wet.add(key);
      this.shown.set(key, chunk.water[k]);
    }
  }

  /** Despierta una celda (p. ej. tras cambiar su altura o su material) para que su agua y sus reglas se revisen */
  wake(gx: number, gy: number): void {
    const key = TerrainGrid.key(gx, gy);
    this.wet.add(key);
    this.damp.add(key);
    for (const [dx, dy] of NEIGHBOURS) this.wet.add(TerrainGrid.key(gx + dx, gy + dy));
  }

  /** Un minuto de juego. Añade a `changed` los chunks cuyo agua ha cambiado de forma visible. */
  minute(changed: Set<string>): void {
    this.minutes++;
    this.clearDrains();
    this.outflow.clear();
    for (let i = 0; i < WATER_PASSES_PER_MINUTE; i++) this.flowPass();
    this.sourcesAndLosses();
    if (this.minutes % RULE_INTERVAL_MINUTES === 0) this.applyRules(RULE_INTERVAL_MINUTES * MINUTE_IN_DAYS);
    this.collectVisualChanges(changed);
  }

  // ── Flujo ────────────────────────────────────────────────────────

  /**
   * Una pasada de flujo, actualizando celda a celda sobre el valor ya modificado (Gauss-Seidel).
   * Si se calculara todo a la vez, el agua de las mesetas rebotaría entre celdas vecinas y dibujaría
   * un tablero de ajedrez; así se asienta. El orden se invierte en cada pasada para no favorecer una dirección.
   */
  private flowPass(): void {
    const keys = [...this.wet];
    if (this.passes++ % 2 === 1) keys.reverse();

    for (const key of keys) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) continue;
      const w = cell.chunk.water[cell.k];
      if (w <= WATER_MIN) continue;

      const surface = this.grid.ground(cell) + w;
      const k = WATER_FLOW_RATE * MATERIAL_DEFS[cell.chunk.material[cell.k] as MaterialId].flow;

      // Reparto hacia las vecinas más bajas, concentrado en la pendiente más fuerte (exponente FLOW_FOCUS):
      // así el agua forma cauces en lugar de extenderse como una sábana por las mesetas
      let edge = 0;
      let maxDrop = 0;
      let weightSum = 0;
      const out: [CellRef, number, number, number][] = [];   // celda, gx, gy, peso
      for (const [dx, dy] of NEIGHBOURS) {
        const n = this.grid.cell(gx + dx, gy + dy);
        if (!n) {
          // Borde de lo descubierto: el agua cae al mar de nubes
          edge += w * EDGE_DRAIN_RATE;
          continue;
        }
        const drop = surface - (this.grid.ground(n) + n.chunk.water[n.k]);
        if (drop <= MIN_DROP) continue;
        const weight = Math.pow(drop, FLOW_FOCUS);
        out.push([n, gx + dx, gy + dy, weight]);
        maxDrop = Math.max(maxDrop, drop);
        weightSum += weight;
      }
      // Lo que sale hacia las vecinas: proporcional al mayor desnivel y nunca más de la mitad de ese desnivel
      // (así no se invierte la pendiente) ni más agua de la que hay
      const flowOut = out.length ? Math.min(k * maxDrop * 4, maxDrop / 2) : 0;
      const total = flowOut + edge;
      if (total <= 0) continue;
      const scale = total > w ? w / total : 1;

      for (const [n, nx, ny, weight] of out) {
        let share = flowOut * (weight / weightSum) * scale;
        // Frente de mojado: el suelo seco se empapa antes de dejar pasar el agua
        if (this.options.infiltration && n.chunk.moisture[n.k] < 1) {
          const capacity = WETTING_DEPTH * Math.min(1, MATERIAL_DEFS[n.chunk.material[n.k] as MaterialId].permeability * 4);
          if (capacity > 0) {
            const soak = Math.min(share, (1 - n.chunk.moisture[n.k]) * capacity);
            n.chunk.moisture[n.k] += soak / capacity;
            share -= soak;
            this.damp.add(TerrainGrid.key(nx, ny));
          }
        }
        n.chunk.water[n.k] += share;
        this.wet.add(TerrainGrid.key(nx, ny));
      }
      if (edge > 0) {
        cell.chunk.drain[cell.k] += edge * scale;
        this.draining.add(key);
      }
      cell.chunk.water[cell.k] = Math.max(0, w - total * scale);
      this.outflow.set(key, (this.outflow.get(key) ?? 0) + total * scale);
    }
  }

  // ── Fuentes y pérdidas (una vez por minuto) ─────────────────────

  private sourcesAndLosses(): void {
    for (const key of this.wet) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) {
        this.wet.delete(key);
        continue;
      }
      const c = cell.chunk, k = cell.k;
      const def = MATERIAL_DEFS[c.material[k] as MaterialId];
      const temperature = c.temperature[tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G))];

      // Manantial
      if (c.spring[k] > 0) c.water[k] += c.spring[k];

      // Nivel freático: rellena despacio lo que está por debajo (lagos generados)
      if (this.options.recharge) {
        const missing = WATER_TABLE - (this.grid.ground(cell) + c.water[k]);
        if (missing > 0) c.water[k] += Math.min(missing, WATER_TABLE_RECHARGE);
      }

      // Infiltración en el suelo según el material
      if (this.options.infiltration && c.water[k] > 0 && def.permeability > 0 && c.moisture[k] < 1) {
        const room = (1 - c.moisture[k]) * SOIL_WATER_CAPACITY;
        const absorbed = Math.min(c.water[k], INFILTRATION * def.permeability, room);
        c.water[k] -= absorbed;
        c.moisture[k] = Math.min(1, c.moisture[k] + absorbed / SOIL_WATER_CAPACITY);
        if (absorbed > 0) this.damp.add(key);
      }

      // Evaporación según la temperatura
      if (this.options.evaporation && c.water[k] > 0) {
        c.water[k] = Math.max(0, c.water[k] - EVAPORATION * temperature);
      }

      // Estancamiento: días que lleva quieta
      if (c.water[k] > WATER_MIN) {
        const moving = (this.outflow.get(key) ?? 0) > STAGNANT_FLOW;
        c.stagnant[k] = moving ? Math.max(0, c.stagnant[k] - 2 * MINUTE_IN_DAYS) : c.stagnant[k] + MINUTE_IN_DAYS;
        this.damp.add(key);
      } else {
        // Película mínima: se evapora de una vez; sin evaporación se conserva y solo deja de calcularse
        if (this.options.evaporation) c.water[k] = 0;
        c.stagnant[k] = 0;
        if (c.spring[k] <= 0 && this.grid.ground(cell) >= WATER_TABLE) this.wet.delete(key);
      }
    }

    // Secado del suelo
    if (!this.options.infiltration) return;
    for (const key of this.damp) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) continue;
      const c = cell.chunk, k = cell.k;
      if (c.moisture[k] <= 0) continue;
      const def = MATERIAL_DEFS[c.material[k] as MaterialId];
      const temperature = c.temperature[tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G))];
      c.moisture[k] = Math.max(0, c.moisture[k] - SOIL_DRYING * (1 - def.retention) * (0.5 + temperature));
    }
  }

  // ── Reglas de transformación ────────────────────────────────────

  private applyRules(elapsedDays: number): void {
    for (const key of this.damp) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) {
        this.damp.delete(key);
        continue;
      }
      const c = cell.chunk, k = cell.k;
      const rules = RULES_BY_MATERIAL.get(c.material[k] as MaterialId);
      if (!rules) {
        c.ruleId[k] = 0;
        c.ruleTimer[k] = 0;
        if (c.moisture[k] <= 0 && c.water[k] <= WATER_MIN) this.damp.delete(key);
        continue;
      }
      const ctx = this.context(cell, gx, gy);
      const rule = rules.find(r => r.when(ctx));
      if (!rule) {
        c.ruleId[k] = 0;
        c.ruleTimer[k] = 0;
        if (c.moisture[k] <= 0 && c.water[k] <= WATER_MIN) this.damp.delete(key);
        continue;
      }
      if (c.ruleId[k] !== rule.id) {
        c.ruleId[k] = rule.id;
        c.ruleTimer[k] = 0;
      }
      c.ruleTimer[k] += elapsedDays;
      if (c.ruleTimer[k] >= rule.days) {
        c.material[k] = rule.to;
        c.ruleId[k] = 0;
        c.ruleTimer[k] = 0;
        this.transformed.push([gx, gy]);
      }
    }
  }

  private context(cell: CellRef, gx: number, gy: number): import('./material-rules').CellContext {
    const c = cell.chunk, k = cell.k;
    let deep = false;
    for (const [dx, dy] of NEIGHBOURS) {
      const n = this.grid.cell(gx + dx, gy + dy);
      if (n && n.chunk.water[n.k] > 0.35) deep = true;
    }
    const t = tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G));
    return {
      water: c.water[k],
      moisture: c.moisture[k],
      stagnant: c.stagnant[k],
      deepNeighbour: deep,
      belowTable: this.grid.ground(cell) < WATER_TABLE,
      temperature: c.temperature[t],
    };
  }

  // ── Dibujo ───────────────────────────────────────────────────────

  /** Pone a cero el agua caída por los bordes del minuto anterior (se vuelve a acumular en este) */
  private clearDrains(): void {
    for (const key of this.draining) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (cell) cell.chunk.drain[cell.k] = 0;
    }
    this.draining.clear();
  }

  /** Chunks con algún cambio de agua visible desde el último dibujo */
  private collectVisualChanges(changed: Set<string>): void {
    for (const key of new Set([...this.wet, ...this.shownDrain])) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) continue;
      const w = cell.chunk.water[cell.k];
      const last = this.shown.get(key) ?? 0;
      if (Math.abs(w - last) >= WATER_VISUAL_STEP || (w > WATER_MIN) !== (last > WATER_MIN)) {
        this.shown.set(key, w);
        changed.add(`${cell.chunk.cx},${cell.chunk.cy}`);
      }
      // Una cascada de borde solo se vuelve a dibujar cuando empieza o se acaba
      const draining = cell.chunk.drain[cell.k] > WATER_MIN;
      if (draining !== this.shownDrain.has(key)) {
        if (draining) this.shownDrain.add(key);
        else this.shownDrain.delete(key);
        changed.add(`${cell.chunk.cx},${cell.chunk.cy}`);
      }
    }
  }
}
