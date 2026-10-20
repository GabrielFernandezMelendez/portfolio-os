// Un animal: un individuo con sus necesidades, su manada y su diario. Vive en coordenadas de celda global
// (con decimales: se mueve entre celdas). El dibujo y la ficha lo leen; solo la simulación lo cambia.

export type Sex = 'male' | 'female';

/** Lo que está haciendo ahora (decide su animación) */
export type AnimalAction = 'idle' | 'walk' | 'eat' | 'drink' | 'sleep' | 'run' | 'dead';

/** Órdenes del jugador desde la ficha */
export type AnimalOrder = 'eat' | 'sleep' | 'run';

/** Por qué murió */
export type DeathCause = 'starvation' | 'dehydration' | 'oldAge' | 'poison' | 'exhaustion' | 'fire';

/** Algo que le afecta ahora a su felicidad (la ficha lo enseña como "Le afecta") */
export interface Factor {
  readonly key: string;
  /** Positivo suma, negativo resta */
  readonly value: number;
}

/** Una línea de su diario (el texto sale de i18n: animal.diary.<key>) */
export interface DiaryEntry {
  readonly minute: number;
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/**
 * Manada: un grupo que se mueve junto detrás de su guía (la hembra adulta más vieja; si no hay, el más viejo).
 * Lo que aprende uno lo saben todos (conocimiento por grupo): si una planta envenena a alguien, la manada la evita.
 */
export interface Herd {
  readonly id: number;
  readonly species: number;
  /** Adónde va la manada (celda global) */
  tx: number;
  ty: number;
  /** Plantas que la manada ha aprendido a no comer */
  readonly avoid: Set<number>;
}

export interface Animal {
  readonly id: number;
  readonly species: number;
  readonly sex: Sex;
  readonly name: string;
  /** Minuto de juego en que nació */
  readonly bornAt: number;
  /** Días que vivirá si nada lo mata antes (oculto: la vejez es una sorpresa) */
  readonly lifespan: number;
  /** Planta favorita (comerla le alegra el día) */
  readonly favourite: number;
  /** Id de su madre (las crías la siguen) o null */
  readonly mother: number | null;

  // ── Dónde está ──
  x: number;
  y: number;
  /** Hacia dónde va (celda global) y hacia dónde mira: 1 = derecha, -1 = izquierda; back = de espaldas */
  tx: number;
  ty: number;
  facing: 1 | -1;
  back: boolean;
  herd: number;

  // ── Necesidades (0..1; llena = bien) ──
  /** Vida: heridas y enfermedad */
  health: number;
  /** Sueño: descanso */
  rest: number;
  /** Hambre: saciedad */
  satiety: number;
  /** Sed: hidratación */
  hydration: number;
  happiness: number;
  /** Lo que más le influye ahora a su felicidad */
  factors: Factor[];

  action: AnimalAction;
  /** Minuto en que empezó la acción (para animarla) */
  actionSince: number;
  order: AnimalOrder | null;
  /** Hacia dónde corre (dirección unitaria) */
  runDx: number;
  runDy: number;

  // ── Cría ──
  /** Minuto en que dará a luz (null = no está preñada) y crías que espera */
  dueAt: number | null;
  litter: number;
  /** Año (de juego) de su último celo con éxito: como mucho uno por año */
  lastRutYear: number;

  /** Semillas que lleva en la tripa: se plantan donde esté cuando toque */
  seeds: { plant: number; at: number }[];

  diary: DiaryEntry[];
  /** Día de juego y entradas escritas ese día (máximo por día) */
  diaryDay: number;
  diaryToday: number;

  diedAt: number | null;
  cause: DeathCause | null;
}
