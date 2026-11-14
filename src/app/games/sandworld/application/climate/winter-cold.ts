import { ChunkData, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { WINTER_COLD_BY_BIOME, WINTER_COLD_FROM, WINTER_COLD_FULL } from '../../config/climate.config';
import { World } from '../world/world';
import { ClimateState } from './climate-state';

const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
const C = WORLD.CELLS;

/**
 * Cuánto le llega el frío del invierno a cada tile (0 = nada, 1 = todo). En invierno no se congela toda la isla:
 * el frío baja con la altura, así que las partes bajas siempre tienen tierra sin nieve y agua líquida.
 * - Por altura, relativa a la isla: nada en la mitad más baja (por debajo del cuantil WINTER_COLD_FROM) y todo
 *   en lo más alto (desde el cuantil WINTER_COLD_FULL).
 * - Por bioma, si su registro lo fija (WINTER_COLD_BY_BIOME): el desierto nunca se hiela; la tundra, siempre.
 * Se recalcula cada hora (el terreno cambia con las arenas) y al descubrir un chunk. Solo se aplica al desvío frío
 * de la estación: el calor del verano y el día y la noche son iguales para todos.
 */
export class WinterCold {
  private readonly exposure = new Map<ChunkData, Float32Array>();

  constructor(private readonly world: World) {}

  /** Recalcula la exposición de toda la isla descubierta */
  refresh(): void {
    const chunks = this.world.exploration.list().map(({ cx, cy }) => this.world.chunk(cx, cy));
    const altitudes = new Map<ChunkData, Float32Array>();
    const all: number[] = [];
    for (const c of chunks) {
      const alt = new Float32Array(N * N);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          let sum = 0;
          for (let dj = 0; dj < G; dj++) for (let di = 0; di < G; di++) sum += groundAt(c, (j * G + dj) * C + i * G + di);
          alt[tileIndex(i, j)] = sum / (G * G);
          all.push(sum / (G * G));
        }
      }
      altitudes.set(c, alt);
    }
    all.sort((a, b) => a - b);
    const q = (f: number) => all[Math.min(all.length - 1, Math.floor(f * (all.length - 1)))] ?? 0;
    const from = q(WINTER_COLD_FROM), full = Math.max(q(WINTER_COLD_FULL), from + 0.01);
    this.exposure.clear();
    for (const [c, alt] of altitudes) {
      const e = new Float32Array(N * N);
      for (let t = 0; t < N * N; t++) {
        const fixed = WINTER_COLD_BY_BIOME[c.biome[t]];
        e[t] = fixed ?? Math.min(1, Math.max(0, (alt[t] - from) / (full - from)));
      }
      this.exposure.set(c, e);
    }
  }

  /** Desvío de temperatura del momento en un tile: el frío de la estación según su exposición, más el del día */
  offsetAt(c: ChunkData, t: number, climate: ClimateState): number {
    let e = this.exposure.get(c);
    if (!e) {
      this.refresh();
      e = this.exposure.get(c);
    }
    const season = climate.seasonPart;
    return climate.dailyPart + (season < 0 ? season * (e?.[t] ?? 1) : season);
  }
}
