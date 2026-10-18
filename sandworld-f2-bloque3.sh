#!/usr/bin/env bash
# Sandworld · Fase 2 · Bloque 3: pincel de arena (trazo con rendimiento decreciente, capa sin asentar, granos, cola de vertidos de 1–2 días) — desde la raíz del portfolio
set -e
test -d src/app/games/sandworld || { echo "Ejecuta el script desde la raíz del portfolio"; exit 1; }
mkdir -p src/app/games/sandworld src/app/games/sandworld/application/sands src/app/games/sandworld/config src/app/games/sandworld/domain/models src/app/games/sandworld/i18n src/app/games/sandworld/infrastructure/input src/app/games/sandworld/rendering/sands src/app/games/sandworld/rendering/terrain src/app/games/sandworld/ui/organisms/hud src/app/games/sandworld/ui/organisms/plank-bar src/app/games/sandworld/ui/organisms/sands-panel src/app/games/sandworld/ui/sandworld

cat > src/app/games/sandworld/application/sands/pour-queue.ts <<'SANDWORLD_EOF'
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
SANDWORLD_EOF

cat > src/app/games/sandworld/application/sands/pour.spec.ts <<'SANDWORLD_EOF'
import { World } from '../world/world';
import { TerrainPhysics } from '../physics/terrain-physics';
import { PourQueue } from './pour-queue';
import { Stroke } from './stroke';
import { Sand } from '../../domain/models/sand.model';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { POUR_DAYS_MAX, POUR_DAYS_MIN, POUR_DWELL_SECONDS, POUR_MAX_DUNE, STROKE_TOTAL_CAP } from '../../config/pour.config';
import { BRUSH_CELLS } from '../../config/brush.config';

const setup = () => {
  const world = new World(11);
  world.chunk(0, 0);
  const physics = new TerrainPhysics(world);
  const queue = new PourQueue(physics, new SeededRandom(5));
  return { world, physics, queue };
};
const totalGround = (physics: TerrainPhysics): number => {
  let s = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) s += physics.grid.ground(physics.grid.cell(x, y)!);
  return s;
};

describe('Stroke (pincel)', () => {
  it('rendimiento decreciente: tras τ segundos ha caído ~63 % del máximo por celda', () => {
    const s = new Stroke(Sand.DUNA);
    s.pour(10, 10, POUR_DWELL_SECONDS);
    const perCell = s.cells.get([...s.cells.keys()][0])!;
    expect(perCell).toBeCloseTo(POUR_MAX_DUNE * (1 - Math.exp(-1)), 4);
    // Quedarse mucho más tiempo nunca pasa del máximo
    s.pour(10, 10, 60);
    expect(s.cells.get([...s.cells.keys()][0])!).toBeLessThanOrEqual(POUR_MAX_DUNE + 1e-9);
  });

  it('el trazo tiene tope total y la botella se vacía', () => {
    const s = new Stroke(Sand.DUNA);
    for (let i = 0; i < 40; i++) s.pour((i % 8) * BRUSH_CELLS, Math.floor(i / 8) * BRUSH_CELLS, 10);
    expect(s.poured).toBeCloseTo(STROKE_TOTAL_CAP, 6);
    expect(s.remaining).toBe(0);
    expect(s.pour(30, 30, 5)).toEqual([]);
  });
});

describe('PourQueue (asentamiento)', () => {
  it('lo depositado al terminar es lo vertido, y tarda entre 1 y 2 días', () => {
    const { physics, queue } = setup();
    const before = totalGround(physics);
    const s = new Stroke(Sand.DUNA);
    queue.preview(s.sand, s.pour(14, 14, 2));
    const pour = queue.commit(s)!;
    expect(pour.duration).toBeGreaterThanOrEqual(POUR_DAYS_MIN * 1440);
    expect(pour.duration).toBeLessThanOrEqual(POUR_DAYS_MAX * 1440);
    let minutes = 0;
    while (queue.active.length) { queue.minute(); minutes++; }
    expect(minutes).toBe(pour.duration);
    // Los desprendimientos no crean ni destruyen terreno; la física no ha corrido, así que se compara directo
    expect(totalGround(physics) - before).toBeCloseTo(s.poured, 2);   // Float32: pequeño error de redondeo acumulado
    // La capa sin asentar desaparece
    const c = physics.grid.cell(14, 14)!;
    expect(c.chunk.pending[c.k]).toBe(0);
    expect(c.chunk.pendingSand[c.k]).toBe(0);
  });

  it('verter otra vez la misma arena sobre lo pendiente se suma y alarga el vertido', () => {
    const { queue } = setup();
    const a = new Stroke(Sand.DUNA);
    queue.preview(a.sand, a.pour(14, 14, 1));
    const p = queue.commit(a)!;
    for (let i = 0; i < 100; i++) queue.minute();
    const durationBefore = p.duration;
    const b = new Stroke(Sand.DUNA);
    queue.preview(b.sand, b.pour(14, 14, 1));
    expect(queue.commit(b)).toBe(p);
    expect(queue.active.length).toBe(1);
    expect(p.duration).toBeGreaterThan(durationBefore);
    // Otra arena en el mismo sitio es un vertido aparte
    const c = new Stroke(Sand.HUMUS);
    c.pour(14, 14, 1);
    expect(queue.commit(c)).not.toBe(p);
    expect(queue.active.length).toBe(2);
  });

  it('en pausa (sin minutos de juego) no se asienta nada', () => {
    const { physics, queue } = setup();
    const before = totalGround(physics);
    const s = new Stroke(Sand.DUNA);
    queue.preview(s.sand, s.pour(14, 14, 2));
    queue.commit(s);
    expect(totalGround(physics)).toBeCloseTo(before, 6);
    const c = physics.grid.cell(14, 14)!;
    expect(c.chunk.pending[c.k]).toBeGreaterThan(0);
  });
});
SANDWORLD_EOF

cat > src/app/games/sandworld/application/sands/sand-effects.ts <<'SANDWORLD_EOF'
import { Sand, SandId } from '../../domain/models/sand.model';
import { Material } from '../../domain/models/material.model';
import { TerrainPhysics } from '../physics/terrain-physics';
import { POUR_MAX_DUNE, POUR_MAX_MASS, POUR_MAX_MASSLESS } from '../../config/pour.config';

/**
 * Efecto de una arena. Cada arena se registra aquí con:
 * - maxPerCell: cuánto puede caer en una celda en un trazo (niveles, o intensidad 0..1 si no tiene masa)
 * - massless:   no cambia la altura (Despertar, Afinidad)
 * - apply:      se llama cada minuto mientras el vertido se asienta, con la parte de la cantidad de ese minuto
 * - settled:    opcional, al terminar el vertido (cambio de bioma, avisos...)
 * Añadir o cambiar una arena = tocar solo su entrada; el pincel y la cola no saben nada de cada arena.
 */
export interface SandEffect {
  readonly sand: SandId;
  readonly maxPerCell: number;
  readonly massless: boolean;
  apply(physics: TerrainPhysics, gx: number, gy: number, amount: number): void;
  settled?(physics: TerrainPhysics, cells: readonly [number, number][]): void;
}

/** Arena aún sin efecto (llega en el bloque 4): se vierte y se asienta, pero no cambia el mundo */
const pending = (sand: SandId, massless = false): SandEffect => ({
  sand,
  maxPerCell: massless ? POUR_MAX_MASSLESS : POUR_MAX_MASS,
  massless,
  apply: () => undefined,
});

export const SAND_EFFECTS: Readonly<Record<SandId, SandEffect>> = {
  // Duna: mucha arena que levanta el terreno poco a poco (con sus desprendimientos y el agua reaccionando)
  [Sand.DUNA]: {
    sand: Sand.DUNA,
    maxPerCell: POUR_MAX_DUNE,
    massless: false,
    apply: (physics, gx, gy, amount) => {
      physics.deposit(gx, gy, Material.SAND, amount);
    },
  },
  // Bloque 4
  [Sand.BRASA]: pending(Sand.BRASA),
  [Sand.HUMUS]: pending(Sand.HUMUS),
  [Sand.MANANTIAL]: pending(Sand.MANANTIAL),
  [Sand.ESCARCHA]: pending(Sand.ESCARCHA),
  [Sand.MAREA]: pending(Sand.MAREA),
  [Sand.DESPERTAR]: pending(Sand.DESPERTAR, true),
  [Sand.AFINIDAD]: pending(Sand.AFINIDAD, true),
};
SANDWORLD_EOF

cat > src/app/games/sandworld/application/sands/stroke.ts <<'SANDWORLD_EOF'
import { SandId } from '../../domain/models/sand.model';
import { BRUSH_CELLS } from '../../config/brush.config';
import { POUR_DWELL_SECONDS, STROKE_TOTAL_CAP } from '../../config/pour.config';
import { SAND_EFFECTS } from './sand-effects';
import { TerrainGrid } from '../physics/terrain-grid';

/**
 * Un trazo del pincel mientras el dedo está apoyado.
 * Cada bloque de BRUSH_CELLS×BRUSH_CELLS celdas acumula arena según el tiempo que el dedo pasa encima,
 * con rendimiento decreciente: max × (1 − e^(−t/τ)). El trazo entero tiene un tope (STROKE_TOTAL_CAP).
 */
export class Stroke {
  /** Cantidad por celda global (clave de TerrainGrid) */
  readonly cells = new Map<number, number>();
  /** Segundos que el dedo lleva sobre cada bloque */
  private readonly dwell = new Map<number, number>();
  private total = 0;
  private readonly maxPerCell: number;

  constructor(readonly sand: SandId) {
    this.maxPerCell = SAND_EFFECTS[sand].maxPerCell;
  }

  /** Fracción que le queda al trazo (1 = botella llena, 0 = vacía) */
  get remaining(): number {
    return Math.max(0, 1 - this.total / STROKE_TOTAL_CAP);
  }

  get poured(): number {
    return this.total;
  }

  /**
   * El dedo pasa `seconds` sobre el bloque cuya primera celda es (gx0, gy0).
   * Devuelve las celdas que han recibido arena en este paso (para la capa visible y los granos).
   */
  pour(gx0: number, gy0: number, seconds: number): [number, number, number][] {
    if (this.remaining <= 0 || seconds <= 0) return [];
    const blockKey = TerrainGrid.key(gx0, gy0);
    const t0 = this.dwell.get(blockKey) ?? 0;
    const t1 = t0 + seconds;
    this.dwell.set(blockKey, t1);
    // Lo que cae en este intervalo según la curva de rendimiento decreciente
    let perCell = this.maxPerCell * (Math.exp(-t0 / POUR_DWELL_SECONDS) - Math.exp(-t1 / POUR_DWELL_SECONDS));
    const cellsInBlock = BRUSH_CELLS * BRUSH_CELLS;
    perCell = Math.min(perCell, (STROKE_TOTAL_CAP - this.total) / cellsInBlock);
    if (perCell <= 0) return [];

    const changed: [number, number, number][] = [];
    for (let dy = 0; dy < BRUSH_CELLS; dy++) {
      for (let dx = 0; dx < BRUSH_CELLS; dx++) {
        const key = TerrainGrid.key(gx0 + dx, gy0 + dy);
        this.cells.set(key, (this.cells.get(key) ?? 0) + perCell);
        changed.push([gx0 + dx, gy0 + dy, perCell]);
      }
    }
    this.total += perCell * cellsInBlock;
    return changed;
  }
}
SANDWORLD_EOF

cat > src/app/games/sandworld/config/pour.config.ts <<'SANDWORLD_EOF'
// Pincel y vertidos (ajustables en la ronda de pulido)

/** Segundos (reales) que tarda en caer ~63 % del máximo sobre la misma zona: rendimiento decreciente */
export const POUR_DWELL_SECONDS = 1;

/** Máximo por celda en un trazo (niveles): Duna y el resto de arenas con masa */
export const POUR_MAX_DUNE = 1.5;
export const POUR_MAX_MASS = 1;
/** Las arenas sin masa (Despertar, Afinidad) cuentan "intensidad" 0..1 por celda */
export const POUR_MAX_MASSLESS = 1;

/** Cantidad total que puede verter un trazo (suma de todas sus celdas) */
export const STROKE_TOTAL_CAP = 20;

/** Duración de un vertido: de MIN a MAX días de juego (opción B), al azar */
export const POUR_DAYS_MIN = 1;
export const POUR_DAYS_MAX = 2;

/** Al sumar arena a un vertido pendiente, su duración se alarga esta fracción de lo añadido */
export const POUR_MERGE_EXTENSION = 0.5;

/** Banda (px de pantalla) junto al borde que desliza la cámara mientras se vierte */
export const POUR_EDGE_BAND = 40;

/** La capa sin asentar se vuelve a dibujar cada este número de minutos de juego */
export const PENDING_REDRAW_MINUTES = 10;
/** Un toque corto (sin arrastrar) vierte como si el dedo hubiera estado este tiempo encima */
export const POUR_TAP_SECONDS = 0.15;
SANDWORLD_EOF

cat > src/app/games/sandworld/config/sands.config.ts <<'SANDWORLD_EOF'
import { SAND_ORDER, SandId } from '../domain/models/sand.model';

