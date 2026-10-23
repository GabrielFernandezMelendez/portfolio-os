// Especies de fauna. El registro (config/species.config.ts) dice qué come cada una, cómo vive en grupo,
// cuánto vive y cómo cría. La simulación (application/fauna) y el dibujo lo leen todo de aquí.

import { Diet } from './plant.model';
import { SeasonId } from './time.model';
import { MaterialId } from './material.model';
import { RefugeKindId } from './animal.model';

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
  /** Velocidad andando y corriendo (celdas por minuto de juego); las aves, también volando */
  readonly speed: { readonly walk: number; readonly run: number; readonly fly?: number };
  /**
   * Cómo se mueve: andando (rodea agua y terrazas, busca camino) o volando (en línea recta por encima de todo;
   * anda solo distancias cortas). Por defecto, andando.
   */
  readonly locomotion?: 'walk' | 'fly';
  /** Vida que le quita el sol por hora fuera de su refugio, de día (los goblins) */
  readonly sunHurt?: number;
  /** Vida que le quita por hora estar en un refugio helado (la Escarcha apaga la brasa de los goblins) */
  readonly frostHurt?: number;
  /**
   * Franja de temperatura en la que está a gusto (escala del mundo 0..1, ver fauna.config). Fuera de ella acumula
   * frío o calor. Un valor muy alto en `max` = no le afecta el calor.
   */
  readonly comfort: readonly [min: number, max: number];
  /** Hiberna en esas estaciones: se queda en su refugio, durmiendo, y apenas gasta (`needs`: lo que come y bebe) */
  readonly hibernate?: { readonly seasons: readonly SeasonId[]; readonly needs: number };
  /** No le hace nada el fuego ni le asusta (vive en la Tierra Quemada) y puede pisar el suelo calcinado */
  readonly fireproof?: boolean;
  /**
   * Nace con la Tierra Quemada (goblins): pasados `delayDays` días desde que se forma, aparecen sus nidos (uno o dos
   * según el tamaño de la zona, con tope en la isla) con `perNest` de ellos cada uno, por tirada. Mientras quede uno vivo, la Tierra Quemada
   * vive; cuando no queda ninguno, remite. Lo que comen alimenta el suelo quemado (crece más deprisa).
   */
  readonly burntBorn?: {
    readonly delayDays: readonly [number, number];
    /** Una zona más pequeña que esto (tiles) da un nido; desde este tamaño, dos */
    readonly tilesPerNest: number;
    /** Nidos que caben en toda la isla, da igual lo grandes que sean las zonas (y sin sitio no se divide ni se va nadie a fundar otro) */
    readonly maxNests: number;
    /** Criaturas de cada nido al nacer (tirada), más una por cada `extraPerTiles` tiles de la zona, hasta `perNestMax` */
    readonly perNest: readonly [number, number];
    readonly extraPerTiles: number;
    readonly perNestMax: number;
    readonly feedsBurnt: number;
  };
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
   * Sentidos (comunes a todas) [PROPUESTA]:
   * - `smell`: olfato, en islas (× WORLD.CELLS): hasta dónde huele presas o carroña (más lejos, menos probable).
   * - `vigilance`: lo atenta que está: cuánto le cuesta a un depredador que acecha agachado pasar sin que lo vea.
   * - `sight`: vista en celdas, de día y a campo abierto (entre árboles, SIGHT_COVER); `night`: la parte que ve de
   *   noche (1 = igual).
   * - `hearing`: a cuántas celdas oye un ruido normal (volumen 1: un aviso de alarma); los fuertes, más lejos.
   * - `stealth`: depredador: lo que cuesta verle cuando acecha agachado (0..1).
   * - `wary`: presa: distancias (celdas) a un depredador que caza: a `alert` deja de comer y lo mira (el '!'); a
   *   `flee` se aparta. De un depredador saciado, la mitad (CALM_PREDATOR): se nota que no caza.
   */
  readonly senses: {
    readonly smell: number;
    readonly vigilance: number;
    readonly sight: number;
    readonly night: number;
    readonly hearing: number;
    readonly stealth?: number;
    readonly wary?: { readonly alert: number; readonly flee: number };
  };
  /** Depredador: qué caza, cuándo y cómo (ver PredatorDef) */
  readonly predator?: PredatorDef;
  /** Pesca (ver FishingDef) */
  readonly fishing?: FishingDef;
  /**
   * Planta cara a un depredador: se planta (`stand`), el depredador se va (`repel`) o no, puede salir herido
   * (`injure`) y, si el grupo es capaz (humanos), puede matarlo: `kill` por cada compañero cerca que le ayuda.
   */
  readonly defend?: { readonly stand: number; readonly repel: number; readonly injure: number; readonly kill?: number };
  /** Lo que come solo si pasa mucha hambre (el lobo, bayas) */
  readonly starvingDiets?: readonly Diet[];
  /**
   * Refugio (madriguera): lo cava la manada donde el suelo lo permite y dentro duermen, crían y se esconden.
   * Probabilidades por hora: quedarse dentro con lluvia, salir a tomar el sol en sus horas de dormir, salir al
   * acabar esas horas. Y lo que le pasa con las arenas y el agua.
   */
  readonly refuge?: {
    /** Qué construye (agujero, guarida de ramas, nido, choza, nido de carbón) y qué refugio natural ocupa al llegar */
    readonly kind: RefugeKindId;
    readonly natural?: 'cave';
    /** Dónde lo hace: en el suelo (por defecto) o en la copa de un árbol (nido de cuervo) */
    readonly site?: 'ground' | 'tree';
    /** Si los adultos duermen dentro (conejo) o solo las crías (lobo: los adultos duermen fuera, a la entrada) */
    readonly adultsInside: boolean;
    readonly digIn: readonly MaterialId[];
    readonly digHours: number;
    readonly rainStay: number;
    readonly sunbathe: number;
    readonly leave: number;
    /** Si se derrumba (Marea, o tapada mucho tiempo): probabilidad de morir cada uno de los que están dentro */
    readonly collapseDeath: number;
    /** Inundada: por hora, salir a tiempo; si no, ahogarse */
    readonly floodEscape: number;
    readonly drownPerHour: number;
    /** Tapada (arena o humus asentados en la entrada): por hora, destaparla */
    readonly unblock: number;
  };
  /** Jóvenes que se van de su manada al hacerse adultos (y fundan otra), por sexo */
  readonly dispersal?: { readonly male: number; readonly female: number };
  /**
   * Especies que no viven solas (lobo) [PROPUESTA]: el grupo no baja de `herd.min` por falta de presas ni porque se
   * vayan los jóvenes, y el que se queda solo busca un grupo pequeño de los suyos. De noche, el que se aleja encuentra
   * a los suyos por el olfato si están a su alcance (`senses.smell`): no se pierde.
   * - `seekIslands`: hasta dónde huele un grupo pequeño (de menos de `herd.min`) y va a buscarlo.
   * - `welcome`: un grupo pequeño acoge al que llega con esta probabilidad (más que `WELCOME_CHANCE`: les hace falta).
   * - `loneLeaveDays` y `loneLeave`: pasados esos días solo y sin grupo, cada día puede irse de la isla (tirada).
   */
  readonly keepMin?: {
    readonly seekIslands: number;
    readonly welcome: number;
    readonly loneLeaveDays: number;
    readonly loneLeave: number;
  };
  /**
   * Llegadas y marchas naturales [PROPUESTA]. Sin este campo, la especie no llega sola.
   * - `arrive`: cada pocos días, si la isla puede alimentar a más de su especie, puede llegar un grupo por la
   *   orilla (más cuanto más sitio hay).
   * - `groupsPerChunk`: su tope de grupos en la isla, tirado cada vez entre los dos valores (por parcela de PLOT × PLOT chunks, config/island.config.ts). Así
   *   nunca la llena una sola especie: si se pasa, alguno de sus grupos puede irse (`crowdLeave`, más cuanto más
   *   se pase).
   * - `hungryLeave`: cada día, una manada con hambre de verdad puede irse de la isla (más cuanto más hambre).
   * - `onlyIfAbsent`: solo llegan de fuera si no queda ni uno de su especie en la isla (los demás nacen aquí).
   * - `carrionBonus`: la carroña les atrae (más llegadas si la hay), pero no la necesitan para llegar.
   * - `carrionLure`: llegan atraídos por el olor de los cadáveres: sin carroña en la isla no llegan, y con ella la
   *   tirada se multiplica por este valor.
   * - `founders` y `extraYoung`: quiénes llegan de fuera, si no son los fundadores de la especie (p. ej. el lobo:
   *   una pareja, que es como se funda un territorio nuevo), y cuántos jóvenes traen además (tirada entre los dos
   *   valores). `extraAdults`: adultos de más (tirada), para que cada grupo que llega sea distinto.
   */
  readonly migration?: {
    readonly arrive: number;
    readonly groupsPerChunk: readonly [number, number];
    readonly crowdLeave: number;
    readonly hungryLeave?: number;
    readonly onlyIfAbsent?: boolean;
    readonly carrionLure?: number;
    /** Especies de celo: probabilidad de que cada hembra adulta que llega entre el celo y los partos venga preñada */
    readonly pregnant?: number;
    /** Con carroña en la isla llegan más (la tirada se multiplica), pero también llegan sin ella (cuervo) */
    readonly carrionBonus?: number;
    readonly founders?: readonly { readonly sex: 'male' | 'female'; readonly age: 'adult' | 'young' }[];
    readonly extraYoung?: readonly [number, number];
    readonly extraAdults?: readonly [number, number];
  };
  /** Cuánto come en invierno respecto a lo normal (el ciervo real come menos y tira de sus reservas). Por defecto 1 */
  readonly winterAppetite?: number;
  /**
   * Enfermedad contagiosa (tipo mixomatosis), el freno natural de las especies que crían mucho: con
   * superpoblación (densidad > crowdedAbove) brota al día con `outbreak`; se contagia dentro de la manada
   * (`spread` al día por enfermo), dura `days` días y mata con `lethality` (quien sobrevive queda inmune).
   */
  /**
   * Enfermedad contagiosa. Brota (tirada al día `outbreak`) cuando la especie está apretada por encima de
   * `crowdedAbove`: por falta de comida, por una colonia casi llena o por estar cerca de su tope de grupos en la
   * isla; cuanto más apretada, más probable.
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
  /**
   * Volver a dormir con los suyos tampoco es seguro: cada tarde, con `late`, se entretiene y sale tarde (entre
   * `lateMinutes`), así que puede no llegar y pasar la noche perdido. Con refugio, la guía vuelve hacia él cada
   * hora con `leaderReturn` cuando se ha alejado comiendo (alguna noche la manada come lejos).
   */
  readonly homing: { readonly late: number; readonly lateMinutes: readonly [number, number]; readonly leaderReturn?: number };
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
  /** Solo cría la pareja dominante de la manada (lobo) */
  readonly dominantOnly?: boolean;
  /** Camada por tirada (si no, una cría o, bien comida, gemelos) */
  readonly litter?: { readonly sizes: readonly number[]; readonly weights: readonly number[] };
  /** Días que las crías pasan dentro del refugio y probabilidad al día de no salir adelante sin su madre */
  readonly nurseDays?: number;
  readonly orphanDeath?: number;
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

