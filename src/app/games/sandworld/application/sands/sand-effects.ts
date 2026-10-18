import { Sand, SandId } from '../../domain/models/sand.model';
import { Material } from '../../domain/models/material.model';
import { tileIndex } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { TerrainPhysics } from '../physics/terrain-physics';
import { LAYER_SWITCH_PROGRESS, POUR_MAX_DUNE, POUR_MAX_MASS, POUR_MAX_MASSLESS } from '../../config/pour.config';
import {
  AFINIDAD_AFFINITY, BRASA_ASH, BRASA_DRY, BRASA_EVAPORATE, BRASA_HEAT, BRASA_MELT, BRASA_WARM, CHAR_HEAT,
  DESPERTAR_ESSENCE, ESCARCHA_CHILL, ESCARCHA_FREEZE, ESCARCHA_SNOW, HUMUS_DEPOSIT, HUMUS_FERTILITY, HUMUS_MOISTURE,
  MANANTIAL_BASE_RATE, MANANTIAL_MAX_RATE, MANANTIAL_MERGE_DISTANCE, MANANTIAL_RATE_PER_UNIT, MAREA_DIG,
} from '../../config/sand-effects.config';

/** Algo que ha pasado al aplicar una arena y merece aviso (la crónica lo cuenta) */
export type SandOutcome = 'charred' | 'springNew' | 'springStronger';

/** Celda de un vertido con la cantidad total que recibió */
export type PouredCell = readonly [gx: number, gy: number, amount: number];

/**
 * Regla común: toda arena tarda de 1 a 2 días en asentarse.
 * - Arenas de capa (Duna, Humus, Brasa, Escarcha): el efecto crece minuto a minuto y el suelo cambia de color
 *   a mitad del asentamiento (LAYER_SWITCH_PROGRESS); la Escarcha se ve cuando ya hay una capa de nieve de verdad.
 * - Arenas de suceso (Manantial; Despertar + Afinidad → Claro): no se ve nada hasta que terminan de asentarse.
 * - Única excepción inmediata: Duna o Humus caídos sobre un manantial lo tapan al momento (física, no efecto).
 *
 * Efecto de una arena. Cada arena se registra aquí con:
 * - maxPerCell: cuánto puede caer en una celda en un trazo (niveles, o intensidad 0..1 si no tiene masa)
 * - massless:   no cambia la altura (Despertar, Afinidad)
 * - apply:      se llama cada minuto mientras el vertido se asienta, con la parte de la cantidad de ese minuto
 *               y cuánto lleva asentado el vertido (0..1). Puede devolver un suceso para la crónica.
 * - settled:    opcional, al terminar el vertido (con lo que recibió cada celda)
 * Añadir o cambiar una arena = tocar solo su entrada; el pincel y la cola no saben nada de cada arena.
 */
export interface SandEffect {
  readonly sand: SandId;
  readonly maxPerCell: number;
  readonly massless: boolean;
  apply(physics: TerrainPhysics, gx: number, gy: number, amount: number, progress: number): SandOutcome | void;
  settled?(physics: TerrainPhysics, cells: readonly PouredCell[]): SandOutcome | void;
}

const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;

/** Suma `delta` a un campo 0..1 del tile que contiene la celda */
function addToTile(physics: TerrainPhysics, gx: number, gy: number, field: 'essence' | 'affinity' | 'fertility', delta: number): void {
  const cell = physics.grid.cell(gx, gy);
  if (!cell) return;
  const c = cell.chunk;
  const t = tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G));
  c[field][t] = Math.min(1, c[field][t] + delta);
}