/** Color del contenido de cada botella (CSS) */
export const SAND_COLORS: Record<SandId, string> = {
  brasa:     '#e0532f',   // roja
  duna:      '#ecc35c',   // amarilla
  humus:     '#5fae3e',   // verde
  manantial: '#3cc7d6',   // cian
  escarcha:  '#bfe6ff',   // azul claro
  despertar: '#9a5bd6',   // morada
  marea:     '#2f6fd0',   // azul
  afinidad:  '#f08bc4',   // rosa
};

/** Los mismos colores como número 0xRRGGBB (horneado y partículas), en el orden de SAND_ORDER */
export const SAND_COLOR_NUM: readonly number[] = SAND_ORDER.map(s => parseInt(SAND_COLORS[s].slice(1), 16));

/** Arenas sin masa: en la capa sin asentar se ven como destellos, no como granos */
export const MASSLESS_SANDS: readonly SandId[] = ['despertar', 'afinidad'];
SANDWORLD_EOF

cat > src/app/games/sandworld/domain/models/chunk.model.ts <<'SANDWORLD_EOF'
import { WORLD } from './world.model';

/**
 * Estado de un chunk en arrays tipados (sin objetos por celda: es lo que permite escalar a muchos chunks).
 *
 * Rejilla física (CELLS × CELLS):
 *   rock      altura de la roca madre, en niveles
 *   sediment  espesor del material suelto encima de la roca, en niveles
 *   material  MaterialId del sedimento
 *   water     lámina de agua libre encima del terreno, en niveles
 *   moisture  humedad del suelo (agua infiltrada), 0..1
 *   stagnant  días que lleva el agua de la celda sin correr
 *   spring    caudal de un manantial en la celda (niveles por minuto de juego), 0 = ninguno
 *   drain     agua que salió por el borde de la isla en el último minuto (para dibujar la cascada)
 *   ruleId / ruleTimer  regla de transformación en curso y días que lleva cumpliéndose
 *   pending / pendingSand  arena vertida que aún no se ha asentado (cantidad) y cuál (índice en SAND_ORDER + 1)
 *
 * Rejilla ecológica (TILES × TILES):
 *   temperature, humidity, fertility, essence  (0..1)
 *   biome     BiomeId
 */
export interface ChunkData {
  readonly cx: number;
  readonly cy: number;

  readonly rock: Float32Array;
  readonly sediment: Float32Array;
  readonly material: Uint8Array;
  readonly water: Float32Array;
  readonly moisture: Float32Array;
  readonly stagnant: Float32Array;
  readonly spring: Float32Array;
  readonly drain: Float32Array;
  readonly ruleId: Uint8Array;
  readonly ruleTimer: Float32Array;
  readonly pending: Float32Array;
  readonly pendingSand: Uint8Array;

  readonly temperature: Float32Array;
  readonly humidity: Float32Array;
  readonly fertility: Float32Array;
  readonly essence: Float32Array;
  readonly biome: Uint8Array;
}

const CELLS_TOTAL = WORLD.CELLS * WORLD.CELLS;
const TILES_TOTAL = WORLD.TILES * WORLD.TILES;

export function createChunkData(cx: number, cy: number): ChunkData {
  return {
    cx,
    cy,
    rock: new Float32Array(CELLS_TOTAL),
    sediment: new Float32Array(CELLS_TOTAL),
    material: new Uint8Array(CELLS_TOTAL),
    water: new Float32Array(CELLS_TOTAL),
    moisture: new Float32Array(CELLS_TOTAL),
    stagnant: new Float32Array(CELLS_TOTAL),
    spring: new Float32Array(CELLS_TOTAL),
    drain: new Float32Array(CELLS_TOTAL),
    ruleId: new Uint8Array(CELLS_TOTAL),
    ruleTimer: new Float32Array(CELLS_TOTAL),
    pending: new Float32Array(CELLS_TOTAL),
    pendingSand: new Uint8Array(CELLS_TOTAL),
    temperature: new Float32Array(TILES_TOTAL),
    humidity: new Float32Array(TILES_TOTAL),
    fertility: new Float32Array(TILES_TOTAL),
    essence: new Float32Array(TILES_TOTAL),
    biome: new Uint8Array(TILES_TOTAL),
  };
}

/** Índice de una celda (ci, cj) dentro de los arrays físicos */
export const cellIndex = (ci: number, cj: number): number => cj * WORLD.CELLS + ci;

/** Índice de un tile (i, j) dentro de los arrays ecológicos */
export const tileIndex = (i: number, j: number): number => j * WORLD.TILES + i;

/** Altura del terreno (roca + sedimento) de una celda */
export const groundAt = (chunk: ChunkData, k: number): number => chunk.rock[k] + chunk.sediment[k];
SANDWORLD_EOF

cat > src/app/games/sandworld/i18n/en.json <<'SANDWORLD_EOF'
{
  "hud": {
    "day": "Day {day}",
    "dayShort": "D{day}",
    "speed": "x{speed}",
    "pause": "Pause",
    "play": "Resume",
    "paused": "Paused",
    "settings": "Settings",
    "island": "Living island · Level {level}"
  },
  "season": {
    "0": "Spring",
    "1": "Summer",
    "2": "Autumn",
    "3": "Winter"
  },
  "planks": {
    "sands": "Sands",
    "balance": "Balance",
    "decisions": "Decisions"
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "exit": "Exit Sandworld",
    "resume": "Back to the island",
    "devReveal": "Test: uncover land",
    "devSand": "Test: sand pile",
    "devSpring": "Test: spring"
  },
  "lang": {
    "es": "Español",
    "en": "English"
  },
  "chronicle": {
    "title": "Island chronicle",
    "open": "Open the chronicle",
    "empty": "Nothing worth telling has happened yet.",
    "close": "Close",
    "times": "×{count}",
    "start": "The island wakes up. The Flying Spaghetti Monster watches with interest.",
    "dawn": "Dawn breaks over the island.",
    "dusk": "Night falls over the island.",
    "newDay": "Day {day} begins.",
    "newSeason": {
      "0": "Spring arrives: the island stretches.",
      "1": "Summer arrives: the sun bears down.",
      "2": "Autumn arrives: the leaves turn.",
      "3": "Winter arrives: the cold creeps down from the peaks."
    },
    "reveal": "The clouds part: the island grows to level {level}.",
    "settled": {
      "duna": "The dune has settled: the land has risen.",
      "brasa": "The ember has settled.",
      "humus": "The humus has settled.",
      "manantial": "The spring sand has settled.",
      "escarcha": "The frost has settled.",
      "marea": "The tide has settled.",
      "despertar": "The awakening has settled.",
      "afinidad": "The affinity has settled."
    }
  },
  "indicators": {
    "water": "Water",
    "vegetation": "Vegetation"
  },
  "balance": {
    "title": "Balance",
    "hint": "This is how the island is doing right now. Wildlife joins once the animals arrive."
  },
  "decisions": {
    "title": "Decisions",
    "empty": "No letters from the Flying Spaghetti Monster yet. It will write; it always does."
  },
  "sands": {
    "title": "Sands",
    "hint": "Pick a sand and drag one finger over the island. Two fingers move the camera.",
    "drop": "Put the sand away",
    "brasa": {
      "name": "Ember",
      "desc": "Heat and ash. It can set dry plants alight."
    },
    "duna": {
      "name": "Dune",
      "desc": "Lots of sand: raises the ground and diverts rivers."
    },
    "humus": {
      "name": "Humus",
      "desc": "Fertile soil that holds water."
    },
    "manantial": {
      "name": "Spring",
      "desc": "Creates a permanent water source."
    },
    "escarcha": {
      "name": "Frost",
      "desc": "Snow. Cools the area and freezes water."
    },
    "despertar": {
      "name": "Awakening",
      "desc": "Massless. Awakens the essence of life."
    },
    "marea": {
      "name": "Tide",
      "desc": "Dissolves sediment: digs wells and canals."
    },
    "afinidad": {
      "name": "Affinity",
      "desc": "Massless. More offspring, less aggression."
    }
  }
}
SANDWORLD_EOF

cat > src/app/games/sandworld/i18n/es.json <<'SANDWORLD_EOF'
{
  "hud": {
    "day": "Día {day}",
    "dayShort": "D{day}",
    "speed": "x{speed}",
    "pause": "Pausar",
    "play": "Reanudar",
    "paused": "Pausa",
    "settings": "Ajustes",
    "island": "Isla viva · Nivel {level}"
  },
  "season": {
    "0": "Primavera",
    "1": "Verano",
    "2": "Otoño",
    "3": "Invierno"
  },
  "planks": {
    "sands": "Arenas",
    "balance": "Equilibrio",
    "decisions": "Decisiones"
  },
  "settings": {
    "title": "Ajustes",
    "language": "Idioma",
    "exit": "Salir de Sandworld",
    "resume": "Volver a la isla",
    "devReveal": "Probar: descubrir terreno",
    "devSand": "Probar: montón de arena",
    "devSpring": "Probar: manantial"
  },
  "lang": {
    "es": "Español",
    "en": "English"
  },
  "chronicle": {
    "title": "Crónica de la isla",
    "open": "Abrir la crónica",
    "empty": "Aún no ha pasado nada digno de contar.",
    "close": "Cerrar",
    "times": "×{count}",
    "start": "La isla despierta. El Dios Espagueti Flotante la observa con interés.",
    "dawn": "Amanece sobre la isla.",
    "dusk": "Cae la noche sobre la isla.",
    "newDay": "Comienza el día {day}.",
    "newSeason": {
      "0": "Llega la primavera: la isla se despereza.",
      "1": "Llega el verano: el sol aprieta.",
      "2": "Llega el otoño: las hojas cambian de color.",
      "3": "Llega el invierno: el frío baja de las cumbres."
    },
    "reveal": "Las nubes se abren: la isla crece hasta el nivel {level}.",
    "settled": {
      "duna": "La duna se ha asentado: el terreno ha crecido.",
      "brasa": "La brasa se ha asentado.",
      "humus": "El humus se ha asentado.",
      "manantial": "El manantial se ha asentado.",
      "escarcha": "La escarcha se ha asentado.",
      "marea": "La marea se ha asentado.",
      "despertar": "El despertar se ha asentado.",
      "afinidad": "La afinidad se ha asentado."
    }
  },
  "indicators": {
    "water": "Agua",
    "vegetation": "Vegetación"
  },
  "balance": {
    "title": "Equilibrio",
    "hint": "Así está la isla ahora mismo. La fauna se sumará cuando lleguen los animales."
  },
  "decisions": {
    "title": "Decisiones",
    "empty": "Aún no hay cartas del Dios Espagueti Flotante. Ya escribirá; siempre escribe."
  },
  "sands": {
    "title": "Arenas",
    "hint": "Elige una arena y arrastra un dedo sobre la isla. Con dos dedos mueves la cámara.",
    "drop": "Soltar arena",
    "brasa": {
      "name": "Brasa",
      "desc": "Calor y ceniza. Puede prender la vegetación seca."
    },
    "duna": {
      "name": "Duna",
      "desc": "Mucha arena: eleva el terreno y desvía los ríos."
    },
    "humus": {
      "name": "Humus",
      "desc": "Tierra fértil que retiene el agua."
    },
    "manantial": {
      "name": "Manantial",
      "desc": "Crea una fuente permanente."
    },
    "escarcha": {
      "name": "Escarcha",
      "desc": "Nieve. Enfría la zona y congela el agua."
    },
    "despertar": {
      "name": "Despertar",
      "desc": "Sin masa. Despierta la esencia de la vida."
    },
    "marea": {
      "name": "Marea",
      "desc": "Disuelve el sedimento: excava pozos y canales."
    },
    "afinidad": {
      "name": "Afinidad",
      "desc": "Sin masa. Más crías y menos agresividad."
    }
  }
}
SANDWORLD_EOF

cat > src/app/games/sandworld/infrastructure/input/pointer-input.ts <<'SANDWORLD_EOF'
/*
  Adaptador de entrada del navegador (ratón, táctil y lápiz con Pointer Events).

  Gestos:
  - 1 dedo / clic izquierdo  → con una arena seleccionada: pincel (start, move, end; cancel si se convierte
                               en gesto de 2 dedos). Sin arena: arrastra la cámara, y un toque sin moverse señala la celda.
  - 2 dedos                  → arrastre de cámara + pellizco para zoom por niveles
  - botón derecho o central  → arrastre de cámara
  - rueda                    → zoom por niveles
  - ratón cerca del borde    → scroll por bordes (tras un instante, para no moverse al entrar en la app)
*/

export type BrushPhase = 'start' | 'move' | 'end' | 'cancel';

export interface InputHandlers {
  brush(phase: BrushPhase, x: number, y: number): void;
  hover(x: number, y: number): void;
  /** Toque corto sin arrastrar cuando el pincel está desactivado */
  tap(x: number, y: number): void;
  leave(): void;
  pan(dx: number, dy: number): void;
  /** Velocidad al soltar el arrastre, en px de pantalla por ms */
  fling(vx: number, vy: number): void;
  zoom(direction: 1 | -1, x: number, y: number): void;
}

