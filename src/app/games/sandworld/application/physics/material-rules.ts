import { Material, MaterialId } from '../../domain/models/material.model';

/** Lo que una regla puede consultar de una celda */
export interface CellContext {
  readonly water: number;
  readonly moisture: number;
  /** Días que lleva el agua sin correr */
  readonly stagnant: number;
  /** Hay agua honda (lago) en alguna vecina: la orilla de un lago no se embarra */
  readonly deepNeighbour: boolean;
  /** El terreno está por debajo del nivel freático: es lecho de un lago natural */
  readonly belowTable: boolean;
  /** Temperatura del tile, 0..1 */
  readonly temperature: number;
}

/**
 * Regla de transformación: una celda de material `from` pasa a `to` cuando la condición se cumple
 * de forma continuada durante `days` días de juego. Si deja de cumplirse, el contador vuelve a cero.
 * Añadir una regla nueva (turba, nieve que se funde, ceniza que fertiliza...) = añadir una entrada.
 */
export interface MaterialRule {
  /** Identificador numérico ≥ 1 (se guarda en un Uint8Array por celda) */
  readonly id: number;
  readonly key: string;
  readonly from: readonly MaterialId[];
  readonly to: MaterialId;
  readonly days: number;
  when(c: CellContext): boolean;
}

/** Agua poco profunda: encharcamiento (más honda ya es lago) */
const SHALLOW_MIN = 0.02;
const SHALLOW_MAX = 0.35;

export const MATERIAL_RULES: readonly MaterialRule[] = [
  {
    // Solo hay barro por EXCESO: agua poco profunda y estancada sobre tierra, que no forma parte de un lago
    id: 1,
    key: 'flooding-to-mud',
    from: [Material.SOIL, Material.HUMUS],
    to: Material.MUD,
    days: 3,
    when: c => c.water >= SHALLOW_MIN && c.water <= SHALLOW_MAX && c.stagnant >= 0.25 && !c.deepNeighbour && !c.belowTable,
  },
  {
    // El barro sin agua y con el suelo seco vuelve a tierra (agrietada)
    id: 2,
    key: 'mud-dries',
    from: [Material.MUD],
    to: Material.SOIL,
    days: 3,
    when: c => c.water < SHALLOW_MIN && c.moisture < 0.3,
  },
];

/** Reglas que pueden afectar a cada material (índice rápido) */
export const RULES_BY_MATERIAL: ReadonlyMap<MaterialId, readonly MaterialRule[]> = (() => {
  const map = new Map<MaterialId, MaterialRule[]>();
  for (const r of MATERIAL_RULES) {
    for (const m of r.from) map.set(m, [...(map.get(m) ?? []), r]);
  }
  return map;
})();
