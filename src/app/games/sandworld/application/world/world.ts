import { ChunkData } from '../../domain/models/chunk.model';
import { generateChunk } from './chunk-generator';
import { computeClimate } from './climate';

/**
 * El mundo de una partida: semilla y chunks cargados.
 * Lo comparten el render (para dibujar) y la lógica (indicadores, y más adelante arenas, fauna y guardado).
 */
export class World {
  private readonly chunks = new Map<string, ChunkData>();

  /** Nivel de la isla: sube con la expansión (fase 7) */
  level = 1;

  constructor(readonly seed: number) {}

  /** Devuelve el chunk (cx, cy), generándolo la primera vez */
  chunk(cx: number, cy: number): ChunkData {
    const key = `${cx},${cy}`;
    let c = this.chunks.get(key);
    if (!c) {
      c = generateChunk(this.seed, cx, cy);
      computeClimate(c, this.seed);
      this.chunks.set(key, c);
    }
    return c;
  }

  get loadedChunks(): readonly ChunkData[] {
    return [...this.chunks.values()];
  }
}