/** El trazo de pincel no empieza hasta moverse esto o esperar BRUSH_DELAY_MS: da tiempo a poner el segundo dedo */
const BRUSH_SLOP_PX = 4;
const BRUSH_DELAY_MS = 90;
/** Cambio de distancia entre dedos necesario para saltar un nivel de zoom */
const PINCH_STEP = 1.3;
/** Desplazamiento de rueda acumulado por nivel de zoom */
const WHEEL_STEP = 80;
/** Banda del borde que activa el scroll y espera antes de empezar */
const EDGE_BAND_PX = 28;
const EDGE_DWELL_MS = 350;

interface Tracked {
  x: number;
  y: number;
}

type Mode = 'idle' | 'brush-pending' | 'brush' | 'gesture' | 'mouse-pan' | 'drag-pan';

export class PointerInput {
  private readonly pointers = new Map<number, Tracked>();
  private mode: Mode = 'idle';

  private brushStart = { x: 0, y: 0, time: 0 };
  private brushTimer: ReturnType<typeof setTimeout> | null = null;

  private gestureMid = { x: 0, y: 0 };
  private pinchBase = 0;
  private velocity = { x: 0, y: 0, time: 0 };

  private wheelAcc = 0;
  private mouse: { x: number; y: number; inside: boolean; since: number } = { x: 0, y: 0, inside: false, since: 0 };

  private dragStart = { x: 0, y: 0 };
  private dragMoved = false;

  /**
   * @param brushEnabled se consulta en cada toque: true si hay una arena seleccionada (1 dedo = pincel),
   *                     false si no (1 dedo = mover la cámara)
   */
  constructor(
    private readonly el: HTMLElement,
    private readonly on: InputHandlers,
    private readonly brushEnabled: () => boolean = () => true,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.preventMenu);
  }

  destroy(): void {
    this.clearBrushTimer();
    const el = this.el;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.preventMenu);
  }

  /** Dirección del scroll por bordes (-1..1 por eje). Se consulta en cada frame. */
  /**
   * Mientras se vierte con el dedo cerca de un borde (banda de `band` px), la cámara se desplaza hacia ese lado
   * para poder seguir el trazo más allá de la pantalla. Fuera del pincel devuelve (0, 0).
   */
  brushEdgeVector(band: number): { x: number; y: number } {
    if (this.mode !== 'brush' || this.pointers.size !== 1) return { x: 0, y: 0 };
    const p = this.pointers.values().next().value!;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const axis = (v: number, size: number): number =>
      v < band ? -(1 - v / band) : v > size - band ? 1 - (size - v) / band : 0;
    return { x: axis(p.x, w), y: axis(p.y, h) };
  }

  edgeVector(now = performance.now()): { x: number; y: number } {
    const m = this.mouse;
    if (!m.inside || this.mode !== 'idle' || now - m.since < EDGE_DWELL_MS) return { x: 0, y: 0 };
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const axis = (p: number, size: number): number =>
      p < EDGE_BAND_PX ? -(1 - p / EDGE_BAND_PX) : p > size - EDGE_BAND_PX ? 1 - (size - p) / EDGE_BAND_PX : 0;
    return { x: axis(m.x, w), y: axis(m.y, h) };
  }

  // ── Eventos ──────────────────────────────────────────────────────

  private onDown = (e: PointerEvent): void => {
    const p = this.local(e);
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, p);

    // Ratón: derecho o central arrastran la cámara
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
      e.preventDefault();
      this.mode = 'mouse-pan';
      this.resetVelocity();
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (this.pointers.size === 1 && !this.brushEnabled()) {
      this.mode = 'drag-pan';
      this.dragStart = { x: p.x, y: p.y };
      this.dragMoved = false;
      this.resetVelocity();
    } else if (this.pointers.size === 1) {
      this.mode = 'brush-pending';
      this.brushStart = { x: p.x, y: p.y, time: e.timeStamp };
      this.clearBrushTimer();
      this.brushTimer = setTimeout(() => this.beginBrush(), BRUSH_DELAY_MS);
    } else if (this.pointers.size === 2) {
      this.startGesture();
    }
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.local(e);
    if (e.pointerType === 'mouse') this.trackMouse(p);

    const tracked = this.pointers.get(e.pointerId);
    if (!tracked) {
      if (e.pointerType === 'mouse') this.on.hover(p.x, p.y);
      return;
    }
    const prev = { x: tracked.x, y: tracked.y };
    tracked.x = p.x;
    tracked.y = p.y;

    switch (this.mode) {
      case 'brush-pending':
        if (Math.hypot(p.x - this.brushStart.x, p.y - this.brushStart.y) >= BRUSH_SLOP_PX) {
          this.beginBrush();
          this.on.brush('move', p.x, p.y);
        }
        break;
      case 'brush':
        this.on.brush('move', p.x, p.y);
        break;
      case 'drag-pan':
        // Hasta superar el umbral no se mueve nada: así un toque con algo de temblor sigue siendo un toque
        if (!this.dragMoved && Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) < BRUSH_SLOP_PX) break;
        this.dragMoved = true;
        this.on.pan(p.x - prev.x, p.y - prev.y);
        this.trackVelocity(p.x - prev.x, p.y - prev.y, e.timeStamp);
        break;
      case 'mouse-pan':
        this.on.pan(p.x - prev.x, p.y - prev.y);
        this.trackVelocity(p.x - prev.x, p.y - prev.y, e.timeStamp);
        break;
      case 'gesture':
        this.updateGesture(e.timeStamp);
        break;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);

    switch (this.mode) {
      case 'brush-pending':
        // Toque corto sin moverse: también es un trazo (un solo punto)
        this.beginBrush();
        this.on.brush('end', p.x, p.y);
        this.mode = 'idle';
        break;
      case 'brush':
        this.on.brush('end', p.x, p.y);
        this.mode = 'idle';
        break;
      case 'drag-pan':
        if (this.dragMoved) this.releasePan(e.timeStamp);
        else {
          this.on.tap(p.x, p.y);
          this.mode = 'idle';
        }
        break;
      case 'mouse-pan':
        this.releasePan(e.timeStamp);
        break;
      case 'gesture':
        if (this.pointers.size < 2) this.releasePan(e.timeStamp);
        break;
    }
    if (this.pointers.size === 0 && this.mode !== 'idle') this.mode = 'idle';
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.mode === 'brush') this.on.brush('cancel', 0, 0);
    this.clearBrushTimer();
    if (this.pointers.size === 0) this.mode = 'idle';
  };

  private onLeave = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    this.mouse.inside = false;
    if (this.mode === 'idle') this.on.leave();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // deltaMode 1 = líneas (Firefox): se pasa a píxeles aproximados
    this.wheelAcc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(this.wheelAcc) < WHEEL_STEP) return;
    const p = this.local(e);
    this.on.zoom(this.wheelAcc < 0 ? 1 : -1, p.x, p.y);
    this.wheelAcc = 0;
  };

  private preventMenu = (e: Event): void => e.preventDefault();

  // ── Pincel ───────────────────────────────────────────────────────

  private beginBrush(): void {
    this.clearBrushTimer();
    if (this.mode !== 'brush-pending') return;
    this.mode = 'brush';
    this.on.brush('start', this.brushStart.x, this.brushStart.y);
  }

  private clearBrushTimer(): void {
    if (this.brushTimer !== null) {
      clearTimeout(this.brushTimer);
      this.brushTimer = null;
    }
  }

  // ── Dos dedos ────────────────────────────────────────────────────

  private startGesture(): void {
    this.clearBrushTimer();
    if (this.mode === 'brush') this.on.brush('cancel', 0, 0);
    this.mode = 'gesture';
    const [a, b] = this.firstTwo();
    this.gestureMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pinchBase = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    this.resetVelocity();
  }

  private updateGesture(time: number): void {
    if (this.pointers.size < 2) return;
    const [a, b] = this.firstTwo();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = mid.x - this.gestureMid.x, dy = mid.y - this.gestureMid.y;
    this.gestureMid = mid;
    this.on.pan(dx, dy);
    this.trackVelocity(dx, dy, time);

    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const ratio = dist / this.pinchBase;
    if (ratio >= PINCH_STEP || ratio <= 1 / PINCH_STEP) {
      this.on.zoom(ratio > 1 ? 1 : -1, mid.x, mid.y);
      this.pinchBase = dist;
    }
  }

  private firstTwo(): [Tracked, Tracked] {
    const it = this.pointers.values();
    return [it.next().value as Tracked, it.next().value as Tracked];
  }

  // ── Inercia ──────────────────────────────────────────────────────

  private resetVelocity(): void {
    this.velocity = { x: 0, y: 0, time: performance.now() };
  }

  /** Media móvil de la velocidad del arrastre (px/ms) */
  private trackVelocity(dx: number, dy: number, time: number): void {
    const dt = Math.max(1, time - this.velocity.time);
    const k = 0.6;
    this.velocity.x = this.velocity.x * (1 - k) + (dx / dt) * k;
    this.velocity.y = this.velocity.y * (1 - k) + (dy / dt) * k;
    this.velocity.time = time;
  }

  private releasePan(time: number): void {
    // Si el dedo se quedó quieto antes de soltar, no hay inercia
    const still = time - this.velocity.time > 80;
    if (!still) this.on.fling(this.velocity.x, this.velocity.y);
    // Si queda un dedo apoyado no se reanuda el pincel: el gesto termina cuando se levantan todos
    this.mode = 'idle';
  }

  // ── Utilidades ───────────────────────────────────────────────────

  private trackMouse(p: Tracked): void {
    const nearEdge = (q: Tracked): boolean =>
      q.x < EDGE_BAND_PX || q.y < EDGE_BAND_PX ||
      q.x > this.el.clientWidth - EDGE_BAND_PX || q.y > this.el.clientHeight - EDGE_BAND_PX;
    // El contador de espera se reinicia cada vez que el ratón entra en la banda del borde
    if (!this.mouse.inside || (nearEdge(p) && !nearEdge(this.mouse))) this.mouse.since = performance.now();
    this.mouse = { x: p.x, y: p.y, inside: true, since: this.mouse.since };
  }

  private local(e: MouseEvent): Tracked {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
SANDWORLD_EOF

cat > src/app/games/sandworld/rendering/sands/grain-particles.ts <<'SANDWORLD_EOF'
import { Container, Sprite, Texture } from 'pixi.js';

/** Granos que caen por segundo mientras el dedo vierte */
const GRAINS_PER_SECOND = 80;
/** Altura (px de mundo) desde la que caen */
const DROP_HEIGHT = 34;
const GRAVITY = 0.0009;   // px/ms²
const POOL = 160;

interface Grain {
  sprite: Sprite;
  x: number;
  y: number;
  vy: number;
  groundY: number;
  bounced: boolean;
  life: number;
}

/**
 * Granos de arena que caen sobre el terreno mientras se vierte (decorativo).
 * Usa siempre los mismos sprites (un grupo fijo): no crea objetos nuevos por grano.
 */
export class GrainParticles {
  readonly view = new Container();
  private readonly free: Sprite[] = [];
  private readonly live: Grain[] = [];
  private carry = 0;
  private seed = 1;

  constructor() {
    this.view.zIndex = 9_500;
    for (let i = 0; i < POOL; i++) {
      const s = new Sprite(Texture.WHITE);
      s.width = 1;
      s.height = 1;
      s.visible = false;
      this.view.addChild(s);
      this.free.push(s);
    }
  }

  /** Emite granos sobre un punto del mundo (la superficie de la zona donde cae la arena) */
  emit(x: number, groundY: number, color: number, dtMs: number): void {
    this.carry += (GRAINS_PER_SECOND * dtMs) / 1000;
    while (this.carry >= 1 && this.free.length) {
      this.carry -= 1;
      const s = this.free.pop()!;
      // Mezcla de granos claros y oscuros para que el chorro se lea sobre cualquier suelo (también sobre arena)
      const r = this.rand();
      s.tint = r < 0.2 ? 0xffffff : r < 0.55 ? darken(color, 0.4) : color;
      const big = this.rand() < 0.45;
      s.width = big ? 2 : 1;
      s.height = 2;
      s.alpha = 1;
      s.visible = true;
      const gx = x + Math.round((this.rand() - 0.5) * 8);
      const gy = groundY + Math.round((this.rand() - 0.5) * 6);
      this.live.push({ sprite: s, x: gx, y: gy - DROP_HEIGHT - this.rand() * 10, vy: 0.02, groundY: gy, bounced: false, life: 0 });
    }
    if (this.carry > 3) this.carry = 3;
  }

  update(dtMs: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const g = this.live[i];
      g.life += dtMs;
      g.vy += GRAVITY * dtMs;
      g.y += g.vy * dtMs;
      if (g.y >= g.groundY) {
        if (!g.bounced) {
          // Pequeño rebote al tocar el suelo
          g.bounced = true;
          g.y = g.groundY;
          g.vy = -0.06;
          g.x += this.rand() < 0.5 ? -1 : 1;
        } else {
          g.sprite.visible = false;
          this.free.push(g.sprite);
          this.live.splice(i, 1);
          continue;
        }
      }
      g.sprite.position.set(Math.round(g.x), Math.round(g.y));
    }
  }

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}