export const SAND_EFFECTS: Readonly<Record<SandId, SandEffect>> = {
  // Duna: mucha arena que levanta el terreno. Si entierra un manantial, lo tapa (lo hace la física del agua).
  [Sand.DUNA]: {
    sand: Sand.DUNA,
    maxPerCell: POUR_MAX_DUNE,
    massless: false,
    apply: (physics, gx, gy, amount, progress) => {
      physics.deposit(gx, gy, Material.SAND, amount, progress >= LAYER_SWITCH_PROGRESS);
    },
  },

  // Marea: excava (primero nieve o hielo, después sedimento). Destapa los manantiales enterrados.
  [Sand.MAREA]: {
    sand: Sand.MAREA,
    maxPerCell: POUR_MAX_MASS,
    massless: false,
    apply: (physics, gx, gy, amount) => {
      physics.dig(gx, gy, amount * MAREA_DIG);
    },
  },

  // Humus: tierra ligera muy fértil que guarda la humedad
  [Sand.HUMUS]: {
    sand: Sand.HUMUS,
    maxPerCell: POUR_MAX_MASS,
    massless: false,
    apply: (physics, gx, gy, amount, progress) => {
      physics.deposit(gx, gy, Material.HUMUS, amount * HUMUS_DEPOSIT, progress >= LAYER_SWITCH_PROGRESS);
      const cell = physics.grid.cell(gx, gy);
      if (cell) cell.chunk.moisture[cell.k] = Math.min(1, cell.chunk.moisture[cell.k] + amount * HUMUS_MOISTURE);
      addToTile(physics, gx, gy, 'fertility', amount * HUMUS_FERTILITY);
    },
  },

  // Manantial: al asentarse, una fuente en la celda que más recibió (o refuerza la que haya cerca)
  [Sand.MANANTIAL]: {
    sand: Sand.MANANTIAL,
    maxPerCell: POUR_MAX_MASS,
    massless: false,
    apply: () => undefined,
    settled: (physics, cells) => {
      let best: PouredCell | null = null;
      let total = 0;
      for (const c of cells) {
        total += c[2];
        if (!best || c[2] > best[2]) best = c;
      }
      if (!best) return;
      const added = total * MANANTIAL_RATE_PER_UNIT;
      // ¿Hay ya un manantial cerca? Entonces mana más
      const D = MANANTIAL_MERGE_DISTANCE;
      for (let dy = -D; dy <= D; dy++) {
        for (let dx = -D; dx <= D; dx++) {
          const n = physics.grid.cell(best[0] + dx, best[1] + dy);
          if (n && n.chunk.spring[n.k] > 0) {
            physics.setSpring(best[0] + dx, best[1] + dy, Math.min(MANANTIAL_MAX_RATE, n.chunk.spring[n.k] + added));
            return 'springStronger';
          }
        }
      }
      physics.setSpring(best[0], best[1], Math.min(MANANTIAL_MAX_RATE, MANANTIAL_BASE_RATE + added));
      return 'springNew';
    },
  },

  // Brasa: calor. Seca agua y barro, funde lo helado, deja ceniza; en exceso calcina el suelo
  [Sand.BRASA]: {
    sand: Sand.BRASA,
    maxPerCell: POUR_MAX_MASS,
    massless: false,
    apply: (physics, gx, gy, amount, progress) => {
      physics.thermal.shiftTemperature(gx, gy, amount * BRASA_WARM);
      const charred = physics.scorch(gx, gy, {
        evaporate: amount * BRASA_EVAPORATE,
        dry: amount * BRASA_DRY,
        melt: amount * BRASA_MELT,
        heat: amount * BRASA_HEAT,
        ash: amount * BRASA_ASH,
        ashVisible: progress >= LAYER_SWITCH_PROGRESS,
        charAt: CHAR_HEAT,
      });
      return charred ? 'charred' : undefined;
    },
  },

  // Escarcha: nieve, frío y el agua se congela (deja de correr hasta que se funde)
  [Sand.ESCARCHA]: {
    sand: Sand.ESCARCHA,
    maxPerCell: POUR_MAX_MASS,
    massless: false,
    apply: (physics, gx, gy, amount) => {
      physics.thermal.shiftTemperature(gx, gy, -amount * ESCARCHA_CHILL);
      physics.freeze(gx, gy, amount * ESCARCHA_SNOW, amount * ESCARCHA_FREEZE);
    },
  },

  // Sin masa: suben valores del tile que usarán la fauna y los biomas (Claro Despierto)
  [Sand.DESPERTAR]: {
    sand: Sand.DESPERTAR,
    maxPerCell: POUR_MAX_MASSLESS,
    massless: true,
    apply: (physics, gx, gy, amount) => addToTile(physics, gx, gy, 'essence', amount * DESPERTAR_ESSENCE),
  },
  [Sand.AFINIDAD]: {
    sand: Sand.AFINIDAD,
    maxPerCell: POUR_MAX_MASSLESS,
    massless: true,
    apply: (physics, gx, gy, amount) => addToTile(physics, gx, gy, 'affinity', amount * AFINIDAD_AFFINITY),
  },
};
