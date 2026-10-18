import { BiomeId } from '../../domain/models/biome.model';
import { ChunkData, tileIndex } from '../../domain/models/chunk.model';
import { WORLD } from '../../domain/models/world.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import {
  BIOME_BY_ID, BIOME_CHANGE_DAYS, GLADE_CHANCE, GLADE_MIN_AFFINITY, GLADE_MIN_ESSENCE, GLADE_RETRY_DAYS,
  classifyBiome, isHealthy,
} from '../../config/biomes.config';
import { World } from './world';
import { tileContext } from './tile-context';

/** Un tile ha cambiado de bioma */
export interface BiomeChange {
  readonly cx: number;
  readonly cy: number;
  readonly i: number;
  readonly j: number;
  readonly from: BiomeId;
  readonly to: BiomeId;
}

const N = WORLD.TILES;
const NEIGHBOURS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Biomas vivos: cada cierto tiempo se mira el estado real de cada tile (agua, barro, roca, ceniza, frío...)
 * y, si cumple las condiciones de otro bioma durante BIOME_CHANGE_DAYS seguidos, cambia.
 * También lleva la regla del Claro Despierto: nace raro (GLADE_CHANCE por intento) y crece como mucho
 * un tile por estación en cada chunk.
 */
export class BiomeSystem {
  constructor(
    private readonly world: World,
    private readonly random: RandomSource,
  ) {}

  /** Revisa todos los tiles descubiertos; `elapsedDays` es el tiempo desde la última revisión */
  update(elapsedDays: number): BiomeChange[] {
    const changes: BiomeChange[] = [];
    for (const { cx, cy } of this.world.exploration.list()) {
      const chunk = this.world.chunk(cx, cy);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const t = tileIndex(i, j);
          this.tryAwaken(chunk, i, j, elapsedDays);
          const ctx = tileContext(chunk, i, j);
          // El claro se apaga si la tierra deja de estar sana (fuego, ceniza, barro...)
          if (chunk.glade[t] && !isHealthy(ctx)) chunk.glade[t] = 0;
          const target = classifyBiome({ ...ctx, glade: chunk.glade[t] === 1 });
          const current = chunk.biome[t] as BiomeId;
          if (target === current) {
            chunk.biomeTimer[t] = 0;
            continue;
          }
          if (chunk.biomeNext[t] !== target) {
            chunk.biomeNext[t] = target;
            chunk.biomeTimer[t] = 0;
          }
          chunk.biomeTimer[t] += elapsedDays;
          // Los que nacen de un suceso cambian en el momento; el resto, tras días cumpliendo las condiciones
          if (BIOME_BY_ID[target].instant || chunk.biomeTimer[t] >= BIOME_CHANGE_DAYS) {
            this.setBiome(chunk, t, target);
            changes.push({ cx, cy, i, j, from: current, to: target });
          }
        }
      }
    }
    return changes;
  }

  /** TEMPORAL (modo desarrollo): fuerza un claro en el tile sano más cercano al centro del chunk. Devuelve si pudo. */
  forceGlade(cx: number, cy: number): boolean {
    const chunk = this.world.chunk(cx, cy);
    let best = -1, bestD = Infinity;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(i - N / 2 + 0.5, j - N / 2 + 0.5);
        if (d < bestD && !chunk.glade[tileIndex(i, j)] && isHealthy(tileContext(chunk, i, j))) { bestD = d; best = tileIndex(i, j); }
      }
    }
    if (best < 0) return false;
    chunk.glade[best] = 1;
    return true;
  }

  /** Nueva estación: cada chunk con claro puede extenderlo a un tile vecino sano (con GLADE_CHANCE) */
  newSeason(): void {
    for (const { cx, cy } of this.world.exploration.list()) {
      const chunk = this.world.chunk(cx, cy);
      const candidates: number[] = [];
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          if (!chunk.glade[tileIndex(i, j)]) continue;
          for (const [di, dj] of NEIGHBOURS) {
            const ni = i + di, nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
            const nt = tileIndex(ni, nj);
            if (!chunk.glade[nt] && isHealthy(tileContext(chunk, ni, nj))) candidates.push(nt);
          }
        }
      }
      if (candidates.length === 0 || this.random.next() >= GLADE_CHANCE) continue;
      chunk.glade[candidates[Math.floor(this.random.next() * candidates.length)]] = 1;
    }
  }

  /**
   * Despertar + Afinidad sobre un tile sano: un intento con GLADE_CHANCE. El intento gasta la esencia
   * y la afinidad (verter más no sube la probabilidad) y obliga a esperar GLADE_RETRY_DAYS.
   */
  private tryAwaken(chunk: ChunkData, i: number, j: number, elapsedDays: number): void {
    const t = tileIndex(i, j);
    if (chunk.gladeWait[t] > 0) chunk.gladeWait[t] = Math.max(0, chunk.gladeWait[t] - elapsedDays);
    if (chunk.glade[t] || chunk.gladeWait[t] > 0) return;
    if (chunk.essence[t] < GLADE_MIN_ESSENCE || chunk.affinity[t] < GLADE_MIN_AFFINITY) return;
    if (!isHealthy(tileContext(chunk, i, j))) return;
    chunk.essence[t] -= GLADE_MIN_ESSENCE;
    chunk.affinity[t] -= GLADE_MIN_AFFINITY;
    chunk.gladeWait[t] = GLADE_RETRY_DAYS;
    if (this.random.next() < GLADE_CHANCE) chunk.glade[t] = 1;
  }

  private setBiome(chunk: ChunkData, t: number, biome: BiomeId): void {
    chunk.biome[t] = biome;
    chunk.biomeTimer[t] = 0;
    const fertility = BIOME_BY_ID[biome].fertility;
    if (fertility !== undefined) chunk.fertility[t] = fertility;
  }
}