/** Oscurece un color 0xRRGGBB una fracción */
function darken(c: number, f: number): number {
  const k = 1 - f;
  return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
}
SANDWORLD_EOF

cat > src/app/games/sandworld/rendering/terrain/chunk-baker.ts <<'SANDWORLD_EOF'
import { ChunkData, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Biome, BiomeId } from '../../domain/models/biome.model';
import { Material, MaterialId } from '../../domain/models/material.model';
import { MATERIAL_DEFS } from '../../config/materials.config';
import { MASSLESS_SANDS, SAND_COLOR_NUM } from '../../config/sands.config';
import { SAND_ORDER } from '../../domain/models/sand.model';
import { WORLD } from '../../domain/models/world.model';
import { TERRAIN_RAMPS, TERRAIN_WALLS, WATERFALL } from '../../config/palette.config';
import { clamp, fbm, hash2, valueNoise } from '../../application/world/noise';

/*
  Horneado del terreno de un chunk en un buffer RGBA (función pura: sin Pixi ni DOM, testeable en Node).

  Cómo funciona:
  1. Se muestrea el chunk a 1 píxel de pantalla (20 muestras por tile y eje).
  2. Para cada muestra se calcula su terraza: la altura continua de las celdas, interpolada y cuantizada
     en niveles, con el contorno deformado por ruido para que no siga la cuadrícula.
  3. Se pinta de atrás hacia delante: cada muestra pone su píxel superior y una columna de pared
     solo hasta donde la tapa la muestra de delante.
*/

const N = WORLD.TILES;
const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
const TW = WORLD.TILE_W;
const TH = WORLD.TILE_H;
const STEP = WORLD.LEVEL_PX;
const MAXL = WORLD.MAX_LEVEL;
const DEPTH = WORLD.BASE_DEPTH;

/** Muestras por tile y eje (1 píxel en pantalla) */
const S = 20;
/** Muestras por lado del chunk */
const M = N * S + 1;
/** Agua mínima (en niveles) para considerarse lámina visible (lago o charco) */
const WET = 0.06;
/** Agua mínima para dibujar un arroyo: lámina fina que corre sobre la terraza */
const STREAM = 0.006;
/** Agua caída por el borde (en el último minuto) a partir de la cual se dibuja la cascada al mar de nubes */
const DRAIN = 0.0005;
/** Profundidad mínima para dibujar un lago (por debajo es arroyo o charco fino) */
const LAKE_MIN_DEPTH = 0.1;
/** La lámina de un lago se dibuja este tanto por debajo de su terraza: queda una orilla de 1 px (se lee hundido) */
const WATER_INSET = 0.2;
/** Arena pendiente (en niveles) a partir de la cual la capa sin asentar se ve completamente cubierta */
const PENDING_FULL = 0.6;
/** Muestras de agua que oscurece la sombra de la orilla de atrás */
const BANK_SHADOW = 3;

/** Margen superior para que quepan las terrazas más altas */
const TOP_MARGIN = (MAXL + 3) * STEP + 2;

/** Tamaño del buffer horneado y dónde cae el centro del tile (0,0) dentro de él */
export const BAKE_WIDTH = N * TW;
export const BAKE_HEIGHT = TOP_MARGIN + N * TH + DEPTH + 6;
export const BAKE_ORIGIN_X = BAKE_WIDTH / 2;
export const BAKE_ORIGIN_Y = TOP_MARGIN + TH / 2;

type Ramp = readonly number[];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)];

const shade = (ramp: Ramp, val: number, px: number, py: number): number =>
  ramp[clamp(Math.floor(val * (ramp.length - 1) + bayer(px, py)), 0, ramp.length - 1)];

const darken = (c: number, f: number): number =>
  (Math.round((c >> 16) * (1 - f)) << 16) | (Math.round(((c >> 8) & 255) * (1 - f)) << 8) | Math.round((c & 255) * (1 - f));

const lighten = (c: number, f: number): number => {
  const r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r + (255 - r) * f) << 16) | (Math.round(g + (255 - g) * f) << 8) | Math.round(b + (255 - b) * f);
};

const LAND_RAMP: Record<BiomeId, Ramp> = {
  [Biome.FOREST]: TERRAIN_RAMPS.forest,
  [Biome.DESERT]: TERRAIN_RAMPS.desert,
  [Biome.TUNDRA]: TERRAIN_RAMPS.tundra,
  [Biome.WETLAND]: TERRAIN_RAMPS.marsh,
};

const WALL: Record<BiomeId, readonly number[]> = {
  [Biome.FOREST]: TERRAIN_WALLS.forest,
  [Biome.DESERT]: TERRAIN_WALLS.desert,
  [Biome.TUNDRA]: TERRAIN_WALLS.tundra,
  [Biome.WETLAND]: TERRAIN_WALLS.forest,
};

/** Rampa y paredes de cada material, leídas del registro (sin rampa: la del bioma) */
const RAMPS = TERRAIN_RAMPS as unknown as Record<string, Ramp>;
const WALLS = TERRAIN_WALLS as unknown as Record<string, readonly number[]>;
const MATERIAL_RAMP: Partial<Record<MaterialId, Ramp>> = {};
const MATERIAL_WALL: Partial<Record<MaterialId, readonly number[]>> = {};
for (const [id, def] of Object.entries(MATERIAL_DEFS)) {
  const m = Number(id) as MaterialId;
  if (m === Material.ROCK) continue;               // la roca a la vista se decide aparte (sin sedimento)
  if (def.ramp) MATERIAL_RAMP[m] = RAMPS[def.ramp];
  if (def.wall) MATERIAL_WALL[m] = WALLS[def.wall];
}

/** Roca a la vista */
const ROCK_RAMP: Ramp = RAMPS[MATERIAL_DEFS[Material.ROCK].ramp ?? 'gravel'];

/** Sedimento mínimo (en niveles) para que se vea el color del material */
const MATERIAL_VISIBLE = 0.02;

/** Rejillas que solo dependen de la semilla: se calculan una vez y se reutilizan en cada horneado */
interface StaticGrids {
  inside: Uint8Array;     // dentro del contorno irregular de la isla
  warp: Float32Array;     // deformación del contorno de las terrazas
  bioTile: Uint16Array;   // tile del que toma el bioma cada muestra (desplazado con ruido → bordes orgánicos)
  texture: Float32Array;  // variación de luz para que la superficie no sea plana
}

export class ChunkBaker {
  private readonly grids: StaticGrids;

  // Rejillas de trabajo reutilizadas entre horneados (evita crear arrays en cada frame)
  private readonly sLvl = new Int8Array(M * M);
  private readonly sSurf = new Float32Array(M * M);
  private readonly sWet = new Uint8Array(M * M);
  private readonly sGround = new Float32Array(M * M);
  private readonly sDepth = new Float32Array(M * M);
  private readonly sShore = new Float32Array(M * M);
  private readonly sWaterSurf = new Float32Array(M * M);
  private readonly sStream = new Uint8Array(M * M);
  private readonly sDrain = new Uint8Array(M * M);
  private readonly streamArr = new Float32Array(C * C);
  private readonly drainArr = new Float32Array(C * C);
  private readonly gArr = new Float32Array(C * C);
  private readonly wsArr = new Float32Array(C * C);
  private readonly wetArr = new Float32Array(C * C);
  private readonly shoreDist = new Float32Array(C * C);

  /**
   * Qué celda pintó cada píxel del último horneado (índice + 1; 0 = vacío).
   * Da un picking exacto al píxel: tocar una pared o el agua selecciona la celda que se ve ahí.
   */
  private readonly owner = new Uint16Array(BAKE_WIDTH * BAKE_HEIGHT);

  constructor(private readonly seed: number) {
    this.grids = this.buildStaticGrids();
  }

  /** Hornea el chunk en `out` (RGBA, BAKE_WIDTH × BAKE_HEIGHT). Los píxeles fuera de la isla quedan transparentes. */
  bake(chunk: ChunkData, out: Uint8ClampedArray): void {
    out.fill(0);
    this.owner.fill(0);
    this.prepareCellArrays(chunk);
    this.prepareSamples();
    this.paint(chunk, out);
  }

  /** Celda (índice local) visible en el píxel (px, py) del buffer horneado, o -1 si no hay terreno */
  pickCell(px: number, py: number): number {
    const x = Math.floor(px), y = Math.floor(py);
    if (x < 0 || y < 0 || x >= BAKE_WIDTH || y >= BAKE_HEIGHT) return -1;
    return this.owner[y * BAKE_WIDTH + x] - 1;
  }

  /** Altura visible (terraza o lámina de agua, en niveles) en el centro de una celda, según el último horneado */
  surfaceAtCell(ci: number, cj: number): number {
    const a = Math.round((ci + 0.5) * S / G);
    const b = Math.round((cj + 0.5) * S / G);
    return this.sSurf[clamp(b, 0, M - 1) * M + clamp(a, 0, M - 1)];
  }

  // ── 1. Rejillas estáticas ─────────────────────────────────────────

  private buildStaticGrids(): StaticGrids {
    const seed = this.seed;
    const inside = new Uint8Array(M * M);
    const warp = new Float32Array(M * M);
    const bioTile = new Uint16Array(M * M);
    const texture = new Float32Array(M * M);

    // Contorno irregular de la isla: cada borde se come entre 0 y ~0.22 tiles
    const jag = (t: number, k: number): number => 0.22 * valueNoise(t * 1.8 + k * 17.3, k * 3.1, seed + 99);

    for (let b = 0; b < M; b++) {
      for (let a = 0; a < M; a++) {
        const u = -0.5 + a / S;
        const v = -0.5 + b / S;
        const q = b * M + a;
        inside[q] =
          u > -0.5 + jag(v, 1) && u < N - 0.5 - jag(v, 2) && v > -0.5 + jag(u, 3) && v < N - 0.5 - jag(u, 4) ? 1 : 0;
        warp[q] = (valueNoise(u * 1.7, v * 1.7, seed + 40) - 0.5) * 0.35;
        const bu = u + (valueNoise(u * 2.3, v * 2.3, seed + 1) - 0.5) * 0.6;
        const bv = v + (valueNoise(u * 2.3, v * 2.3, seed + 2) - 0.5) * 0.6;
        bioTile[q] = tileIndex(clamp(Math.round(bu), 0, N - 1), clamp(Math.round(bv), 0, N - 1));
        texture[q] = (valueNoise(u * 5, v * 5, seed + 4) - 0.5) * 0.25 + (fbm(u * 0.8, v * 0.8, seed + 3) - 0.5) * 0.4;
      }
    }
    return { inside, warp, bioTile, texture };
  }

  // ── 2. Datos por celda ────────────────────────────────────────────

  private prepareCellArrays(chunk: ChunkData): void {
    for (let k = 0; k < C * C; k++) {
      const g = groundAt(chunk, k);
      const wet = chunk.water[k] > WET;
      this.gArr[k] = g;
      this.wetArr[k] = wet ? 1 : 0;
      this.wsArr[k] = wet ? g + chunk.water[k] : 0;
      this.streamArr[k] = chunk.water[k] > STREAM ? 1 : 0;
      this.drainArr[k] = chunk.drain[k] > DRAIN ? 1 : 0;
    }
    this.computeShoreDistance();
  }

  /** Distancia (en celdas) al agua más cercana: sirve para pintar orillas de arena o grava */
  private computeShoreDistance(): void {
    const d = this.shoreDist;
    for (let k = 0; k < C * C; k++) d[k] = this.wetArr[k] ? 0 : 99;
    for (let pass = 0; pass < 2; pass++) {
      for (let cj = 0; cj < C; cj++) {
        for (let ci = 0; ci < C; ci++) {
          const k = cellIndex(ci, cj);
          if (ci > 0) d[k] = Math.min(d[k], d[k - 1] + 1);
          if (cj > 0) d[k] = Math.min(d[k], d[k - C] + 1);
        }
      }
      for (let cj = C - 1; cj >= 0; cj--) {
        for (let ci = C - 1; ci >= 0; ci--) {
          const k = cellIndex(ci, cj);
          if (ci < C - 1) d[k] = Math.min(d[k], d[k + 1] + 1);
          if (cj < C - 1) d[k] = Math.min(d[k], d[k + C] + 1);
        }
      }
    }
  }

  /** Interpolación bilineal de un array de celdas en un punto (u, v) en coordenadas de tile */
  private bilinear(arr: Float32Array, u: number, v: number): number {
    const x = clamp((u + 0.5) * G - 0.5, 0, C - 1);
    const y = clamp((v + 0.5) * G - 0.5, 0, C - 1);
    const i0 = x | 0, j0 = y | 0;
    const i1 = i0 < C - 1 ? i0 + 1 : i0;
    const j1 = j0 < C - 1 ? j0 + 1 : j0;
    const fa = x - i0, fb = y - j0;
    return (arr[j0 * C + i0] * (1 - fa) + arr[j0 * C + i1] * fa) * (1 - fb) +
           (arr[j1 * C + i0] * (1 - fa) + arr[j1 * C + i1] * fa) * fb;
  }

  // ── 3. Datos por muestra (terraza, agua, orilla) ──────────────────

