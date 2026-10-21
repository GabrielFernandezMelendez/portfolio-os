// Especies de fauna. El registro (config/species.config.ts) dice qué come cada una, cómo vive en grupo,
// cuánto vive y cómo cría. La simulación (application/fauna) y el dibujo lo leen todo de aquí.

import { Diet } from './plant.model';
import { SeasonId } from './time.model';
import { MaterialId } from './material.model';

export type AnimalSize = 'small' | 'medium' | 'large';

export interface SpeciesDef {
  readonly id: number;
  /** Clave para textos (species.<key>), dibujo y nombres */
  readonly key: string;
  readonly size: AnimalSize;
  /** Qué puede comer (cruza con las dietas de cada planta del registro) */
  readonly diets: readonly Diet[];

  /** Manada: tamaño con el que se siente cómoda (por encima, se divide) y distancia (celdas) a la que se mantiene */
  readonly herd: { readonly min: number; readonly max: number; readonly cohesion: number };
  /**
   * Espacio entre ellos: distancia que quiere al vecino más cercano (celdas), cuánto se abre la manada al pastar
   * tranquila (× cohesión) y cuánto se aprieta al apiñarse (miedo, sueño, frío, tormenta).
   */
  readonly spacing: { readonly personal: number; readonly graze: number; readonly huddle: number };
  /** Horas del día en que más come (al amanecer y al atardecer) y en que sestea si hace calor */
  readonly activeHours: readonly (readonly [from: number, to: number])[];
  readonly siestaHours: readonly [from: number, to: number];
  /** Velocidad andando y corriendo (celdas por minuto de juego) */
  readonly speed: { readonly walk: number; readonly run: number };
  /**
   * Distancias en islas (× WORLD.CELLS, así siguen valiendo si cambia el tamaño de una isla): cuánto se aleja un
   * adulto de su manada explorando por su cuenta de día y cuánto pone de por medio al huir de un peligro.
   */
  readonly range: {
    readonly roam: number;
    /** Si las hembras se alejan menos que los machos (conejo), su alcance; si no, el mismo */
    readonly roamFemale?: number;
    readonly flee: number;
  };
  /**
   * Huida: 'away' = lejos del peligro (ciervo); 'refuge' = a su refugio (conejo: a la madriguera; si no tiene o
   * está lejos, lejos). Probabilidades: quedarse quieto al asustarse (antes de echar a correr), coger el miedo
   * de un vecino que huye (cada vez que piensa) y quiebro en zigzag (cada minuto de carrera).
   */
  readonly flight: { readonly mode: 'away' | 'refuge'; readonly freeze: number; readonly alarm: number; readonly zigzag: number };
  /**
   * Refugio (madriguera): lo cava la manada donde el suelo lo permite y dentro duermen, crían y se esconden.
   * Probabilidades por hora: quedarse dentro con lluvia, salir a tomar el sol en sus horas de dormir, salir al
   * acabar esas horas. Y lo que le pasa con las arenas y el agua.
   */
  readonly refuge?: {
    readonly digIn: readonly MaterialId[];
    readonly digHours: number;
    readonly rainStay: number;
    readonly sunbathe: number;
    readonly leave: number;
    /** Marea encima: probabilidad de derrumbe y de morir cada uno de los que están dentro */
    readonly collapse: number;
    readonly collapseDeath: number;
    /** Inundada: por hora, salir a tiempo; si no, ahogarse */
    readonly floodEscape: number;
    readonly drownPerHour: number;
    /** Tapada (Duna): por hora, destaparla */
    readonly unblock: number;
  };
  /** Jóvenes que se van de su manada al hacerse adultos (y fundan otra), por sexo */
  readonly dispersal?: { readonly male: number; readonly female: number };
  /**
   * Enfermedad contagiosa (tipo mixomatosis), el freno natural de las especies que crían mucho: con
   * superpoblación (densidad > crowdedAbove) brota al día con `outbreak`; se contagia dentro de la manada
   * (`spread` al día por enfermo), dura `days` días y mata con `lethality` (quien sobrevive queda inmune).
   */
  readonly disease?: {
    readonly outbreak: number;
    readonly crowdedAbove: number;
    readonly spread: number;
    readonly days: number;
    readonly lethality: number;
  };
  /** Fundadores al soltar una manada (si no, 2 hembras, 1 macho y 1 cría) */
  readonly founders?: readonly { readonly sex: 'male' | 'female'; readonly age: 'adult' | 'young' }[];
  /** Tras correr: minutos que se queda jadeando (quieto) y minutos sin poder dormirse (la adrenalina) */
  readonly afterRun: { readonly pant: number; readonly awake: number };
  /**
   * Correr con toda la manada (orden desde la vista de lejos): probabilidad de que cada adulto salga con el grupo
   * (si no, se separa y sale por su cuenta) y de que uno separado encuentre a los suyos al caer la tarde.
   */
  readonly herdRun: { readonly together: number; readonly findBack: number };
  /** Horas antes de dormir en que la manada empieza a juntarse en su sitio de descanso (los lejanos salen antes) */
  readonly gatherHours: number;

