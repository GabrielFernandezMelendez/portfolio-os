import { RandomSource } from '../domain/ports/random-source.port';

/**
 * Adaptador del puerto RandomSource con el algoritmo mulberry32:
 * rápido, de 32 bits y con buena distribución para juegos.
 */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