  private prepareSamples(): void {
    const { inside, warp } = this.grids;
    for (let b = 0; b < M; b++) {
      for (let a = 0; a < M; a++) {
        const q = b * M + a;
        if (!inside[q]) continue;
        const u = -0.5 + a / S;
        const v = -0.5 + b / S;
        const g = this.bilinear(this.gArr, u, v);
        const lvl = clamp(Math.floor(g + warp[q]), 0, MAXL);
        this.sLvl[q] = lvl;
        this.sGround[q] = g;
        this.sShore[q] = this.bilinear(this.shoreDist, u, v);

        const wetFraction = this.bilinear(this.wetArr, u, v);
        const waterSurf = wetFraction > 0 ? this.bilinear(this.wsArr, u, v) / wetFraction : 0;
        this.sWaterSurf[q] = waterSurf;
        // Lagos: la lámina se dibuja en el nivel de terraza que le corresponde (nunca a media altura)
        // y un poco por debajo de él. Así un lago es plano, queda hundido entre sus orillas y solo hay
        // escalones de agua donde el agua cae de verdad.
        if (wetFraction > 0.5 && waterSurf - g > LAKE_MIN_DEPTH) {
          const drawn = Math.max(lvl, Math.floor(waterSurf - 0.15));
          this.sWet[q] = 1;
          this.sSurf[q] = drawn - WATER_INSET;
          this.sDepth[q] = waterSurf - g;
        } else {
          this.sWet[q] = 0;
          this.sSurf[q] = lvl;
          this.sDepth[q] = 0;
        }
        // Arroyo: agua fina sobre la terraza (no sube la superficie, solo cambia el color y cae por las paredes)
        this.sStream[q] = this.sWet[q] === 0 && this.bilinear(this.streamArr, u, v) > 0.45 ? 1 : 0;
        this.sDrain[q] = this.bilinear(this.drainArr, u, v) > 0.3 ? 1 : 0;
      }
    }
  }

  /**
   * Distancia (en muestras, 1..BANK_SHADOW) a la orilla de atrás de un lago, o 0 si no hay orilla cerca.
   * "Atrás" en isométrica es arriba en pantalla: las muestras con a-1, b-1 o ambas.
   */
  private bankShadow(a: number, b: number): number {
    const level = this.sSurf[b * M + a];
    for (let d = 1; d <= BANK_SHADOW; d++) {
      for (const [da, db] of [[-d, 0], [0, -d], [-d, -d]] as const) {
        const na = a + da, nb = b + db;
        if (na < 0 || nb < 0) continue;
        const nq = nb * M + na;
        if (!this.grids.inside[nq]) continue;
        if (this.sWet[nq] === 0 && this.sSurf[nq] > level) return d;
      }
    }
    return 0;
  }

  // ── 4. Pintado de atrás hacia delante ─────────────────────────────

  private paint(chunk: ChunkData, out: Uint8ClampedArray): void {
    const { inside, bioTile, texture } = this.grids;
    const owner = this.owner;
    let cell = 0;                                         // celda de la muestra que se está pintando (+1)
    const put = (px: number, py: number, c: number): void => {
      if (px < 0 || py < 0 || px >= BAKE_WIDTH || py >= BAKE_HEIGHT) return;
      owner[py * BAKE_WIDTH + px] = cell;
      const k = (py * BAKE_WIDTH + px) * 4;
      out[k] = c >> 16;
      out[k + 1] = (c >> 8) & 255;
      out[k + 2] = c & 255;
      out[k + 3] = 255;
    };

    for (let s = 0; s <= 2 * (M - 1); s++) {
      for (let a = Math.max(0, s - (M - 1)); a <= Math.min(M - 1, s); a++) {
        const b = s - a;
        const q = b * M + a;
        if (!inside[q]) continue;

        const u = -0.5 + a / S;
        const v = -0.5 + b / S;
        cell = cellIndex(clamp(Math.floor((u + 0.5) * G), 0, C - 1), clamp(Math.floor((v + 0.5) * G), 0, C - 1)) + 1;
        const lvl = this.sLvl[q];
        const isWet = this.sWet[q] === 1;
        const isStream = this.sStream[q] === 1;
        const surf = this.sSurf[q];
        const px = Math.round(BAKE_ORIGIN_X + (u - v) * TW / 2);
        const base = BAKE_ORIGIN_Y + (u + v) * TH / 2;
        const py = Math.round(base - surf * STEP);

        // Vecinos de delante (derecha-abajo, izquierda-abajo y justo debajo en pantalla)
        const qR = a + 1 < M ? q + 1 : q;
        const qL = b + 1 < M ? q + M : q;
        const qF = a + 1 < M && b + 1 < M ? q + M + 1 : q;
        const edgeR = !inside[qR];
        const edgeL = !inside[qL];
        const edgeF = edgeR || edgeL || !inside[qF];
        const frontLvl = Math.min(edgeR ? -9 : this.sLvl[qR], edgeL ? -9 : this.sLvl[qL]);

        const biome = chunk.biome[bioTile[q]] as BiomeId;
        const tex = texture[q];
        // Sin sedimento encima, lo que se ve es la roca madre (roquedal, laderas lavadas)
        const bareRock = chunk.sediment[cell - 1] <= MATERIAL_VISIBLE;
        const material = bareRock ? Material.ROCK : chunk.material[cell - 1] as MaterialId;
        const materialRamp = bareRock ? ROCK_RAMP : MATERIAL_RAMP[material];

        // Cara superior
        let color: number;
        if (isStream) {
          // Arroyo o agua fina: misma agua que los lagos, algo más clara, con destellos sueltos
          color = shade(TERRAIN_RAMPS.water, clamp(0.72 + tex * 0.8), px, py);
          if (hash2(px, py, 23) < 0.04) color = TERRAIN_RAMPS.shallow[3];
        } else if (isWet) {
          // Más oscuro cuanto más hondo; sin reborde claro (el reborde claro hacía que el lago pareciera elevado)
          const depth = this.sDepth[q];
          let val = 0.78 - clamp(depth / 1.0) * 0.65 + tex * 0.6;
          // Sombra de la orilla de atrás: franja oscura junto al borde superior del lago
          const shadowAt = this.bankShadow(a, b);
          if (shadowAt > 0) val -= 0.35 * (1 - (shadowAt - 1) / BANK_SHADOW);
          color = shade(TERRAIN_RAMPS.water, clamp(val), px, py);
          // Destellos sueltos lejos de la orilla
          if (shadowAt === 0 && hash2(px, py, 29) < 0.012) color = TERRAIN_RAMPS.water[4];
        } else {
          const g = this.sGround[q];
          const slope = (this.bilinear(this.gArr, u + 0.2, v) - this.bilinear(this.gArr, u - 0.2, v)) +
                        (this.bilinear(this.gArr, u, v + 0.2) - this.bilinear(this.gArr, u, v - 0.2)) * 0.35;
          const val = 0.3 + lvl * 0.05 - slope * 0.35 + (g - lvl) * 0.25 + tex;
          let ramp: Ramp = materialRamp ?? LAND_RAMP[biome];
          // Orilla: arena seca, arena mojada o grava (tundra) cerca del agua y a su misma altura
          const shore = this.sShore[q] + tex * 1.5;
          if (!materialRamp && shore < 1.5 && lvl <= Math.floor(this.sWaterSurf[q] + 0.6)) {
            ramp = biome === Biome.TUNDRA ? TERRAIN_RAMPS.gravel : shore < 0.8 ? TERRAIN_RAMPS.wetsand : TERRAIN_RAMPS.sand;
          }
          color = shade(ramp, clamp(val), px, py);
          // Briznas sueltas en la hierba
          if (ramp === TERRAIN_RAMPS.forest) {
            const r = hash2(px, py, 11);
            if (r < 0.015) color = TERRAIN_RAMPS.forest[4];
            else if (r > 0.988) color = TERRAIN_RAMPS.forest[0];
          }
          // Borde iluminado de la terraza
          if (frontLvl < lvl && frontLvl > -9) color = lighten(color, 0.22);
        }
        // Capa sin asentar: granos sueltos del color de la arena (o destellos si no tiene masa),
        // más densos cuanta más arena queda por asentar
        const pendingSand = chunk.pendingSand[cell - 1];
        if (pendingSand > 0 && !isWet) {
          const density = clamp(chunk.pending[cell - 1] / PENDING_FULL);
          const sandColor = SAND_COLOR_NUM[pendingSand - 1];
          const massless = MASSLESS_SANDS.includes(SAND_ORDER[pendingSand - 1]);
          const r = hash2(px, py, 41);
          if (massless) {
            if (r < density * 0.18) color = lighten(sandColor, 0.5);
          } else if (r < density * 0.85) {
            color = r < density * 0.25 ? lighten(sandColor, 0.3) : r < density * 0.6 ? sandColor : darken(sandColor, 0.2);
          }
        }
        put(px, py, color);

        // Pared: solo hasta la superficie de la muestra de delante (o hasta la base en el borde de la isla)
        const frontSurf = edgeF ? -DEPTH / STEP - 1 : Math.min(this.sSurf[qR], this.sSurf[qL], this.sSurf[qF]);
        const drop = Math.round((surf - frontSurf) * STEP) + 1;
        if (drop <= 1) continue;

        const bottom = edgeF ? Math.round(base + DEPTH + (valueNoise(px * 0.15, 0, this.seed + 21) - 0.5) * 4) : py + drop;
        // Cascada: el arroyo cae por la pared de la terraza; en el borde de la isla, hasta el mar de nubes
        const edgeFall = edgeF && this.sDrain[q] === 1 && (isWet || isStream);
        const wall = bareRock ? TERRAIN_WALLS.rock
          : MATERIAL_WALL[material] ?? (lvl >= 5 && biome !== Biome.TUNDRA ? TERRAIN_WALLS.rock : WALL[biome]);
        const leftFace = (edgeL ? -9 : this.sLvl[qL]) <= (edgeR ? -9 : this.sLvl[qR]);
        const waterPx = edgeFall ? bottom - py : isStream ? drop : isWet ? Math.round((surf - lvl) * STEP) : 0;

        for (let y = py + 1, d = 1; y <= bottom; y++, d++) {
          let wc: number;
          if (d <= waterPx) {
            // Espuma solo en cascadas de verdad; si el desnivel es pequeño, agua normal
            wc = drop > STEP + 1 || edgeFall ? WATERFALL[(y + px + 999) % 3] : TERRAIN_RAMPS.water[2];
          } else {
            const dd = d - waterPx;
            if (dd <= 1 && !isWet) {
              wc = wall[0];                                     // labio de hierba o arena
            } else {
              const t = clamp((dd - 1) / 14) + (bayer(px, y) - 0.5) * 0.35;
              wc = t < 0.4 ? wall[1] : t < 0.75 ? wall[2] : wall[3];
              if ((Math.round(base) - y) % STEP === 0) wc = darken(wc, 0.12);   // estratos
            }
          }
          put(px, y, leftFace ? wc : darken(wc, 0.18));        // la cara derecha queda en sombra
        }
        // Espuma al pie de la cascada del borde, sobre las nubes
        if (edgeFall) {
          for (let f = 1; f <= 3; f++) {
            if (hash2(px, f, 31) < 0.8 - f * 0.2) put(px + ((f & 1) ? 0 : (hash2(px, f, 32) < 0.5 ? -1 : 1)), bottom + f, WATERFALL[f === 1 ? 0 : 1]);
          }
        }
      }
    }
  }
}
SANDWORLD_EOF

cat > src/app/games/sandworld/sandworld-runtime.ts <<'SANDWORLD_EOF'
import { Ticker } from 'pixi.js';
import { PixiStage } from './rendering/pixi-stage';
import { TerrainLayer } from './rendering/terrain/terrain-layer';
import { Camera, Rect } from './rendering/camera';
import { BrushArea, CellCursor } from './rendering/cell-cursor';
import { GrainParticles } from './rendering/sands/grain-particles';
import { DaylightLayer } from './rendering/daylight-layer';
import { CloudLayer } from './rendering/clouds/cloud-layer';
import { RevealEffect } from './rendering/clouds/reveal-effect';
import { isoToWorld } from './rendering/iso';
import { PointerInput } from './infrastructure/input/pointer-input';
import { TimeEngine } from './application/time/time-engine';
import { World } from './application/world/world';
import { WORLD } from './domain/models/world.model';
import { BRUSH_CELLS } from './config/brush.config';
import { CLOUD_CAMERA_MARGIN, REVEAL_ON_START } from './config/clouds.config';
import { REBAKE_INTERVAL_MS } from './config/physics.config';
import { POUR_EDGE_BAND, POUR_TAP_SECONDS } from './config/pour.config';
import { ChunkCoord } from './domain/events/game-events';

/** Avisos del runtime hacia fuera (el componente los conecta con el servicio) */
export interface RuntimeHooks {
  /** Cada frame, con el tiempo real actual en ms */
  frame?(nowMs: number): void;
  /** Toque sobre la isla sin arena seleccionada */
  islandTap?(): void;
  /** Pincel de arena (lo implementa el servicio) */
  pour?: PourHooks;
}

