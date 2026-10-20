// Especies de fauna. El registro (config/species.config.ts) dice qué come cada una, cómo vive en grupo,
// cuánto vive y cómo cría. La simulación (application/fauna) y el dibujo lo leen todo de aquí.

import { Diet } from './plant.model';
import { SeasonId } from './time.model';

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

  /** Días de cría (sigue a su madre y come menos) y días hasta ser adulta (ya puede criar) */
  readonly youngDays: number;
  readonly adultDays: number;
  /** Vida (días): a cada individuo le toca un valor al azar en este rango. No se enseña al jugador. */
  readonly lifespanDays: readonly [min: number, max: number];

  readonly breeding: {
    /** Estación del celo: las hembras quedan preñadas según lo bien comidas que estén entonces */
    readonly rutSeason: SeasonId;
    /** Estación en que nacen las crías (pase lo que pase con la comida entretanto) */
    readonly birthSeason: SeasonId;
    /** Probabilidad al día, durante el celo, de que una hembra adulta con macho en la manada quede preñada */
    readonly conceivePerDay: number;
    /** Saciedad mínima para quedar preñada */
    readonly minSatiety: number;
    /** Gemelos: probabilidad si la saciedad pasa de twinsSatiety */
    readonly twinsChance: number;
    readonly twinsSatiety: number;
  };

  /** Comida (biomasa × nutrición) que llena del todo su estómago (saciedad de 0 a 1) */
  readonly stomach: number;
  /** Comida que come por minuto mientras come */
  readonly bitePerMinute: number;
  /** Saciedad que pierde al día */
  readonly hungerPerDay: number;
  /** Hidratación que pierde al día y la que recupera por minuto bebiendo */
  readonly thirstPerDay: number;
  readonly drinkPerMinute: number;
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
