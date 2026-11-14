import { IndicatorRegistry } from './indicator-registry';
import { World } from '../world/world';
import { PLANT_SLOTS } from '../../domain/models/chunk.model';
import { PLANT_DEFS, PLANT_SPACE } from '../../config/plants.config';

/** Fracción de agua a partir de la cual la isla se considera bien abastecida (barra llena) */
const WATER_FULL = 0.2;

/** Agua disponible: fracción de celdas con agua visible, relativa a WATER_FULL */
export function waterLevel(world: World): number {
  let wet = 0, total = 0;
  for (const c of world.loadedChunks) {
    for (let k = 0; k < c.water.length; k++) if (c.water[k] > 0.05) wet++;
    total += c.water.length;
  }
  return total ? wet / total / WATER_FULL : 0;
}

/** Biomasa por tile (espacio ocupado) con la que la barra se considera llena: 1 = todo el sitio ocupado */
const VEGETATION_FULL = 1;

/**
 * Vegetación: biomasa media de los tiles descubiertos (cada planta pesa según el espacio que ocupa:
 * un árbol cuenta más que una mata de hierba), relativa a VEGETATION_FULL.
 */
export function vegetationLevel(world: World): number {
  let sum = 0, total = 0;
  for (const { cx, cy } of world.exploration.list()) {
    const c = world.chunk(cx, cy);
    for (let t = 0; t < c.biome.length; t++) {
      total++;
      let b = 0;
      for (const p of PLANT_DEFS) b += c.plants[t * PLANT_SLOTS + p.id] * PLANT_SPACE[p.kind];
      sum += Math.min(1, b);
    }
  }
  return total ? sum / total / VEGETATION_FULL : 0;
}

/** Indicadores de la fase 1. La fauna se registra en la fase 4. */
export function registerWorldIndicators(registry: IndicatorRegistry, world: World): void {
  registry.register({ id: 'water', icon: 'drop', labelKey: 'indicators.water', color: '#3d8fd6', read: () => waterLevel(world) });
  registry.register({ id: 'vegetation', icon: 'leaf', labelKey: 'indicators.vegetation', color: '#5fae3e', read: () => vegetationLevel(world) });
}