/** Lo que el runtime necesita del servicio para verter: el runtime sabe dónde está el dedo; el servicio, qué cae */
export interface PourHooks {
  /** El dedo se apoya con una arena elegida */
  begin(): void;
  /** El dedo pasa `seconds` sobre el bloque que empieza en la celda global (gx, gy). Devuelve si cayó arena. */
  at(gx: number, gy: number, seconds: number): boolean;
  /** El dedo se levanta (o entra un segundo dedo): lo vertido pasa a asentarse */
  end(): void;
  /** Color de los granos (el de la arena elegida) */
  color(): number;
}

const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;

/**
 * Raíz de composición del juego en marcha: une motor de tiempo, render, cámara y entrada.
 * El componente Angular solo crea esto, lo monta y lo destruye.
 * Cada frame: avanza el tiempo → mueve la cámara → nubes y apariciones → luz del día.
 */
export class SandworldRuntime {
  private readonly stage = new PixiStage();
  private readonly camera = new Camera();
  private readonly cursor = new CellCursor();
  private readonly grains = new GrainParticles();
  /** Punto de pantalla donde está el dedo que vierte, o null si no se está vertiendo */
  private brushPoint: { x: number; y: number } | null = null;
  private readonly terrains = new Map<string, TerrainLayer>();
  private readonly reveals: RevealEffect[] = [];
  /** Chunks con el terreno cambiado pendientes de re-hornear, y cuándo se hornearon por última vez */
  private readonly dirty = new Set<string>();
  private readonly lastBake = new Map<string, number>();
  private now = 0;
  private clouds: CloudLayer | null = null;
  private daylight: DaylightLayer | null = null;
  private input: PointerInput | null = null;
  private destroyed = false;
  /** true cuando hay una arena seleccionada. Sin arena, 1 dedo mueve la cámara. */
  private brushEnabled = false;

  constructor(
    private readonly engine: TimeEngine,
    private readonly world: World,
    private readonly hooks: RuntimeHooks = {},
  ) {}

  /** Devuelve false si se destruyó antes de terminar de cargar */
  async mount(host: HTMLElement): Promise<boolean> {
    const app = await this.stage.mount(host, (w, h) => this.camera.setViewport(w, h));
    if (!app || this.destroyed) return false;

    // Mar de nubes detrás de todo; la isla flota encima
    this.clouds = new CloudLayer(this.world.seed);
    this.stage.world.addChild(this.clouds.back, this.cursor.view, this.grains.view);

    // Chunks ya descubiertos (en la fase 5 vendrán de la partida guardada)
    for (const { cx, cy } of this.world.exploration.list()) {
      this.addChunk(cx, cy, REVEAL_ON_START);
    }

    this.camera.setViewport(app.screen.width, app.screen.height);
    this.camera.setBounds(this.discoveredBounds(0));
    this.camera.fit();
    // Margen para asomarse a las nubes (después de encajar, para no alejar el zoom inicial)
    this.camera.setBounds(this.discoveredBounds(CLOUD_CAMERA_MARGIN));

    this.daylight = new DaylightLayer(color => (app.renderer.background.color = color), this.stage.world);

    this.input = new PointerInput(host, {
      brush: (phase, x, y) => {
        if (phase === 'start') {
          this.brushPoint = { x, y };
          this.hooks.pour?.begin();
          // Un toque corto también deja un pellizco de arena
          this.pourUnderFinger(POUR_TAP_SECONDS * 1000);
        } else if (phase === 'move') {
          this.brushPoint = { x, y };
        } else {
          // 'end' o 'cancel' (segundo dedo): lo vertido hasta ahora se queda y empieza a asentarse
          if (phase === 'end') this.pointAt(x, y);
          this.brushPoint = null;
          this.hooks.pour?.end();
          if (phase === 'cancel') this.cursor.hide();
        }
      },
      hover: (x, y) => this.pointAt(x, y),
      tap: (x, y) => {
        if (this.pointAt(x, y)) this.hooks.islandTap?.();
      },
      leave: () => this.cursor.hide(),
      pan: (dx, dy) => this.camera.panBy(dx, dy),
      fling: (vx, vy) => this.camera.fling(vx, vy),
      zoom: (dir, x, y) => this.camera.zoomStep(dir, x, y),
    }, () => this.brushEnabled);

    app.ticker.add(this.frame);
    this.frame(app.ticker);
    return true;
  }

  /**
   * Muestra un chunk recién descubierto: emerge de las nubes y la cámara se desliza hacia él.
   * Qué se descubre lo decide la lógica (SandworldService.revealNextChunk). La unión sin costuras
   * entre chunks llega en la fase 7.
   */
  showChunk(cx: number, cy: number): void {
    if (!this.clouds || this.terrains.has(chunkKey(cx, cy))) return;
    this.addChunk(cx, cy, true);
    this.camera.setBounds(this.discoveredBounds(CLOUD_CAMERA_MARGIN));
    const N = WORLD.TILES;
    const c = isoToWorld(cx * N + N / 2 - 0.5, cy * N + N / 2 - 0.5);
    this.camera.glideTo(c.x, c.y);
  }

  /** El terreno de estos chunks ha cambiado: se re-hornearán en los próximos frames */
  markDirty(chunks: readonly ChunkCoord[]): void {
    for (const c of chunks) this.dirty.add(chunkKey(c.cx, c.cy));
  }

  setBrushEnabled(enabled: boolean): void {
    this.brushEnabled = enabled;
    if (!enabled) this.cursor.hide();
  }

  pause(): void {
    this.stage.pause();
  }

  resume(): void {
    this.stage.resume();
  }

  destroy(): void {
    this.destroyed = true;
    this.input?.destroy();
    this.input = null;
    for (const r of this.reveals) r.finish();
    this.reveals.length = 0;
    for (const t of this.terrains.values()) t.destroy();
    this.terrains.clear();
    this.clouds?.destroy();
    this.clouds = null;
    this.stage.destroy();
  }

  private frame = (ticker: Ticker): void => {
    const dt = ticker.deltaMS;
    this.now += dt;
    // Primero se dibuja lo que cambió en el frame anterior (p. ej. arena recién caída) y después avanza la física
    this.rebakeDirty();
    this.engine.update(dt);
    // Borde de pantalla: ratón quieto en el borde, o dedo vertiendo en la banda del borde
    const edge = this.input?.edgeVector() ?? { x: 0, y: 0 };
    const pourEdge = this.input?.brushEdgeVector(POUR_EDGE_BAND) ?? { x: 0, y: 0 };
    this.camera.update(dt, { x: edge.x + pourEdge.x, y: edge.y + pourEdge.y });
    // El dedo que vierte sigue vertiendo aunque no se mueva (el tiempo encima de un bloque cuenta)
    if (this.brushPoint) this.pourUnderFinger(dt);
    this.grains.update(dt);
    this.clouds?.update(dt);
    // Apariciones en curso (en tiempo real: siguen aunque el juego esté en pausa)
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      if (this.reveals[i].update(dt)) {
        this.reveals[i].blanket.destroy({ children: true });
        this.reveals.splice(i, 1);
      }
    }
    this.stage.world.scale.set(this.camera.scale);
    this.stage.world.position.set(this.camera.offsetX, this.camera.offsetY);
    this.daylight?.apply(this.engine.exactMinuteOfDay);
    this.hooks.frame?.(ticker.lastTime);
  };

  /** Re-hornea los chunks cambiados, cada uno como mucho cada REBAKE_INTERVAL_MS */
  private rebakeDirty(): void {
    for (const key of this.dirty) {
      const layer = this.terrains.get(key);
      if (!layer) {
        this.dirty.delete(key);
        continue;
      }
      if (this.now - (this.lastBake.get(key) ?? -Infinity) < REBAKE_INTERVAL_MS) continue;
      const [cx, cy] = key.split(',').map(Number);
      layer.render(this.world.chunk(cx, cy));
      this.lastBake.set(key, this.now);
      this.dirty.delete(key);
    }
  }

  /** Hornea un chunk, lo coloca en su orden de dibujo, extiende las nubes y (opcional) lo hace emerger */
  private addChunk(cx: number, cy: number, animate: boolean): void {
    const clouds = this.clouds!;
    const layer = new TerrainLayer(this.world.seed);
    layer.render(this.world.chunk(cx, cy));
    layer.view.zIndex = cx + cy;                   // de atrás hacia delante en isométrica
    this.terrains.set(chunkKey(cx, cy), layer);
    this.stage.world.addChild(layer.view);

    clouds.cover(this.discoveredBounds(0));
    const shadow = clouds.castShadow(cx, cy);

    if (animate) {
      const fx = new RevealEffect(cx, cy, layer.view, shadow, clouds.puffTextures, this.world.seed + cx * 31 + cy * 17);
      this.stage.world.addChild(fx.blanket);
      this.reveals.push(fx);
    }
  }

  /** Rectángulo que ocupan todos los chunks descubiertos, ampliado `margin` px */
  private discoveredBounds(margin: number): Rect {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of this.terrains.values()) {
      const b = t.bounds;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
    }
    return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin };
  }

  /** Vierte durante `dtMs` sobre el bloque bajo el dedo y suelta granos sobre él */
  private pourUnderFinger(dtMs: number): void {
    const pour = this.hooks.pour;
    if (!pour || !this.brushPoint) return;
    const area = this.areaAt(this.brushPoint.x, this.brushPoint.y);
    if (!area) return;
    const C = WORLD.CELLS;
    if (pour.at(area.cx * C + area.ci, area.cy * C + area.cj, dtMs / 1000)) {
      this.grains.emit(this.cursor.view.x, this.cursor.view.y, pour.color(), dtMs);
    }
  }

  /** Coloca el cursor sobre el bloque del pincel bajo un punto de pantalla. Devuelve si hay isla ahí. */
  private pointAt(sx: number, sy: number): boolean {
    return this.areaAt(sx, sy) !== null;
  }

  /** Bloque del pincel bajo un punto de pantalla (y coloca el cursor ahí), o null si no hay isla */
  private areaAt(sx: number, sy: number): BrushArea | null {
    const w = this.camera.screenToWorld(sx, sy);
    // El chunk más cercano a la cámara (mayor cx + cy) tapa a los de detrás
    const layers = [...this.terrains.values()].sort((a, b) => b.view.zIndex - a.view.zIndex);
    let cell = null;
    for (const l of layers) {
      cell = l.pick(w.x, w.y);
      if (cell) break;
    }
    if (!cell) {
      this.cursor.hide();
      return null;
    }
    const area: BrushArea = {
      cx: cell.cx,
      cy: cell.cy,
      ci: Math.floor(cell.ci / BRUSH_CELLS) * BRUSH_CELLS,
      cj: Math.floor(cell.cj / BRUSH_CELLS) * BRUSH_CELLS,
      surface: cell.surface,
    };
    this.cursor.show(area);
    return area;
  }
}
SANDWORLD_EOF

cat > src/app/games/sandworld/sandworld.service.ts <<'SANDWORLD_EOF'
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { SandworldLang, SimSpeed, SIM_SPEEDS } from './domain/models/settings.model';
import { GameTime } from './domain/models/time.model';
import { GameEvents } from './domain/events/game-events';
import { ChronicleDraft, ChronicleEntry } from './domain/models/chronicle.model';
import { SAND_ORDER, SandId } from './domain/models/sand.model';
import { EventBus } from './application/events/event-bus';
import { TimeEngine } from './application/time/time-engine';
import { Chronicle } from './application/chronicle/chronicle';
import { IndicatorRegistry, IndicatorValue } from './application/indicators/indicator-registry';
import { registerWorldIndicators } from './application/indicators/world-indicators';
import { World } from './application/world/world';
import { nextChunkToReveal } from './application/world/expansion';
import { TerrainPhysics } from './application/physics/terrain-physics';
import { Material } from './domain/models/material.model';
import { WORLD } from './domain/models/world.model';
import { ChunkCoord } from './domain/events/game-events';
import { PourQueue, SettledPour } from './application/sands/pour-queue';
import { Stroke } from './application/sands/stroke';
import { SAND_EFFECTS } from './application/sands/sand-effects';
import { SeededRandom } from './infrastructure/seeded-random';
import { SAND_COLOR_NUM } from './config/sands.config';
import { PENDING_REDRAW_MINUTES } from './config/pour.config';
import { Translator } from './i18n/translator';
import { SETTINGS_STORAGE } from './infrastructure/settings-storage.token';
import { DEFAULT_SEED } from './config/world.config';

/** El reloj de la interfaz avanza de 10 en 10 minutos de juego, como en Stardew */
const CLOCK_STEP_MINUTES = 10;
/** Segundos que se ve la etiqueta "Isla viva · Nivel N" */
const ISLAND_LABEL_MS = 3000;

/** Id del panel abierto: el de una tabla del estante (ver ui/organisms/hud/hud-planks.ts) */
export type HudPanel = string;
export type HudMenu = 'settings' | 'chronicle';

/**
 * Estado de la partida que necesita la interfaz y raíz de composición de la lógica.
 * Se provee en el componente raíz (no en 'root'): nace al abrir el juego y muere al cerrarlo.
 * El estado del mundo (celdas, agua, animales) NO va en signals: vive en arrays tipados del dominio.
 */
@Injectable()
export class SandworldService implements OnDestroy {
  private readonly translator = inject(Translator);
  private readonly storage = inject(SETTINGS_STORAGE);