/**
 * Depredador [PROPUESTA]. Con la saciedad por debajo de `huntBelow`, cada hora sale a cazar con `huntChance`
 * (antes, si huele carroña, va a por ella con `carrion`). Elige presa por olfato: las de `prey` (peso de
 * preferencia por especie), mejor las débiles (crías, viejas, enfermas, heridas, solas). Acecha andando; si la
 * presa le ve, persigue corriendo; al alcanzarla la caza con `catch` (adulta, cría, débil) + `packBonus` por cada
 * compañero que caza con él (hasta `packMax`) + `snowBonus` con nieve. Persiguiendo más de `giveUpAfter` minutos,
 * cada 5 minutos abandona con `giveUp`. Con poca presa cerca de su guarida, se va de viaje de caza (`trip`).
 */
/**
 * Pesca [PROPUESTA]: con la saciedad por debajo de `below` y sin otra presa a mano, va al agua honda a pescar (hasta
 * `waterRange`). Cada intento (cada vez que piensa) saca un pez con `catch`; un pez da `gain` de saciedad: poco
 * nutritivo, pero quita el hambre.
 */
export interface FishingDef {
  readonly below: number;
  readonly catch: number;
  readonly gain: number;
}

export interface PredatorDef {
  /** Pica los huesos (cuervo): sigue comiendo de un cadáver cuando a los demás ya no les compensa (BONES_LEFT) */
  readonly bones?: boolean;
  /** Comparte la presa: cuando uno caza, la manada acude a comer (SHARE_RANGE) */
  readonly shareKill?: boolean;
  /** Tirada (por pensamiento) de llevar comida a los jóvenes que aún no cazan, si está bien comido */
  readonly feedYoung?: number;
  /** Por debajo de esta saciedad ya va a por carroña, aunque aún no cace (por defecto, huntBelow) */
  readonly carrionBelow?: number;
  readonly prey: Readonly<Record<string, number>>;
  readonly huntBelow: number;
  readonly huntChance: number;
  readonly carrion: number;
  readonly catch: Readonly<Record<string, { readonly adult: number; readonly young: number; readonly weak: number }>>;
  readonly packBonus: number;
  readonly packMax: number;
  readonly joinHunt: number;
  readonly snowBonus: number;
  readonly giveUpAfter: number;
  readonly giveUp: number;
  /** Viajes de caza: probabilidad al día con poca presa cerca, días fuera y hasta dónde (islas) */
  readonly trip: { readonly chance: number; readonly days: readonly [number, number]; readonly islands: number };
  /** Llevar carne a las crías de la guarida: cansa más (×) y probabilidad de que otro le releve */
  readonly carry: { readonly tire: number; readonly relay: number };
  /** Aullido al anochecer (probabilidad por día); en los goblins, su grito de guerra al salir */
  readonly howl: number;
  /** Saciedad por debajo de la que también come plantas (el lobo solo con mucha hambre; el cuervo, casi siempre) */
  readonly plantsBelow?: number;
  /** Carroñero que roba: probabilidad por bocado de llevarse un trozo de carne y alejarse con él (el cuervo) */
  readonly hoard?: number;
  /** Con hambre y sin carroña a la vista: probabilidad por hora de volver a mirar donde encontró cadáveres */
  readonly revisit?: number;
}
