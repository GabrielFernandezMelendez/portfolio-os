import { GameTime } from '../models/time.model';

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
}
