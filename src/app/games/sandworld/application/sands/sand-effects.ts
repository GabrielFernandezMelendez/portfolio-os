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
