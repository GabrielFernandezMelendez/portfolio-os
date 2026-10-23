// Un animal: un individuo con sus necesidades, su manada y su diario. Vive en coordenadas de celda global
// (con decimales: se mueve entre celdas). El dibujo y la ficha lo leen; solo la simulación lo cambia.

export type Sex = 'male' | 'female';

/** Lo que está haciendo ahora (decide su animación) */
export type AnimalAction = 'idle' | 'walk' | 'eat' | 'drink' | 'sleep' | 'run' | 'dead' | 'howl' | 'fight';

/** Órdenes del jugador desde la ficha */
export type AnimalOrder = 'eat' | 'sleep' | 'run';

/** Por qué murió */
export type DeathCause =
  | 'starvation' | 'dehydration' | 'oldAge' | 'poison' | 'exhaustion' | 'fire' | 'lightning' | 'buried' | 'disease' | 'drowned' | 'orphaned'
  | 'predation' | 'injury' | 'sun' | 'frost' | 'heat';

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
  /** Costumbre a cada tipo de estímulo (0..1: cuánto menos les asusta) y cuándo lo notaron por última vez */
  readonly habit: Map<string, { level: number; at: number }>;
  /** Zonas que la manada evita (donde cayó un rayo, hubo fuego, quema el suelo...) hasta el minuto `until` */
  zones: { x: number; y: number; r: number; until: number }[];
  /** Sitio donde la manada se junta a dormir esta noche (lo elige la guía al caer la tarde; de día, null) */
  bed: { x: number; y: number } | null;
  /** Su madriguera (id) si la especie tiene refugio, o null */
  burrow: number | null;
  /** Viaje de caza: adónde va la manada y hasta qué minuto (luego vuelve a su guarida), o null */
  trip: { x: number; y: number; until: number } | null;
  /** Sitios donde bebió y comió bien (los últimos MEMORY_SPOTS): a ellos va primero cuando tiene sed o hambre */
  water: { x: number; y: number }[];
  food: { x: number; y: number }[];
  /** Presa recién cazada a la que acude toda la manada a comer (id del cadáver), o null */
  feast: number | null;
  /** Carroñeros: dónde ha encontrado cadáveres (vuelve a mirar allí: donde caza el lobo) */
  kills: { x: number; y: number }[];
  /** Se va de la isla: hacia qué orilla y hasta qué minuto (pasado ese minuto se va igual), o null */
  leaving: { x: number; y: number; until: number; quiet: boolean } | null;
}

/**
 * Madriguera: entrada en una celda; dentro duermen, crían y se esconden. Se cava en unas horas (`readyAt`), una
 * Duna la tapa (`blocked`) y la Marea la derrumba (desaparece).
 */
export interface Burrow {
  readonly id: number;
  readonly species: number;
  /**
   * 'burrow' agujero (conejo), 'den' guarida de ramas, 'cave' cueva de roca (natural: no se derrumba), 'nest'
   * nido de ramas en la copa de un árbol (cuervo), 'hut' choza de pieles (humanos), 'lair' nido de carbón en la
   * Tierra Quemada (goblins)
   */
  readonly kind: RefugeKindId;
  /** Altura del suelo en la entrada cuando se hizo (o se destapó): si la arena la sube, se va tapando */
  ground: number;
  herd: number;
  readonly x: number;
  readonly y: number;
  readyAt: number;
  blocked: boolean;
  /** Minuto desde el que nadie la usa (su manada ya no existe) o null; abandonada mucho tiempo, se hunde */
  abandonedAt: number | null;
}

/**
 * Signo sobre la cabeza: '!' se asusta, '?' algo le da curiosidad, espada (lucha cuerpo a cuerpo) y polvareda (huye
 * de un combate). El dibujo lo enseña unos segundos.
 */
export type AnimalSignal = 'alarm' | 'curious' | 'fight' | 'flee';

/**
 * Cuerpo a cuerpo: con quién lucha, hasta qué minuto dura, si es quien atacó (resuelve la tirada al acabar) y si le
 * saltó encima por sorpresa. Mientras dura, los dos se quedan encarados (el dibujo anima los golpes).
 */
export interface Fight {
  readonly with: number;
  readonly until: number;
  readonly attacker: boolean;
  readonly ambush: boolean;
}

