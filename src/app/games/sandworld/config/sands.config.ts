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

/**
 * Arenas que tapan un manantial en cuanto caen encima, aunque aún no se hayan asentado
 * (como echar arena sobre una fuente). Guardadas como índice de SAND_ORDER + 1, igual que chunk.pendingSand.
 */
export const BURYING_SANDS: ReadonlySet<number> = new Set((['duna', 'humus'] as SandId[]).map(s => SAND_ORDER.indexOf(s) + 1));

/** Arenas sin masa: en la capa sin asentar se ven como destellos, no como granos */
export const MASSLESS_SANDS: readonly SandId[] = ['despertar', 'afinidad'];
