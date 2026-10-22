import { SpeciesDef } from '../domain/models/species.model';
import { Season } from '../domain/models/time.model';
import { Material } from '../domain/models/material.model';

/*
  Registro de especies [PROPUESTA]: valores de partida para afinar jugando (fase de pulido).
  Añadir una = una entrada aquí (id siguiente), su dibujo (bloque C3), sus nombres en config/animal-names.config.ts
  y sus textos en i18n (species.<key>). Un año de juego son 120 días (4 estaciones de 30).
*/
export const SPECIES_DEFS: readonly SpeciesDef[] = [
  {
    id: 0, key: 'deer', size: 'large',
    // Pasta hierba, ramonea hojas y brotes y come los frutos que caen de árboles y arbustos
    diets: ['grazer', 'browser', 'frugivore'],
    herd: { min: 4, max: 9, cohesion: 5 },
    // Cada uno quiere ~3 celdas para él; pastando la manada se abre a 1,8 × la cohesión; apiñados, a un tercio
    spacing: { personal: 3, graze: 1.8, huddle: 0.35 },
    // Crepuscular: come sobre todo al amanecer y al atardecer; con calor sestea a mediodía
    activeHours: [[5, 9], [18, 22]], siestaHours: [12, 16],
    // Corriendo va unas 6 veces más rápido que andando (un ciervo de verdad, hasta 10)
    speed: { walk: 0.12, run: 0.7 },
    // De día un adulto explora hasta 1,5 islas lejos de los suyos; huyendo se aleja hasta 1 isla del peligro
    range: { roam: 1.5, flee: 1 },
    // Huye lejos; a veces se queda clavado un momento antes de salir; casi siempre coge el miedo de los suyos
    flight: { mode: 'away', freeze: 0.2, alarm: 0.9, zigzag: 0 },
    // Huele media isla; ve a un depredador que se acerca con un 15 % cada minuto
    senses: { smell: 0.5, vigilance: 0.15 },
    // Un adulto se planta a veces: el lobo se va la mitad de esas veces y puede llevarse una coz
    defend: { stand: 0.2, repel: 0.5, injure: 0.05 },
    // Después de correr jadea 20 minutos y en 2 horas no pega ojo
    afterRun: { pant: 20, awake: 120 },
    gatherHours: 2,
    // 1 de cada 10 tardes se entretiene y sale tarde hacia donde duerme la manada (de 1 a 5 horas tarde)
    homing: { late: 0.1, lateMinutes: [60, 300] },
    // Si corre toda la manada: 3 de cada 4 salen juntos; el que se separa encuentra a los suyos 6 de cada 10 veces
    herdRun: { together: 0.75, findBack: 0.6 },
    // Vive de 4 a 7 años (de 480 a 840 días): así sus crías no solo reponen a los viejos y sobra alguno para el lobo
    youngDays: 20, adultDays: 60, lifespanDays: [480, 840],
    breeding: {
      mode: 'rut', rutSeason: Season.AUTUMN, birthSeason: Season.SPRING,
      conceivePerDay: 0.12, minSatiety: 0.5, twinsChance: 0.4, twinsSatiety: 0.8,
    },
    // Llena el estómago con 0,125 de comida (½ tile de hierba): come ~¼ de tile de hierba al día
    stomach: 0.125, bitePerMinute: 0.00035, hungerPerDay: 0.5,
    // Se vacía de agua en algo más de un día; bebe hasta llenarse en ~40 minutos
    thirstPerDay: 0.8, drinkPerMinute: 0.025,
    tirePerDay: 0.9, restPerHour: 0.15, sleepHours: [22, 5],
    waterRange: 12, thirstSearch: 30, corpseDays: 3,
    // Llega una manada si hay hierba para más ciervos; con hambre de verdad, la manada puede irse de la isla
    migration: { arrive: 0.3, hungryLeave: 0.4 },
  },
  {
    id: 1, key: 'rabbit', size: 'small',
    // Hierba sobre todo; en invierno, corteza y hojas de los arbustos
    diets: ['grazer', 'browser'],
    // Colonias de 3 a 12 alrededor de su madriguera, muy juntos
    herd: { min: 3, max: 12, cohesion: 3 },
    spacing: { personal: 1.2, graze: 1.6, huddle: 0.4 },
    // Nocturno: sale al anochecer, come de noche y vuelve al amanecer; de día descansa dentro
    activeHours: [[18, 22], [4, 7]], siestaHours: [12, 16],
    sleepHours: [7, 18],
    // Saltitos andando; carreras cortas y muy rápidas
    speed: { walk: 0.15, run: 1 },
    // Los machos se alejan hasta media isla de la madriguera, las hembras menos; huyendo, como mucho 0,3 islas
    range: { roam: 0.5, roamFemale: 0.3, flee: 0.3 },
    // Ante un susto: 55 % se queda quieto, si no corre a la madriguera; 80 % coge la alarma; zigzag al huir
    flight: { mode: 'refuge', freeze: 0.55, alarm: 0.8, zigzag: 0.3 },
    // Huele poco pero vigila mucho (25 % cada minuto)
    senses: { smell: 0.3, vigilance: 0.25 },
    afterRun: { pant: 10, awake: 60 },
    gatherHours: 1,
    // 15 de cada 100 amaneceres se entretiene y vuelve tarde (de media hora a 4 horas); la guía, si se ha alejado
    // comiendo, vuelve hacia la madriguera con un 60 % cada hora
    homing: { late: 0.15, lateMinutes: [30, 240], leaderReturn: 0.6 },
    // Corriendo toda la colonia: 9 de cada 10 van juntos; el despistado vuelve al amanecer 7 de cada 10 veces
    herdRun: { together: 0.9, findBack: 0.7 },
    youngDays: 12, adultDays: 35, lifespanDays: [150, 300],
    breeding: {
      mode: 'season', seasons: [Season.SPRING, Season.SUMMER], conceivePerDay: 0.08, minSatiety: 0.4, gestationDays: 10,
      // De 2 a 7 crías; lo más probable, 4 o 5. Con superpoblación, 2 menos; con hambre, 1 menos (nunca menos de 2)
      litter: { sizes: [2, 3, 4, 5, 6, 7], weights: [8, 15, 24, 24, 18, 11] }, crowdShift: 2, hungryShift: 1,
      nurseDays: 7, orphanDeath: 0.5,
    },
    // Come poco en total (un ciervo come por diez conejos) pero mucho para su tamaño
    stomach: 0.01, bitePerMinute: 0.00017, hungerPerDay: 0.6,
    // Saca parte del agua de las plantas, pero bebe cada día (el conejo real no aguanta un día sin beber)
    thirstPerDay: 0.5, drinkPerMinute: 0.05, waterFromFood: 0.5,
    tirePerDay: 0.9, restPerHour: 0.15,
    waterRange: 8, thirstSearch: 20, corpseDays: 2,
    refuge: {
      kind: 'burrow', adultsInside: true,
      digIn: [Material.SOIL, Material.HUMUS, Material.PEAT], digHours: 12,
      rainStay: 0.7, sunbathe: 0.15, leave: 0.9,
      collapseDeath: 0.4, floodEscape: 0.7, drownPerHour: 0.3, unblock: 0.8,
    },
    dispersal: { male: 0.6, female: 0.25 },
    migration: { arrive: 0.3, hungryLeave: 0.3 },
    disease: { outbreak: 0.02, crowdedAbove: 1.3, spread: 0.25, days: 5, lethality: 0.6 },
    founders: [
      { sex: 'female', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'female', age: 'adult' },
      { sex: 'male', age: 'adult' }, { sex: 'male', age: 'adult' },
    ],
  },
  {
    id: 2, key: 'wolf', size: 'medium',
    // Carne: presas y carroña; con mucha hambre, bayas
    diets: ['carnivore'], starvingDiets: ['frugivore'],
    herd: { min: 3, max: 8, cohesion: 5 },
    spacing: { personal: 2, graze: 1.6, huddle: 0.4 },
    // Activo al anochecer y de noche; descansa de día
    activeHours: [[17, 23], [3, 7]], siestaHours: [12, 16],
    sleepHours: [9, 16],
    speed: { walk: 0.14, run: 0.75 },
    // Recorre hasta 2 islas; huyendo (del fuego), una
    range: { roam: 2, flee: 1 },
    flight: { mode: 'away', freeze: 0.05, alarm: 0.9, zigzag: 0 },
    // Huele hasta 2 islas; vigila poco (nadie le caza)
    senses: { smell: 2, vigilance: 0.05 },
    predator: {
      prey: { deer: 1, rabbit: 0.6 },
      huntBelow: 0.5, huntChance: 0.4, carrion: 0.8,
      catch: {
        deer: { adult: 0.15, young: 0.5, weak: 0.4 },
        rabbit: { adult: 0.35, young: 0.6, weak: 0.5 },
      },
      packBonus: 0.05, packMax: 4, joinHunt: 0.7, snowBonus: 0.15,
      giveUpAfter: 20, giveUp: 0.7,
      trip: { chance: 0.5, days: [2, 4], islands: 2 },
      carry: { tire: 2, relay: 0.5 },
      howl: 0.6,
    },
    afterRun: { pant: 15, awake: 90 },
    gatherHours: 2,
    homing: { late: 0.1, lateMinutes: [60, 240] },
    herdRun: { together: 0.85, findBack: 0.6 },
    youngDays: 30, adultDays: 90, lifespanDays: [300, 500],
    breeding: {
      // Celo en invierno, cachorros en primavera; solo la pareja dominante; de 2 a 7 (3 o 4 lo más común)
      mode: 'rut', rutSeason: Season.WINTER, birthSeason: Season.SPRING, dominantOnly: true,
      conceivePerDay: 0.3, minSatiety: 0.4, twinsChance: 0, twinsSatiety: 1,
      litter: { sizes: [2, 3, 4, 5, 6, 7], weights: [10, 22, 28, 22, 12, 6] },
      nurseDays: 10, orphanDeath: 0.4,
    },
    // Atracón y ayuno: llena el estómago con 0,15 de carne y pierde poca saciedad al día (aguanta días)
    stomach: 0.15, bitePerMinute: 0.004, hungerPerDay: 0.3,
    thirstPerDay: 0.8, drinkPerMinute: 0.03,
    tirePerDay: 0.9, restPerHour: 0.15,
    waterRange: 14, thirstSearch: 40, corpseDays: 3,
    refuge: {
      kind: 'den', natural: 'cave', adultsInside: false,
      digIn: [Material.SOIL, Material.HUMUS, Material.ROCK, Material.SAND, Material.PEAT], digHours: 24,
      rainStay: 0, sunbathe: 0, leave: 1,
      collapseDeath: 0.5, floodEscape: 0.6, drownPerHour: 0.3, unblock: 0.6,
    },
    dispersal: { male: 0.5, female: 0.35 },
    // Solo llega si hay presas (su capacidad sale de la carne en pie); con hambre de verdad, se va antes de morir
    migration: { arrive: 0.3, hungryLeave: 0.5 },
    founders: [
      { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }, { sex: 'female', age: 'adult' },
      { sex: 'male', age: 'adult' }, { sex: 'female', age: 'young' },
    ],
  },
];

export const SPECIES_BY_KEY: Readonly<Record<string, SpeciesDef>> = Object.fromEntries(SPECIES_DEFS.map(s => [s.key, s]));