  // ── Lógica de la partida ──
  readonly world = new World(DEFAULT_SEED);
  readonly events = new EventBus<GameEvents>();
  readonly engine = new TimeEngine(this.events);
  readonly chronicle = new Chronicle();
  readonly indicators = new IndicatorRegistry();
  /** Física del terreno: avanza con cada minuto de juego (se para en pausa, acelera a x2/x4) */
  readonly physics = new TerrainPhysics(this.world);
  /** Vertidos asentándose (cada uno tarda 1–2 días de juego) */
  readonly pours = new PourQueue(this.physics, new SeededRandom(this.world.seed * 7919 + 13));
  /** Trazo en curso mientras el dedo vierte */
  private stroke: Stroke | null = null;

  // ── Estado para la interfaz ──
  readonly lang = this.translator.lang.asReadonly();
  readonly speed = signal<SimSpeed>(1);
  /** Pausa elegida por el jugador (los menús pausan aparte, sin tocar esta) */
  readonly isPaused = signal(false);
  readonly isReady = signal(false);
  readonly time = signal<GameTime>(this.engine.time);
  readonly panel = signal<HudPanel | null>(null);
  readonly menu = signal<HudMenu | null>(null);
  readonly selectedSand = signal<SandId | null>(null);
  readonly chronicleEntries = signal<readonly ChronicleEntry[]>([]);
  readonly indicatorValues = signal<readonly IndicatorValue[]>([]);
  readonly islandLabel = signal(false);
  /** Lo que le queda al trazo en curso (1 = botella llena). La botella del estante lo muestra. */
  readonly strokeLeft = signal(1);

  private chronicleRevision = -1;
  private islandLabelTimer: ReturnType<typeof setTimeout> | null = null;
  private hasStoredLang = false;

  constructor() {
    const stored = this.storage.load();
    if (stored.lang) {
      this.translator.setLang(stored.lang);
      this.hasStoredLang = true;
    }

    // Generar el chunk inicial antes de registrar indicadores que lo leen
    this.world.chunk(0, 0);
    registerWorldIndicators(this.indicators, this.world);
    this.refreshIndicators();

    this.events.on('minute', t => {
      if (t.minute % CLOCK_STEP_MINUTES === 0) this.time.set(t);
    });
    this.events.on('hour', () => this.refreshIndicators());
    this.events.on('minute', t => {
      const changed = this.physics.minute();
      if (changed.length) this.events.emit('terrainChanged', changed);
      this.settlePours(t.minute);
    });
    this.events.on('dawn', () => this.log({ type: 'time', key: 'chronicle.dawn' }));
    this.events.on('dusk', () => this.log({ type: 'time', key: 'chronicle.dusk' }));
    this.events.on('newDay', t => this.log({ type: 'time', key: 'chronicle.newDay', params: { day: t.day } }));
    this.events.on('newSeason', t => this.log({ type: 'world', key: `chronicle.newSeason.${t.season}`, priority: 5 }));
  }

  ngOnDestroy(): void {
    this.events.clear();
    if (this.islandLabelTimer) clearTimeout(this.islandLabelTimer);
  }

  /** Llamar cuando el mundo ya se ve en pantalla */
  start(): void {
    this.isReady.set(true);
    this.log({ type: 'world', key: 'chronicle.start', priority: 10 });
    this.showIslandLabel();
  }

  /** Se llama en cada frame con el tiempo real: deja salir mensajes de la cola de la crónica */
  tick(nowMs: number): void {
    this.chronicle.tick(nowMs);
    if (this.chronicle.revision !== this.chronicleRevision) {
      this.chronicleRevision = this.chronicle.revision;
      this.chronicleEntries.set([...this.chronicle.entries]);
    }
  }

  log(draft: ChronicleDraft): void {
    this.chronicle.push(draft, this.engine.time, performance.now());
  }

  // ── Idioma ──

  /** Idioma que propone el OS: solo se aplica si el jugador no eligió otro antes */
  suggestLang(lang: SandworldLang): void {
    if (!this.hasStoredLang) this.translator.setLang(lang);
  }

  setLang(lang: SandworldLang): void {
    this.translator.setLang(lang);
    this.hasStoredLang = true;
    this.storage.save({ ...this.storage.load(), lang });
  }

  // ── Velocidad y pausa ──

  setSpeed(speed: SimSpeed): void {
    this.speed.set(speed);
    this.engine.setSpeed(speed);
  }

  cycleSpeed(): void {
    const i = SIM_SPEEDS.indexOf(this.speed());
    this.setSpeed(SIM_SPEEDS[(i + 1) % SIM_SPEEDS.length]);
  }

  togglePause(): void {
    this.isPaused.update(p => !p);
    this.syncPause();
  }

  // ── Menús y paneles ──

  /** Ajustes y crónica pausan el juego mientras están abiertos */
  openMenu(menu: HudMenu): void {
    this.panel.set(null);
    this.menu.set(menu);
    this.syncPause();
  }

  closeMenu(): void {
    this.menu.set(null);
    this.syncPause();
  }

  /** Los paneles de las tablas no pausan. Solo uno abierto a la vez. */
  togglePanel(panel: HudPanel): void {
    this.panel.update(p => (p === panel ? null : panel));
  }

  closePanel(): void {
    this.panel.set(null);
  }

  /** Elegir una arena activa el pincel; elegir la misma otra vez la suelta */
  selectSand(sand: SandId | null): void {
    this.selectedSand.update(s => (s === sand ? null : sand));
  }

  // ── Pincel de arena ──

  /** El dedo se apoya: empieza un trazo con la arena elegida */
  beginStroke(): void {
    const sand = this.selectedSand();
    this.stroke = sand ? new Stroke(sand) : null;
    this.strokeLeft.set(1);
  }

  /** El dedo pasa `seconds` sobre el bloque de la celda global (gx, gy). Devuelve si cayó arena. */
  pourAt(gx: number, gy: number, seconds: number): boolean {
    const stroke = this.stroke;
    if (!stroke) return false;
    const changed = stroke.pour(gx, gy, seconds);
    if (changed.length === 0) return false;
    this.pours.preview(stroke.sand, changed);
    this.events.emit('terrainChanged', chunksOf(changed));
    // La botella baja de 2 en 2 % (no hace falta avisar a la interfaz en cada frame)
    if (Math.abs(this.strokeLeft() - stroke.remaining) >= 0.02 || stroke.remaining === 0) this.strokeLeft.set(stroke.remaining);
    return true;
  }

  /** El dedo se levanta: lo vertido pasa a la cola y empieza a asentarse */
  endStroke(): void {
    if (this.stroke) this.pours.commit(this.stroke);
    this.stroke = null;
    this.strokeLeft.set(1);
  }

  /** Color de los granos que caen (el de la arena elegida) */
  sandColor(): number {
    const sand = this.stroke?.sand ?? this.selectedSand();
    return sand ? SAND_COLOR_NUM[SAND_ORDER.indexOf(sand)] : 0xffffff;
  }

  /**
   * Cada minuto los vertidos aplican su parte. Las arenas con masa cambian la altura y se redibujan cada minuto;
   * las demás solo adelgazan su capa, así que basta con redibujarlas cada PENDING_REDRAW_MINUTES.
   */
  private settlePours(minute: number): void {
    if (this.pours.active.length === 0) return;
    const redrawAll = minute % PENDING_REDRAW_MINUTES === 0;
    const heavy = this.pours.active.some(p => !SAND_EFFECTS[p.sand].massless);
    const chunks = redrawAll || heavy ? this.pours.chunksWithPours() : null;
    const settled = this.pours.minute();
    if (chunks) this.events.emit('terrainChanged', [...chunks].map(k => {
      const [cx, cy] = k.split(',').map(Number);
      return { cx, cy };
    }));
    for (const s of settled) this.onSettled(s);
  }

  private onSettled(s: SettledPour): void {
    this.events.emit('terrainChanged', chunksOf(s.cells));
    this.log({ type: 'world', key: `chronicle.settled.${s.sand}`, priority: 4 });
  }

  /**
   * Descubre el siguiente chunk bajo las nubes y sube el nivel de la isla.
   * Hoy lo dispara el botón de prueba de Ajustes; en la fase 7, las reglas de expansión.
   */
  revealNextChunk(): void {
    const next = nextChunkToReveal(this.world.exploration);
    if (!next || !this.world.exploration.reveal(next.cx, next.cy)) return;
    this.world.chunk(next.cx, next.cy);
    this.physics.chunkRevealed(next.cx, next.cy);
    this.world.level++;
    this.events.emit('chunkRevealed', next);
    this.log({ type: 'world', key: 'chronicle.reveal', params: { level: this.world.level }, priority: 8 });
    this.refreshIndicators();
    this.showIslandLabel();
  }

  /** TEMPORAL (prueba del bloque 1): deja caer un montón de arena en el centro de la isla inicial */
  debugSandPile(): void {
    for (const [x, y] of [[15, 15], [16, 15], [15, 16], [16, 16]]) this.physics.deposit(x, y, Material.SAND, 4);
    this.events.emit('terrainChanged', [{ cx: 0, cy: 0 }]);
  }

  /** TEMPORAL (prueba del bloque 2): manantial en la cumbre más alta lejos de los que ya hay */
  debugSpring(): void {
    const chunk = this.world.chunk(0, 0);
    const C = Math.round(Math.sqrt(chunk.spring.length));
    const existing = [...chunk.spring].map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0);
    let best = -1, bestH = -Infinity;
    for (let k = 0; k < chunk.spring.length; k++) {
      const x = k % C, y = Math.floor(k / C);
      if (x < 2 || y < 2 || x > C - 3 || y > C - 3) continue;
      if (existing.some(e => Math.hypot((e % C) - x, Math.floor(e / C) - y) < 10)) continue;
      const h = chunk.rock[k] + chunk.sediment[k];
      if (h > bestH) { bestH = h; best = k; }
    }
    if (best >= 0) this.physics.setSpring(best % C, Math.floor(best / C), 0.08);
  }

  showIslandLabel(): void {
    this.islandLabel.set(true);
    if (this.islandLabelTimer) clearTimeout(this.islandLabelTimer);
    this.islandLabelTimer = setTimeout(() => this.islandLabel.set(false), ISLAND_LABEL_MS);
  }

  private syncPause(): void {
    this.engine.setPaused(this.isPaused() || this.menu() !== null);
  }

  private refreshIndicators(): void {
    this.indicatorValues.set(this.indicators.snapshot());
  }
}

/** Chunks (sin repetir) que contienen estas celdas globales */
function chunksOf(cells: readonly (readonly number[])[]): ChunkCoord[] {
  const C = WORLD.CELLS;
  const seen = new Map<string, ChunkCoord>();
  for (const [gx, gy] of cells) {
    const cx = Math.floor(gx / C), cy = Math.floor(gy / C);
    seen.set(`${cx},${cy}`, { cx, cy });
  }
  return [...seen.values()];
}
SANDWORLD_EOF

cat > src/app/games/sandworld/ui/organisms/hud/hud-planks.ts <<'SANDWORLD_EOF'
import { HudPlank } from '../plank-bar/hud-plank.model';
import { SandsPanelComponent } from '../sands-panel/sands-panel';
import { BalancePanelComponent } from '../balance-panel/balance-panel';
import { DecisionsPanelComponent } from '../decisions-panel/decisions-panel';
import { SAND_COLORS } from '../../../config/sands.config';

/**
 * Tablas del estante inferior, en orden de izquierda a derecha.
 * Para añadir una (p. ej. árbol de habilidades):
 *   1. crea su panel en ui/organisms/<nombre>-panel (inyecta SandworldService y usa <sw-sheet>)
 *   2. añade su icono en pixel-icons.ts y sus textos en i18n/es.json y en.json
 *   3. regístrala aquí
 */
export const HUD_PLANKS: readonly HudPlank[] = [
  {
    id: 'sands',
    icon: 'bottle',
    labelKey: 'planks.sands',
    panel: SandsPanelComponent,
    liquid: s => (s.selectedSand ? SAND_COLORS[s.selectedSand] : '#d8b375'),
    // Mientras se vierte, cuánto le queda al trazo
    meter: s => (s.selectedSand && s.strokeLeft < 1 ? s.strokeLeft : null),
  },
  { id: 'balance', icon: 'scale', labelKey: 'planks.balance', panel: BalancePanelComponent },
  { id: 'decisions', icon: 'letter', labelKey: 'planks.decisions', panel: DecisionsPanelComponent },
];
SANDWORLD_EOF

cat > src/app/games/sandworld/ui/organisms/hud/hud.ts <<'SANDWORLD_EOF'
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { SandworldService } from '../../../sandworld.service';
import { HudTopComponent } from '../hud-top/hud-top';
import { PlankBarComponent } from '../plank-bar/plank-bar';
import { SettingsMenuComponent } from '../settings-menu/settings-menu';
import { ChronicleBookComponent } from '../chronicle-book/chronicle-book';
import { IslandLabelComponent } from '../island-label/island-label';
import { SpeedControlComponent } from '../../molecules/speed-control/speed-control';
import { HUD_PLANKS } from './hud-planks';

