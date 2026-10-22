// Equilibrio de la fauna [PROPUESTA]: valores de partida, se afinan en la fase de pulido.
// El riesgo es doble: con mucha comida nacen muchas crías que luego pueden morir de hambre (las crías se
// deciden en el celo y nacen meses después, pase lo que pase); y una manada pequeña es frágil.

/** Cada cuántos minutos piensa cada animal qué hacer (se reparten para no pensar todos a la vez) */
export const THINK_MINUTES = 5;

// ── Comer y dormir ──
/** Empieza a buscar comida por debajo de esta saciedad y para al llegar a FULL */
export const EAT_BELOW = 0.65;
export const FULL = 0.95;
/** Se duerme de puro cansancio por debajo de este sueño (aunque sea de día) */
export const SLEEP_BELOW = 0.15;
/** Celdas alrededor en las que busca comida y cuántos sitios mira */
export const FORAGE_RADIUS = 10;
export const FORAGE_SAMPLES = 16;
/** Comida mínima en el tile para quedarse comiendo en vez de ir a otro sitio */
export const FOOD_HERE = 0.03;

/** Desnivel máximo (niveles) que sube o baja de un paso: las terrazas altas hay que rodearlas */
export const MAX_STEP = 1.3;
/**
 * Rutas: si el camino recto se atasca y el destino está a más de PATH_FROM celdas, busca un camino (como mucho
 * PATH_NODES celdas mirando, para no gastar). Si no lo hay, no vuelve a intentarlo hasta STUCK_MINUTES después.
 */
export const PATH_FROM = 3;
export const PATH_NODES = 6000;
export const STUCK_MINUTES = 120;
/** Va a beber por debajo de esta hidratación (antes que a comer, salvo que el hambre apriete más); bebe a DRINK_RANGE celdas del agua */
export const THIRST_BELOW = 0.45;
export const DRINK_RANGE = 1.6;
/** Por debajo de esta hidratación la sed va antes que todo lo demás (cazar, volver a casa, dormir) */
export const THIRST_URGENT = 0.2;
/** Las aves vuelan si van a más de estas celdas (si no, andan a saltitos) */
export const FLY_FROM = 3;
/** Horas de sol (lo que quema a los goblins fuera de su nido) */
export const SUN_HOURS: readonly [number, number] = [7, 19];
/** Si en este rato (minutos) no consigue acercarse al agua, la da por imposible durante WATER_GIVE_UP_HOURS */
export const WATER_STUCK_MINUTES = 60;
export const WATER_GIVE_UP_HOURS = 6;

// ── Correr ──
/**
 * Sueño que gasta por minuto corriendo; para al bajar de RUN_STOP. Hace falta RUN_MIN para echar a correr.
 * Una carrera de una isla (~45 minutos) gasta ~0,3: cansa, pero no deja dormido.
 */
export const RUN_TIRE_PER_MINUTE = 0.006;
export const RUN_STOP = 0.15;
export const RUN_MIN = 0.3;
/** Con adrenalina solo se duerme si está así de agotado */
export const COLLAPSE = 0.05;
/** Minutos que se queda clavado del susto (si le toca quedarse quieto) antes de echar a correr */
export const FREEZE_MINUTES = 8;

// ── Madrigueras ──
/** Celdas alrededor de la manada en que busca dónde cavar, y alcance (celdas) de una arena que cae en su entrada */
export const BURROW_SEARCH = 12;
export const BURROW_HIT = 2;
/** Llegando a la entrada (celdas) se mete dentro */
export const BURROW_ENTER = 0.8;
/** Días que aguanta una madriguera abandonada antes de hundirse (si nadie la ocupa) */
export const BURROW_ABANDON_DAYS = 30;
/**
 * Lo que aguanta cada tipo de refugio [PROPUESTA]: probabilidad de derrumbarse con cada Marea encima y, tapado por
 * arena o humus, por hora y por cada nivel que ha subido el suelo en la entrada (más cantidad y más tiempo, más
 * probable). La cueva es roca: no se derrumba, como mucho se tapa. Se tapa a partir de COVER_LEVELS de subida.
 */
export const REFUGE_KINDS = {
  burrow: { collapsePerDig: 0.15, collapsePerHour: 0.03 },
  den: { collapsePerDig: 0.08, collapsePerHour: 0.015 },
  cave: { collapsePerDig: 0, collapsePerHour: 0 },
  // En la copa de un árbol: la arena y la Marea no le llegan
  nest: { collapsePerDig: 0, collapsePerHour: 0 },
  hut: { collapsePerDig: 0.1, collapsePerHour: 0.02 },
  lair: { collapsePerDig: 0.12, collapsePerHour: 0.02 },
} as const;
export const COVER_LEVELS = 0.6;

// ── Depredación ──
/** Celdas a las que una presa puede ver a un depredador que se le acerca (cada minuto, con su vigilancia) */
export const VIGIL_RANGE = 8;
/** Distancia (celdas) a la que el depredador alcanza a la presa o llega a la carroña */
export const CONTACT = 1.2;
/** Carne de un cadáver según su tamaño (comida; un lobo llena el estómago con 0,15) */
export const MEAT_BY_SIZE = { small: 0.06, medium: 0.25, large: 0.6 } as const;
/** Carne que come por minuto un carnívoro y trozo que lleva a la guarida */
export const MEAT_BITE = 0.004;
export const CARRY_PIECE = 0.05;
/** Huele a sus presas cada vez que piensa con esta probabilidad como mucho (luego, menos cuanto más lejos) */
export const SMELL_SHARPNESS = 0.9;
/** Dentro sale si el hambre o la sed aprietan */
export const INSIDE_HUNGRY = 0.3;

