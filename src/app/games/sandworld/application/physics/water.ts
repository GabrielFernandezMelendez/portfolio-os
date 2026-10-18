import { ChunkData, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { MATERIAL_DEFS } from '../../config/materials.config';
import { WATER_TABLE } from '../../config/world.config';
import {
  EDGE_DRAIN_RATE, EVAPORATION, INFILTRATION, RULE_INTERVAL_MINUTES, SOIL_DRYING, SOIL_WATER_CAPACITY,
  STAGNANT_FLOW, PIPE_INERTIA, PIPE_RATE, WATER_MIN, WATER_PASSES_PER_MINUTE, WATER_TABLE_RECHARGE, WATER_VISUAL_STEP,
  WETTING_DEPTH,
} from '../../config/water.config';
import { CellRef, TerrainGrid } from './terrain-grid';
import { RULES_BY_MATERIAL } from './material-rules';

const NEIGHBOURS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Parte del agua de una celda que puede salir en una pasada */
const MAX_OUT_FRACTION = 0.5;
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
  private passCredit = 0;

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
    // Pasadas de este minuto (puede ser menos de una por minuto: se acumulan)
    this.passCredit += WATER_PASSES_PER_MINUTE;
    while (this.passCredit >= 1) {
      this.passCredit -= 1;
      this.flowPass();
    }
    this.sourcesAndLosses();
    if (this.minutes % RULE_INTERVAL_MINUTES === 0) this.applyRules(RULE_INTERVAL_MINUTES * MINUTE_IN_DAYS);
    this.collectVisualChanges(changed);
  }

  // ── Flujo ────────────────────────────────────────────────────────

  /**
   * Una pasada de flujo con "tuberías virtuales": cada celda tiene un caudal hacia cada vecina que
   * se acelera con el desnivel de superficie y conserva parte de la pasada anterior (inercia).
   * Primero se calculan todos los caudales con el estado actual y después se mueve el agua, así que
   * en cada pasada el agua avanza como mucho una celda: se ve correr como un frente continuo
   * en lugar de saltar de golpe a charcos lejanos.
   */
  private flowPass(): void {
    const movers: number[] = [];

    // 1. Caudales
    for (const key of this.wet) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) continue;
      const c = cell.chunk, k = cell.k, f = k * 4;
      const w = c.water[k];
      if (w <= WATER_MIN) {
        c.flux[f] = c.flux[f + 1] = c.flux[f + 2] = c.flux[f + 3] = 0;
        continue;
      }
      const surface = this.grid.ground(cell) + w;
      const pipe = PIPE_RATE * MATERIAL_DEFS[c.material[k] as MaterialId].flow;
      let sum = 0;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = NEIGHBOURS[d];
        const n = this.grid.cell(gx + dx, gy + dy);
        let q: number;
        if (!n) {
          // Borde de lo descubierto: el agua cae al mar de nubes
          q = w * EDGE_DRAIN_RATE;
        } else {
          const head = surface - (this.grid.ground(n) + n.chunk.water[n.k]);
          q = Math.max(0, c.flux[f + d] * PIPE_INERTIA + pipe * head);
        }
        c.flux[f + d] = q;
        sum += q;
      }
      if (sum <= 0) continue;
      // En una pasada sale como mucho la mitad del agua de la celda: si se vaciara entera, el agua
      // avanzaría a saltos (celda llena, celda vacía...) en vez de como una lámina continua
      const most = w * MAX_OUT_FRACTION;
      if (sum > most) {
        const scale = most / sum;
        for (let d = 0; d < 4; d++) c.flux[f + d] *= scale;
      }
      movers.push(key);
    }

    // 2. Mover el agua (los caudales ya están limitados, el orden no importa)
    for (const key of movers) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy)!;
      const c = cell.chunk, k = cell.k, f = k * 4;
      let total = 0;
      for (let d = 0; d < 4; d++) {
        let q = c.flux[f + d];
        if (q <= 0) continue;
        total += q;
        const [dx, dy] = NEIGHBOURS[d];
        const nx = gx + dx, ny = gy + dy;
        const n = this.grid.cell(nx, ny);
        if (!n) {
          c.drain[k] += q;
          this.draining.add(key);
          continue;
        }
        // Frente de mojado: el suelo seco se empapa antes de dejar pasar el agua
        if (this.options.infiltration && n.chunk.moisture[n.k] < 1) {
          const capacity = WETTING_DEPTH * Math.min(1, MATERIAL_DEFS[n.chunk.material[n.k] as MaterialId].permeability * 4);
          if (capacity > 0) {
            const soak = Math.min(q, (1 - n.chunk.moisture[n.k]) * capacity);
            n.chunk.moisture[n.k] += soak / capacity;
            q -= soak;
            this.damp.add(TerrainGrid.key(nx, ny));
          }
        }
        n.chunk.water[n.k] += q;
        this.wet.add(TerrainGrid.key(nx, ny));
      }
      c.water[k] = Math.max(0, c.water[k] - total);
      this.outflow.set(key, (this.outflow.get(key) ?? 0) + total);
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