  /** Días de cría (sigue a su madre y come menos) y días hasta ser adulta (ya puede criar) */
  readonly youngDays: number;
  readonly adultDays: number;
  /** Vida (días): a cada individuo le toca un valor al azar en este rango. No se enseña al jugador. */
  readonly lifespanDays: readonly [min: number, max: number];

  readonly breeding: RutBreeding | SeasonBreeding;

  /** Comida (biomasa × nutrición) que llena del todo su estómago (saciedad de 0 a 1) */
  readonly stomach: number;
  /** Comida que come por minuto mientras come */
  readonly bitePerMinute: number;
  /** Saciedad que pierde al día */
  readonly hungerPerDay: number;
  /** Hidratación que pierde al día y la que recupera por minuto bebiendo */
  readonly thirstPerDay: number;
  readonly drinkPerMinute: number;
  /** Agua que saca de lo que come (por cada saciedad que gana): el conejo apenas necesita beber */
  readonly waterFromFood?: number;
  /** Sueño (descanso) que pierde al día despierto y que recupera por hora dormida */
  readonly tirePerDay: number;
  readonly restPerHour: number;
  /** Horas a las que duerme la manada (de from a to, cruzando la medianoche) */
  readonly sleepHours: readonly [from: number, to: number];
  /** Celdas a las que le gusta tener agua (está a gusto) y hasta dónde la busca cuando tiene sed */
  readonly waterRange: number;
  readonly thirstSearch: number;
  /** Días que se queda su cadáver */
  readonly corpseDays: number;
}

/**
 * Cría por celo (ciervo): una vez al año, en la estación del celo, según lo bien comida que esté entonces; las
 * crías nacen en otra estación, pase lo que pase con la comida entretanto.
 */
export interface RutBreeding {
  readonly mode: 'rut';
  readonly rutSeason: SeasonId;
  readonly birthSeason: SeasonId;
  /** Probabilidad al día, durante el celo, de que una hembra adulta con macho en la manada quede preñada */
  readonly conceivePerDay: number;
  /** Saciedad mínima para quedar preñada */
  readonly minSatiety: number;
  /** Gemelos: probabilidad si la saciedad pasa de twinsSatiety */
  readonly twinsChance: number;
  readonly twinsSatiety: number;
}

/**
 * Cría por temporada (conejo): durante varias estaciones, cada día puede quedar preñada (incluso nada más parir);
 * la gestación dura `gestationDays`. Cuántas crías tiene cada vez es una tirada: `litter.sizes` con sus pesos;
 * con superpoblación o hambre la tirada baja `crowdShift` / `hungryShift` puestos (sin bajar del mínimo).
 * Las crías pasan sus primeros `nurseDays` dentro del refugio; si su madre no vuelve a darles de mamar, cada día
 * mueren con `orphanDeath`.
 */
export interface SeasonBreeding {
  readonly mode: 'season';
  readonly seasons: readonly SeasonId[];
  readonly conceivePerDay: number;
  readonly minSatiety: number;
  readonly gestationDays: number;
  readonly litter: { readonly sizes: readonly number[]; readonly weights: readonly number[] };
  readonly crowdShift: number;
  readonly hungryShift: number;
  readonly nurseDays: number;
  readonly orphanDeath: number;
}