// ── Explorar y volver a dormir con los suyos ──
/** Probabilidad, cada vez que piensa estando tranquilo, de irse de excursión por su cuenta, y horas que dura */
export const ROAM_CHANCE = 0.05;
export const ROAM_HOURS: readonly [min: number, max: number] = [2, 5];
/** Minutos de margen para llegar a tiempo al sitio de dormir */
export const GATHER_MARGIN = 30;
/**
 * Pasada la medianoche (2 horas después de acostarse), quien siga lejos del sitio de dormir (× cohesión) se ha
 * perdido: puede volver por la mañana, unirse a otra manada (si hay una a JOIN_RANGE) o quedarse solo.
 */
export const LOST_NIGHT = 3;
export const JOIN_RANGE = 16;
export const RETURN_CHANCE = 0.5;
/** Otra manada lo acoge con esta probabilidad; si no, lo echa (pierde vida) */
export const WELCOME_CHANCE = 0.6;
export const REJECT_HEALTH = 0.1;

// ── Vida (salud) ──
/** Vida que pierde al día con el estómago vacío, sin agua o sin dormir nada; la que recupera bien comido y descansado */
export const STARVE_HEALTH_PER_DAY = 0.3;
export const DEHYDRATE_HEALTH_PER_DAY = 0.45;
export const EXHAUSTED_HEALTH_PER_DAY = 0.15;
export const HEAL_PER_DAY = 0.1;
/** Crías y viejos aguantan peor el hambre (pierden vida más deprisa) */
export const FRAIL_FACTOR = 1.5;
/** Parte de su vida a partir de la cual un animal es viejo (frágil) */
export const ELDER_FROM = 0.8;
/** Vida que quita una planta tóxica según su efecto */
export const TOXIC_HEALTH = { lethal: 0.8, sick: 0.35, confused: 0.15 } as const;
/** Vida que quita por minuto estar en un tile en llamas */
export const FIRE_HEALTH_PER_MINUTE = 0.05;

// ── Felicidad ──
/** Lo deprisa (por día) que la felicidad se acerca a lo que le corresponde */
export const HAPPY_RATE = 2;
/** Por debajo de esta felicidad no cría */
export const BREED_HAPPINESS = 0.4;

// ── Daño al hábitat ──
/**
 * Pisoteo por hora en un tile con n animales: la vegetación pequeña pierde TRAMPLE × n² y, desde SOIL_DAMAGE_FROM
 * animales, el suelo pierde SOIL_DAMAGE × n² de fertilidad. Crece con el cuadrado: una especie desbocada arrasa.
 */
export const TRAMPLE = 0.0003;
export const SOIL_DAMAGE_FROM = 3;
export const SOIL_DAMAGE = 0.0008;

// ── Población ──
/** Días de comida en pie que cuentan para la capacidad de la isla (población que puede alimentar) */
export const CAPACITY_DAYS = 30;
/** Densidad (población / capacidad) a partir de la cual se sienten apretados */
export const CROWDED = 1;
/** Fertilidad que deja un cadáver al deshacerse */
export const CORPSE_FERTILITY = 0.08;
/** Horas que tarda en plantar las semillas de un fruto */
export const SEED_GUT_HOURS = 12;
/** Días como mucho que tarda en nacer una cría desde que empieza su estación */
export const BIRTH_SPREAD_DAYS = 10;

// ── Llegadas y marchas [PROPUESTA] ──
/** Cada cuántos días se mira si llega un grupo nuevo a la isla (con margen para que haya épocas tensas) */
export const MIGRATION_EVERY_DAYS = 3;
/**
 * Grupos que caben por chunk: el tope se tira cada vez entre estos dos valores (en un 2×2, de 4 a 8 grupos).
 * Así unas veces la isla está más llena y otras más vacía: el tope también es una probabilidad.
 */
export const GROUPS_PER_CHUNK: readonly [number, number] = [1, 2];
/**
 * Hambre de verdad: con la saciedad media por debajo de esto (estómago vacío) la manada se plantea irse; la
 * probabilidad sube con la vida que ya han perdido, y es la máxima (`hungryLeave`) al perder LEAVE_HEALTH_SPAN.
 */
export const LEAVE_HUNGRY_BELOW = 0.05;
export const LEAVE_HEALTH_SPAN = 0.5;
/** Horas como mucho que tarda una manada en salir de la isla (si no llega a la orilla, se va igual) */
export const LEAVE_HOURS = 24;
/**
 * Una especie que ha desaparecido de la isla (se fue o se extinguió) no vuelve antes de 60 días; desde ahí su
 * tirada de llegada sube poco a poco hasta los 80 (y sigue siendo una tirada: puede tardar más).
 */
export const RETURN_AFTER_DAYS: readonly [number, number] = [60, 80];

// ── Memoria y búsqueda de agua y comida ──
/** Sitios de agua y de comida que recuerda una manada (los últimos buenos) */
export const MEMORY_SPOTS = 3;
/** Cada hora sin encontrar, busca más lejos (por este factor), hasta SEARCH_MAX_ISLANDS islas */
export const SEARCH_GROWTH = 1.5;
export const SEARCH_MAX_ISLANDS = 4;

// ── Diario ──
export const DIARY_PER_DAY = 3;
export const DIARY_KEEP = 30;
