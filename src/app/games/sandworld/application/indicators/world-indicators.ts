import { IndicatorRegistry } from './indicator-registry';
import { World } from '../world/world';
import { Biome } from '../../domain/models/biome.model';

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

/**
 * Vegetación PROVISIONAL: fertilidad media de los tiles con vida vegetal posible.
 * En la fase 4 pasa a medir la biomasa real de las plantas.
 */
export function vegetationLevel(world: World): number {
  let sum = 0, total = 0;
  for (const c of world.loadedChunks) {
    for (let t = 0; t < c.biome.length; t++) {
      total++;
      if (c.biome[t] === Biome.FOREST || c.biome[t] === Biome.WETLAND) sum += c.fertility[t];
      else sum += c.fertility[t] * 0.3;
    }
  }
  return total ? sum / total : 0;
}

/** Indicadores de la fase 1. La fauna se registra en la fase 4. */
export function registerWorldIndicators(registry: IndicatorRegistry, world: World): void {
  registry.register({ id: 'water', icon: 'drop', labelKey: 'indicators.water', color: '#3d8fd6', read: () => waterLevel(world) });
  registry.register({ id: 'vegetation', icon: 'leaf', labelKey: 'indicators.vegetation', color: '#5fae3e', read: () => vegetationLevel(world) });
}
