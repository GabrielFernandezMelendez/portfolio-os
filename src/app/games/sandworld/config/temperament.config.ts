import { Reaction, StimulusType } from '../domain/models/stimulus.model';
import { SandId } from '../domain/models/sand.model';

/*
  Temperamento de cada especie [PROPUESTA]: cómo reacciona a cada estímulo del mundo. Común a todas: añadir una
  especie = su tabla aquí. El miedo es interno (no se enseña): se ve en lo que hacen (alerta, huida, estampida...).
*/

export interface ReactionDef {
  readonly reaction: Reaction;
  /** Miedo que provoca a tope (0..1); baja con la distancia y con la costumbre */
  readonly fear: number;
  /** Celdas a las que lo nota (Infinity = en toda la isla) */
  readonly radius: number;
  /** Para 'avoid' y 'flee': horas que la manada evita la zona después */
  readonly avoidHours?: number;
}

export type Temperament = Readonly<Record<StimulusType, ReactionDef>>;

export const TEMPERAMENTS: Readonly<Record<string, Temperament>> = {
  // El ciervo: asustadizo y curioso a la vez
  deer: {
    fire: { reaction: 'flee', fear: 1, radius: 10, avoidHours: 72 },
    sandFall: { reaction: 'flee', fear: 0.75, radius: 7, avoidHours: 6 },
    dig: { reaction: 'startle', fear: 0.45, radius: 6, avoidHours: 3 },
    spring: { reaction: 'curious', fear: 0.35, radius: 9 },
    heat: { reaction: 'avoid', fear: 0.4, radius: 5, avoidHours: 12 },
    frost: { reaction: 'startle', fear: 0.25, radius: 5 },
    glow: { reaction: 'curious', fear: 0.15, radius: 10 },
    lightning: { reaction: 'flee', fear: 1, radius: 10, avoidHours: 48 },
    thunder: { reaction: 'startle', fear: 0.3, radius: Infinity },
    corpse: { reaction: 'avoid', fear: 0.2, radius: 4, avoidHours: 24 },
    predator: { reaction: 'flee', fear: 0.9, radius: 10, avoidHours: 48 },
    howl: { reaction: 'startle', fear: 0.3, radius: Infinity },
  },
  // El conejo: nervioso, poco curioso (lo nuevo le asusta antes que interesarle) y de alcance corto
  rabbit: {
    fire: { reaction: 'flee', fear: 1, radius: 8, avoidHours: 72 },
    sandFall: { reaction: 'flee', fear: 0.8, radius: 6, avoidHours: 6 },
    dig: { reaction: 'flee', fear: 0.6, radius: 5, avoidHours: 6 },
    spring: { reaction: 'startle', fear: 0.4, radius: 6 },
    heat: { reaction: 'avoid', fear: 0.4, radius: 4, avoidHours: 12 },
    frost: { reaction: 'startle', fear: 0.3, radius: 4 },
    glow: { reaction: 'curious', fear: 0.2, radius: 6 },
    lightning: { reaction: 'flee', fear: 1, radius: 8, avoidHours: 48 },
    thunder: { reaction: 'startle', fear: 0.4, radius: Infinity },
    corpse: { reaction: 'avoid', fear: 0.3, radius: 3, avoidHours: 24 },
    predator: { reaction: 'flee', fear: 0.95, radius: 8, avoidHours: 24 },
    howl: { reaction: 'startle', fear: 0.35, radius: Infinity },
  },
  // El lobo: solo le asustan el fuego y los rayos; los cadáveres son comida; curioso con el agua nueva
  wolf: {
    fire: { reaction: 'flee', fear: 1, radius: 10, avoidHours: 48 },
    sandFall: { reaction: 'startle', fear: 0.5, radius: 6, avoidHours: 3 },
    dig: { reaction: 'startle', fear: 0.35, radius: 5 },
    spring: { reaction: 'curious', fear: 0.2, radius: 10 },
    heat: { reaction: 'avoid', fear: 0.3, radius: 4, avoidHours: 12 },
    frost: { reaction: 'startle', fear: 0.2, radius: 4 },
    glow: { reaction: 'curious', fear: 0.1, radius: 8 },
    lightning: { reaction: 'flee', fear: 0.9, radius: 10, avoidHours: 24 },
    thunder: { reaction: 'startle', fear: 0.2, radius: Infinity },
    corpse: { reaction: 'ignore', fear: 0, radius: 0 },
    predator: { reaction: 'ignore', fear: 0, radius: 0 },
    howl: { reaction: 'ignore', fear: 0, radius: 0 },
  },
};

/** Qué estímulo provoca cada arena al caer (el Humus no asusta) */
export const SAND_STIMULUS: Readonly<Partial<Record<SandId, StimulusType>>> = {
  duna: 'sandFall', marea: 'dig', manantial: 'spring', brasa: 'heat', escarcha: 'frost', despertar: 'glow', afinidad: 'glow',
};

// ── Miedo ──
/** Por encima de esto huye; por encima de STARTLE se queda quieto, alerta, sin comer */
export const FLEE_FEAR = 0.5;
export const STARTLE_FEAR = 0.2;
/** Huye hasta que el miedo baja de esto (corre hasta relajarse) */
export const RELAXED = 0.25;
/** Lo que baja el miedo por minuto (de 1 a 0 en unas dos horas) */
export const FEAR_DECAY = 0.008;
/** Contagio: si un vecino a menos de estas celdas huye, huye él también (con al menos esta parte de su miedo) */
export const ALARM_RANGE = 6;
export const ALARM_SHARE = 0.8;
/** Costumbre: cada susto sin daño la sube (hasta HABIT_MAX de miedo menos) y se olvida en HABIT_FORGET_DAYS */
export const HABIT_STEP = 0.12;
export const HABIT_MAX = 0.75;
export const HABIT_FORGET_DAYS = 6;
/** Curiosidad: va a mirar cuando el miedo baja de esto, durante estas horas */
export const CURIOUS_BELOW = 0.15;
export const CURIOUS_HOURS = 6;
/** Daño: arena que cae encima y rayo cerca */
export const BURY_HEALTH = 0.3;
export const LIGHTNING_HEALTH = 0.7;
