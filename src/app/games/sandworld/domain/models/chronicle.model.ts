// Crónica global de la isla (no confundir con el diario personal de cada animal, fase 4).

/** Tipo de mensaje: hoy no se filtra por él, pero se guarda para poder hacerlo más adelante */
export type ChronicleType = 'time' | 'world' | 'species' | 'catastrophe' | 'letter';

/** Catástrofes y cartas se publican al instante, saltándose el límite de mensajes */
export const URGENT_TYPES: readonly ChronicleType[] = ['catastrophe', 'letter'];

export type ChronicleParams = Readonly<Record<string, string | number>>;

/** Lo que pide publicar el juego */
export interface ChronicleDraft {
  type: ChronicleType;
  /** Clave de traducción del texto: el idioma se resuelve al mostrarlo, así el libro cambia de idioma entero */
  key: string;
  params?: ChronicleParams;
  /** Mayor = sale antes de la cola */
  priority?: number;
}

/** Mensaje ya publicado */
export interface ChronicleEntry {
  readonly id: number;
  readonly type: ChronicleType;
  readonly key: string;
  readonly params: ChronicleParams;
  /** Momento de juego en que ocurrió */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** Veces que se repitió mientras esperaba en la cola */
  readonly count: number;
}
