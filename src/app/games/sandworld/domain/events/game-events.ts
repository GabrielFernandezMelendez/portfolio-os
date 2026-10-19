import { GameTime } from '../models/time.model';

/** Coordenadas de un chunk */
export interface ChunkCoord {
  cx: number;
  cy: number;
}

/**
 * Catálogo de eventos del juego (nombre → carga útil).
 * Irá creciendo: crónica, cartas del Dios Espagueti, nacimientos, catástrofes...
 */
export interface GameEvents {
  minute: GameTime;
  hour: GameTime;
  dawn: GameTime;
  dusk: GameTime;
  newDay: GameTime;
  newSeason: GameTime;
  /** Se ha descubierto un chunk: el render lo hace emerger de las nubes */
  chunkRevealed: ChunkCoord;
  /** El terreno de estos chunks ha cambiado (desprendimientos, vertidos...): hay que volver a hornearlos */
  terrainChanged: readonly ChunkCoord[];
  /** La vegetación de estos chunks ha cambiado de forma visible: hay que recolocar sus plantas */
  vegetationChanged: readonly ChunkCoord[];
  /** Cae un rayo en esta celda global: el dibujo enseña el rayo y el destello */
  lightning: { gx: number; gy: number };
  /** Lleva la cámara hasta esta celda global (lo usan los botones de prueba) */
  focus: { gx: number; gy: number };
}