/**
 * HUD completo sobre el mundo. Lee el estado del servicio y le devuelve las acciones del jugador.
 * El contenedor deja pasar los toques al canvas (pointer-events: none); solo las piezas los capturan.
 * Las tablas del estante y sus paneles salen del registro HUD_PLANKS.
 */
@Component({
  selector: 'sw-hud',
  standalone: true,
  imports: [
    NgComponentOutlet, HudTopComponent, PlankBarComponent, SettingsMenuComponent, ChronicleBookComponent,
    IslandLabelComponent, SpeedControlComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-hud-top
      class="top"
      [time]="game.time()"
      [entries]="game.chronicleEntries()"
      [indicators]="game.indicatorValues()"
      (settings)="game.openMenu('settings')"
      (balance)="game.togglePanel('balance')"
      (chronicle)="game.openMenu('chronicle')"
    />

    @if (game.islandLabel()) {
      <sw-island-label class="label" [level]="game.world.level" />
    }

    <div class="bottom">
      <div class="float">
        @if (openPanel(); as panel) {
          <!-- Envoltorio propio: los componentes creados dinámicamente no reciben los estilos de este HUD -->
          <div class="panel"><ng-container *ngComponentOutlet="panel" /></div>
        } @else {
          <sw-speed-control
            [speed]="game.speed()"
            [paused]="game.isPaused()"
            (cycle)="game.cycleSpeed()"
            (togglePause)="game.togglePause()"
          />
        }
      </div>
      <sw-plank-bar [planks]="planks" [panel]="game.panel()" [selectedSand]="game.selectedSand()" [strokeLeft]="game.strokeLeft()" (toggle)="game.togglePanel($event)" />
    </div>

    @switch (game.menu()) {
      @case ('settings') {
        <sw-settings-menu
          [lang]="game.lang()"
          (langChange)="game.setLang($event)"
          (close)="game.closeMenu()"
          (exit)="exit.emit()"
          (devReveal)="game.closeMenu(); game.revealNextChunk()"
          (devSand)="game.closeMenu(); game.debugSandPile()"
          (devSpring)="game.closeMenu(); game.debugSpring()"
        />
      }
      @case ('chronicle') {
        <sw-chronicle-book [entries]="game.chronicleEntries()" (close)="game.closeMenu()" />
      }
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding-top: max(8px, env(safe-area-inset-top));
      pointer-events: none;
      z-index: 10;
    }
    .top { padding: 0 8px; }
    .label {
      position: absolute;
      top: 132px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .bottom { display: flex; flex-direction: column; gap: 6px; }
    /* Lo que flota sobre el estante: velocidad y pausa, o el panel abierto */
    .float {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0 8px;
    }
    .float > * { pointer-events: auto; }
    /* Los paneles ocupan todo el ancho; velocidad y pausa se quedan a la izquierda */
    .panel { align-self: stretch; }
    sw-plank-bar, sw-settings-menu, sw-chronicle-book { pointer-events: auto; }
  `,
})
export class HudComponent {
  protected readonly game = inject(SandworldService);
  readonly exit = output<void>();

  protected readonly planks = HUD_PLANKS;
  /** Componente del panel abierto, o null */
  protected readonly openPanel = computed(() => HUD_PLANKS.find(p => p.id === this.game.panel())?.panel ?? null);
}
SANDWORLD_EOF

cat > src/app/games/sandworld/ui/organisms/plank-bar/hud-plank.model.ts <<'SANDWORLD_EOF'
import { Type } from '@angular/core';
import { SandId } from '../../../domain/models/sand.model';

/** Estado que algunas tablas usan para su icono (p. ej. la botella toma el color de la arena elegida) */
export interface HudPlankState {
  readonly selectedSand: SandId | null;
  /** Lo que le queda al trazo en curso (1 = lleno) */
  readonly strokeLeft: number;
}

/**
 * Una tabla del estante inferior y el panel que abre.
 * El panel es un organismo que se conecta solo al servicio (no recibe inputs), así añadir una tabla
 * nueva —árbol de habilidades, mapa, bestiario...— es crear su panel y registrarla en HUD_PLANKS.
 */
export interface HudPlank {
  /** Identificador único; también es el id del panel abierto en el servicio */
  readonly id: string;
  /** Icono pixel (ui/atoms/icon/pixel-icons.ts) */
  readonly icon: string;
  /** Clave de traducción del rótulo */
  readonly labelKey: string;
  /** Panel que se abre sobre el estante */
  readonly panel: Type<unknown>;
  /** Color del líquido del icono, si el icono lo tiene (botellas) */
  readonly liquid?: (state: HudPlankState) => string | undefined;
  /** Medidor bajo el icono (0..1), o null para no mostrarlo (la botella mientras se vierte) */
  readonly meter?: (state: HudPlankState) => number | null;
}
SANDWORLD_EOF

cat > src/app/games/sandworld/ui/organisms/plank-bar/plank-bar.ts <<'SANDWORLD_EOF'
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HudPlank } from './hud-plank.model';
import { SandId } from '../../../domain/models/sand.model';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { IconComponent } from '../../atoms/icon/icon';
import { TPipe } from '../../../i18n/t.pipe';

/** Estante inferior: una tabla por cada entrada registrada, repartidas a partes iguales */
@Component({
  selector: 'sw-plank-bar',
  standalone: true,
  imports: [WoodButtonComponent, IconComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--planks]': 'planks().length' },
  template: `
    @for (p of planks(); track p.id) {
      <button swWood variant="plank" class="plank" [active]="panel() === p.id" (click)="toggle.emit(p.id)">
        <sw-icon [name]="p.icon" [scale]="2" [liquid]="p.liquid?.(state())" />
        @let m = p.meter?.(state()) ?? null;
        @if (m !== null) {
          <i class="meter" [style.--fill]="m"></i>
        }
        <span>{{ p.labelKey | t }}</span>
      </button>
    }
  `,
  styles: `
    /* Estante de madera de lado a lado, pegado al borde inferior (no flota) */
    :host {
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--planks, 3), minmax(0, 1fr));
      gap: 4px;
      padding: 6px 6px max(6px, env(safe-area-inset-bottom));
      background:
        repeating-linear-gradient(180deg, transparent 0 5px, rgb(46 26 13 / 0.22) 5px 6px),
        var(--sw-wood-dk);
      border-top: 2px solid var(--sw-edge);
      box-shadow: inset 0 2px 0 var(--sw-wood-dk-soft), 0 -2px 0 rgb(46 26 13 / 0.25);
    }
    /* Clavos del estante en las dos esquinas superiores */
    :host::before, :host::after {
      content: '';
      position: absolute;
      top: 3px;
      width: 2px;
      height: 2px;
      background: #c9c2b0;
      box-shadow: 1px 1px 0 #4f2a15;
    }
    :host::before { left: 2px; }
    :host::after { right: 3px; }
    .plank {
      flex-direction: column;
      gap: 3px;
      min-height: 62px;
      padding: 0 2px 2px;
    }
    /* Medidor pixel bajo el icono: lo que le queda al trazo */
    .meter {
      display: block;
      width: 28px;
      height: 4px;
      background: linear-gradient(90deg, var(--sw-accent) calc(var(--fill) * 100%), rgb(46 26 13 / 0.45) 0);
      box-shadow: 0 0 0 1px var(--sw-edge);
    }
    .plank span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class PlankBarComponent {
  readonly planks = input.required<readonly HudPlank[]>();
  readonly panel = input<string | null>(null);
  readonly selectedSand = input<SandId | null>(null);
  readonly strokeLeft = input(1);
  readonly toggle = output<string>();

  protected readonly state = computed(() => ({ selectedSand: this.selectedSand(), strokeLeft: this.strokeLeft() }));
}
SANDWORLD_EOF

cat > src/app/games/sandworld/ui/organisms/sands-panel/sands-panel.ts <<'SANDWORLD_EOF'
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SAND_ORDER } from '../../../domain/models/sand.model';
import { SandworldService } from '../../../sandworld.service';
import { SheetComponent } from '../../molecules/sheet/sheet';
import { SandBottleComponent } from '../../molecules/sand-bottle/sand-bottle';
import { WoodButtonComponent } from '../../atoms/wood-button/wood-button';
import { TPipe } from '../../../i18n/t.pipe';

/** Panel de Arenas: las 8 botellas. Elegir una activa el pincel; repetir la suelta. */
@Component({
  selector: 'sw-sands-panel',
  standalone: true,
  imports: [SheetComponent, SandBottleComponent, WoodButtonComponent, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sw-sheet [heading]="'sands.title' | t" [closeLabel]="'chronicle.close' | t" (close)="game.closePanel()">
      <div class="grid">
        @for (s of sands; track s) {
          <sw-sand-bottle [sand]="s" [selected]="game.selectedSand() === s" (pick)="game.selectSand($event)" />
        }
      </div>
      <p class="hint">
        @if (game.selectedSand(); as s) {
          <b>{{ 'sands.' + s + '.name' | t }}:</b> {{ 'sands.' + s + '.desc' | t }}
        } @else {
          {{ 'sands.hint' | t }}
        }
      </p>
      @if (game.selectedSand(); as s) {
        <button swWood class="drop" (click)="game.selectSand(s)">{{ 'sands.drop' | t }}</button>
      }
    </sw-sheet>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 4px; }
    .hint { margin: 6px 2px 0; font-size: 13px; min-height: 2.6em; }
    .drop { width: 100%; margin-top: 6px; }
  `,
})
export class SandsPanelComponent {
  protected readonly game = inject(SandworldService);
  protected readonly sands = SAND_ORDER;
}
SANDWORLD_EOF

cat > src/app/games/sandworld/ui/sandworld/sandworld.ts <<'SANDWORLD_EOF'
import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  effect, inject, input, output, viewChild,
} from '@angular/core';
import { SandworldService } from '../../sandworld.service';
import { SandworldRuntime } from '../../sandworld-runtime';
import { SandworldLang } from '../../domain/models/settings.model';
import { Translator } from '../../i18n/translator';
import { SETTINGS_STORAGE } from '../../infrastructure/settings-storage.token';
import { LocalSettingsStorage } from '../../infrastructure/local-settings-storage';
import { HudComponent } from '../organisms/hud/hud';
import { FRAME_VARS } from '../atoms/frame/pixel-frames';

/**
 * Punto de entrada único del juego.
 * El OS (o, en el futuro, la app de Ionic) solo necesita montar <app-sandworld (exit)="..." />.
 * Nada de esta carpeta importa del portfolio.
 */
@Component({
  selector: 'app-sandworld',
  standalone: true,
  imports: [HudComponent],
  templateUrl: './sandworld.html',
  styleUrl: './sandworld.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Marcos pixel de madera y pergamino como variables CSS (ver pixel-frames.ts)
  host: { '[style]': 'frameVars' },
  providers: [
    SandworldService,                       // estado ligado a la vida del juego
    Translator,
    { provide: SETTINGS_STORAGE, useClass: LocalSettingsStorage },
  ],
})
export class SandworldComponent implements AfterViewInit, OnDestroy {

  /** Idioma que propone el OS. Solo se usa si el jugador no ha elegido otro en Ajustes. */
  readonly lang = input<SandworldLang | undefined>(undefined);
  /** El jugador pulsó "Salir" en Ajustes: quien monta el juego decide cómo cerrarlo */
  readonly exit = output<void>();

  protected readonly frameVars = FRAME_VARS;

  private readonly stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly zone = inject(NgZone);
  protected readonly game = inject(SandworldService);
  private readonly runtime = new SandworldRuntime(this.game.engine, this.game.world, {
    frame: now => this.game.tick(now),
    islandTap: () => this.zone.run(() => this.game.showIslandLabel()),
    pour: {
      begin: () => this.game.beginStroke(),
      at: (gx, gy, s) => this.game.pourAt(gx, gy, s),
      end: () => this.game.endStroke(),
      color: () => this.game.sandColor(),
    },
  });

  constructor() {
    effect(() => {
      const l = this.lang();
      if (l) this.game.suggestLang(l);
    });
    // Con una arena elegida, 1 dedo es pincel; sin arena, mueve la cámara
    effect(() => this.runtime.setBrushEnabled(this.game.selectedSand() !== null));
    // Chunk descubierto → emerge de las nubes
    this.game.events.on('chunkRevealed', c => this.runtime.showChunk(c.cx, c.cy));
    // Terreno cambiado (desprendimientos, vertidos) → re-horneado
    this.game.events.on('terrainChanged', cs => this.runtime.markDirty(cs));
  }

  ngAfterViewInit(): void {
    // Pixi corre su propio bucle; fuera de la zona de Angular para no disparar detección de cambios en cada frame
    this.zone.runOutsideAngular(() => this.start());
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.runtime.destroy();
  }

  private async start(): Promise<void> {
    const ok = await this.runtime.mount(this.stageRef().nativeElement);
    if (ok) this.zone.run(() => this.game.start());
  }

  /** Detiene el render y el tiempo cuando la pestaña o la app pasan a segundo plano */
  private onVisibility = (): void => {
    if (document.hidden) this.runtime.pause();
    else this.runtime.resume();
  };
}
SANDWORLD_EOF

echo "Bloque 3 aplicado: 20 archivos"
