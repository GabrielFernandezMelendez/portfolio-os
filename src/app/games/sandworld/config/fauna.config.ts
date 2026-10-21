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

// ── Diario ──
export const DIARY_PER_DAY = 3;
export const DIARY_KEEP = 30;