export type RefugeKindId = 'burrow' | 'den' | 'cave' | 'nest' | 'hut' | 'lair';

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

  /**
   * Miedo (0..1). Sin barra: la ficha lo enseña como estado ("Asustado"), sobre la cabeza sale un '!' al
   * asustarse y, sobre todo, se ve en lo que hace (alerta, huida, estampida).
   * fearX, fearY: de dónde viene lo que le asusta (huye hacia el otro lado).
   */
  fear: number;
  fearX: number;
  fearY: number;
  /** Algo que le da curiosidad (irá a mirar cuando se le pase el susto), hasta el minuto `until` */
  curious: { x: number; y: number; until: number; key: string; seen: boolean } | null;
  /** Huye (corre hasta ponerse a salvo) en vez de correr por orden del jugador */
  fleeing: boolean;
  /** Último signo sobre su cabeza y minuto en que salió */
  signal: { kind: AnimalSignal; at: number } | null;
  /** Hasta qué minuto se queda jadeando tras correr y hasta cuál no consigue dormirse (adrenalina) */
  pantUntil: number;
  awakeUntil: number;
  /** Excursión por su cuenta (de día, lejos de la manada): adónde va y hasta qué minuto; luego vuelve con los suyos */
  roam: { x: number; y: number; until: number } | null;
  /**
   * Ruta a pie (pares x, y de celdas) cuando el camino recto se atasca. [] = ya se buscó y no hay; hasta
   * `stuckUntil` no vuelve a buscar (así un sitio imposible no se recalcula cada minuto).
   */
  path: number[] | null;
  stuckUntil: number;
  /** Dentro de su madriguera (id; no se ve) o null. Si sale a tomar el sol, hasta qué minuto se queda fuera */
  inside: number | null;
  outUntil: number;
  /** Quieto del susto hasta este minuto (antes de echar a correr) */
  frozenUntil: number;
  /** Huyendo hacia un sitio (su madriguera) en vez de lejos del peligro, o null */
  runTo: { x: number; y: number } | null;
  /** Enfermo hasta este minuto (null = sano) y si ya pasó la enfermedad (inmune) */
  sickUntil: number | null;
  immune: boolean;
  /** Manada de la que se fue al hacerse adulto (no vuelve a unirse a ella) o null */
  leftHerd: number | null;
  /** Depredador: la presa que está cazando (acecho o persecución) y desde cuándo, o null */
  hunt: { target: number; phase: 'stalk' | 'chase'; since: number } | null;
  /** Frío y calor acumulados (0 = a gusto; desde 1, hipotermia o golpe de calor: pierde vida) */
  cold: number;
  heat: number;
  /** Luchando cuerpo a cuerpo (ver Fight), o null */
  fight: Fight | null;
  /** Carne que lleva a la guarida para las crías (0 = nada) */
  carrying: number;
  /** Cadáver (id) del que está comiendo, o null */
  feeding: number | null;
  /** Cadáver: carne que le queda (se la comen los carnívoros) */
  meat: number;
  /** Carne que tenía el cadáver al morir (para saber cuánto se han comido: ver eatenOf) */
  meatFull: number;
  /** Minutos que se ha entretenido hoy antes de volver a dormir con los suyos, y para qué noche (minuto de inicio) */
  lateBy: number;
  lateFor: number;
  /** Cría de refugio: último minuto en que su madre estuvo con ella (si en un día no viene, puede no salir adelante) */
  nursedAt: number;
  /**
   * Buscando agua o comida sin encontrarla cerca: hasta dónde busca (celdas, crece cada hora), cuándo lo amplió por
   * última vez y hacia dónde camina mientras tanto (ángulo). null si no busca.
   */
  search: { kind: 'water' | 'food' | 'prey'; r: number; at: number; dir: number } | null;
  /**
   * El agua a la que va: dónde, lo más cerca que ha llegado y cuándo. Si en un rato no se acerca más (un barranco,
   * un lago en el fondo de una terraza), la da por imposible un tiempo (`badWater`) y busca otra.
   */
  waterGoal: { x: number; y: number; best: number; at: number } | null;
  badWater: { x: number; y: number; until: number }[];
  /**
   * Despistado tras separarse en una carrera de la manada: 0 = no; 1 = no sabe dónde están los suyos (al caer la
   * tarde los buscará, con suerte); 2 = no los ha encontrado (si no se cruza con ellos, esta noche se pierde).
   */
  strayed: 0 | 1 | 2;

  action: AnimalAction;
  /** Minuto en que empezó la acción (para animarla) */
  actionSince: number;
  order: AnimalOrder | null;
  /** Hacia dónde corre (dirección unitaria) y desde dónde echó a correr */
  runDx: number;
  runDy: number;
  runX: number;
  runY: number;

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
