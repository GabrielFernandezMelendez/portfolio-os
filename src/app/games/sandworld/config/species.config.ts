import { SpeciesDef } from '../domain/models/species.model';
import { Season } from '../domain/models/time.model';
import { Material } from '../domain/models/material.model';

/*
  Registro de especies [PROPUESTA]: valores de partida para afinar jugando (fase de pulido).
  Añadir una = una entrada aquí (id siguiente), su dibujo (bloque C3), sus nombres en config/animal-names.config.ts
  y sus textos en i18n (species.<key>). Un año de juego son 120 días (4 estaciones de 30).
*/
const FA = { sex: 'female', age: 'adult' } as const;
const MA = { sex: 'male', age: 'adult' } as const;
const FY = { sex: 'female', age: 'young' } as const;
const MY = { sex: 'male', age: 'young' } as const;

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
    // Llega una manada si hay hierba para más ciervos (de 1 a 5 manadas en un 2×2); en invierno come un 30 % menos
    // Llega una manada distinta cada vez: dos hembras y un macho, y por tirada de 0 a 2 adultos y de 0 a 2 crías más
    migration: { arrive: 0.3, groupsPerChunk: [0.25, 1.25], crowdLeave: 0.3, founders: [{ sex: 'female', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }], extraAdults: [0, 2], extraYoung: [0, 2] },
    winterAppetite: 0.7,
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
    // De 3 a 4 colonias en un 2×2 (así siempre queda sitio para otras especies); en invierno come un 20 % menos
    // Llega una pareja y, por tirada, de 1 a 4 adultos más
    migration: { arrive: 0.3, groupsPerChunk: [0.75, 1], crowdLeave: 0.3, founders: [{ sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }], extraAdults: [1, 4] },
    winterAppetite: 0.8,
    // Brota con la colonia casi llena o con la isla cerca de su tope de colonias (o si falta comida)
    disease: { outbreak: 0.02, crowdedAbove: 0.8, spread: 0.25, days: 5, lethality: 0.6 },
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
      // Al humano lo evita: solo se atreve con un niño (y no siempre)
      prey: { deer: 1, rabbit: 0.6, human: 0.15, crow: 0.1 },
      huntBelow: 0.5, huntChance: 0.4, carrion: 0.8,
      catch: {
        deer: { adult: 0.15, young: 0.5, weak: 0.4 },
        rabbit: { adult: 0.35, young: 0.6, weak: 0.5 },
        human: { adult: 0, young: 0.3, weak: 0 },
        // Un pollo de cuervo caído del nido o un cuervo herido
        crow: { adult: 0, young: 0.4, weak: 0.15 },
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
    // De 1 a 2 manadas en un 2×2. De fuera solo llegan si no queda ningún lobo y les atrae el olor de la carroña
    // (la segunda manada nace aquí: jóvenes que fundan la suya). Con hambre de verdad, se van antes de morir
    // De fuera llega una pareja (a veces con un joven): una manada de 5 no se sostiene en una isla pequeña
    migration: {
      arrive: 0.3, groupsPerChunk: [0.25, 0.5], crowdLeave: 0.3, hungryLeave: 0.5, onlyIfAbsent: true, carrionLure: 3,
      founders: [{ sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }], extraYoung: [1, 3],
    },
    winterAppetite: 1.2,
    founders: [
      { sex: 'female', age: 'adult' }, { sex: 'male', age: 'adult' }, { sex: 'female', age: 'adult' },
      { sex: 'male', age: 'adult' }, { sex: 'female', age: 'young' },
    ],
  },
  {
    id: 3, key: 'crow', size: 'small',
    // Carroñero ante todo; come fruta y semillas casi siempre y, a veces, caza una cría de conejo
    diets: ['frugivore', 'bird'],
    herd: { min: 2, max: 6, cohesion: 4 },
    spacing: { personal: 1.2, graze: 1.6, huddle: 0.4 },
    activeHours: [[6, 10], [16, 19]], siestaHours: [13, 15],
    sleepHours: [20, 5],
    // Vuela en línea recta por encima de todo (y deprisa); de cerca anda a saltitos
    locomotion: 'fly',
    speed: { walk: 0.08, run: 0.9, fly: 1.1 },
    range: { roam: 2.5, flee: 1 },
    flight: { mode: 'away', freeze: 0, alarm: 0.95, zigzag: 0 },
    // Huele (y ve) la carroña hasta 3 islas; muy atento a todo
    senses: { smell: 3, vigilance: 0.3 },
    predator: {
      prey: { rabbit: 1 },
      huntBelow: 0.6, huntChance: 0.15, carrion: 0.95,
      catch: { rabbit: { adult: 0, young: 0.3, weak: 0.08 } },
      packBonus: 0.03, packMax: 2, joinHunt: 0.3, snowBonus: 0,
      giveUpAfter: 5, giveUp: 0.8,
      trip: { chance: 0.3, days: [1, 2], islands: 3 },
      carry: { tire: 1.2, relay: 0.4 },
      howl: 0,
      // Come fruta casi siempre; en una presa ajena roba trozos y se aparta con ellos; vuelve a donde mata el lobo
      plantsBelow: 0.9, hoard: 0.08, revisit: 0.3,
    },
    afterRun: { pant: 5, awake: 30 },
    gatherHours: 1,
    homing: { late: 0.1, lateMinutes: [30, 180] },
    herdRun: { together: 0.8, findBack: 0.8 },
    // Vive de 4 a 8 años (casi todos mueren jóvenes en la naturaleza: aquí lo deciden los demás)
    youngDays: 25, adultDays: 120, lifespanDays: [480, 960],
    breeding: {
      // Una nidada en primavera: de 2 a 6 huevos (3 o 4 lo más común); los pollos, en el nido sus primeros días
      mode: 'season', seasons: [Season.SPRING], conceivePerDay: 0.1, minSatiety: 0.4, gestationDays: 8,
      litter: { sizes: [2, 3, 4, 5, 6], weights: [10, 28, 34, 18, 10] }, crowdShift: 1, hungryShift: 1,
      nurseDays: 14, orphanDeath: 0.3,
    },
    stomach: 0.02, bitePerMinute: 0.0006, hungerPerDay: 0.6,
    thirstPerDay: 0.7, drinkPerMinute: 0.06,
    tirePerDay: 0.9, restPerHour: 0.15,
    waterRange: 20, thirstSearch: 60, corpseDays: 2,
    // Nido de ramas en la copa de un árbol (ahí no le llegan la arena ni la Marea); duermen posados a su lado
    refuge: {
      kind: 'nest', site: 'tree', adultsInside: false,
      digIn: [Material.SOIL, Material.HUMUS, Material.SAND, Material.PEAT, Material.ROCK], digHours: 36,
      rainStay: 0, sunbathe: 0, leave: 1,
      collapseDeath: 0.3, floodEscape: 1, drownPerHour: 0, unblock: 0.9,
    },
    dispersal: { male: 0.7, female: 0.6 },
    // Llega una pareja con de 1 a 3 jóvenes; de 1 a 2 grupos en un 2×2
    migration: {
      arrive: 0.25, groupsPerChunk: [0.25, 0.5], crowdLeave: 0.3,
      founders: [FA, MA], extraYoung: [1, 3],
    },
    founders: [FA, MA, FY, MY],
  },
  {
    id: 4, key: 'human', size: 'medium',
    // Cazadores-recolectores: de todo lo que se recoge (hierbas, setas, bayas, frutos secos) y caza en grupo, con lanza
    diets: ['omnivore'],
    herd: { min: 2, max: 10, cohesion: 6 },
    spacing: { personal: 1.5, graze: 2, huddle: 0.5 },
    activeHours: [[7, 11], [16, 20]], siestaHours: [13, 15],
    sleepHours: [22, 6],
    speed: { walk: 0.1, run: 0.55 },
    range: { roam: 1.5, roamFemale: 1, flee: 1 },
    // Ante un peligro, a la choza
    flight: { mode: 'refuge', freeze: 0.1, alarm: 0.7, zigzag: 0 },
    senses: { smell: 0.6, vigilance: 0.2 },
    predator: {
      prey: { deer: 1, rabbit: 0.7 },
      huntBelow: 0.55, huntChance: 0.3, carrion: 0.3,
      catch: {
        deer: { adult: 0.2, young: 0.45, weak: 0.4 },
        rabbit: { adult: 0.3, young: 0.5, weak: 0.45 },
      },
      packBonus: 0.07, packMax: 4, joinHunt: 0.6, snowBonus: 0.1,
      giveUpAfter: 30, giveUp: 0.6,
      trip: { chance: 0.2, days: [1, 3], islands: 1.5 },
      carry: { tire: 1.5, relay: 0.6 },
      howl: 0,
      plantsBelow: 0.8,
    },
    // Se defienden en grupo: si le atacan, se planta casi siempre y, con ayuda, puede matar al atacante
    defend: { stand: 0.7, repel: 0.7, injure: 0.3, kill: 0.15 },
    afterRun: { pant: 10, awake: 60 },
    gatherHours: 2,
    homing: { late: 0.05, lateMinutes: [30, 120], leaderReturn: 0.8 },
    herdRun: { together: 0.9, findBack: 0.8 },
    // Crecen despacio y viven mucho (de 12 a 20 años de juego)
    youngDays: 120, adultDays: 200, lifespanDays: [1500, 2500],
    breeding: {
      // Cualquier estación, despacio: un hijo (a veces dos) y solo bien comidos; el bebé, en la choza al principio
      mode: 'season', seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      conceivePerDay: 0.01, minSatiety: 0.6, gestationDays: 30,
      litter: { sizes: [1, 2], weights: [97, 3] }, crowdShift: 0, hungryShift: 0,
      nurseDays: 20, orphanDeath: 0.2,
    },
    stomach: 0.08, bitePerMinute: 0.0005, hungerPerDay: 0.5,
    thirstPerDay: 0.8, drinkPerMinute: 0.04,
    tirePerDay: 0.9, restPerHour: 0.15,
    waterRange: 14, thirstSearch: 40, corpseDays: 3,
    // Construyen una choza de palos y pieles (cerca del agua si pueden) y duermen dentro
    refuge: {
      kind: 'hut', adultsInside: true,
      digIn: [Material.SOIL, Material.HUMUS, Material.SAND, Material.PEAT, Material.ROCK], digHours: 24,
      rainStay: 0.8, sunbathe: 0, leave: 0.9,
      collapseDeath: 0.2, floodEscape: 0.9, drownPerHour: 0.1, unblock: 0.9,
    },
    dispersal: { male: 0.2, female: 0.1 },
    // Llega en balsa una pareja con de 1 a 3 hijos; con hambre de verdad, se van; 1 banda en un 2×2
    migration: {
      arrive: 0.2, groupsPerChunk: [0.15, 0.25], crowdLeave: 0.3, hungryLeave: 0.4,
      founders: [FA, MA], extraYoung: [1, 3],
    },
    founders: [FA, MA, FY, MY],
  },
  {
    id: 5, key: 'goblin', size: 'small',
    // Carne (presas y carroña); con mucha hambre, fruta
    diets: ['carnivore'], starvingDiets: ['frugivore'],
    herd: { min: 1, max: 6, cohesion: 4 },
    spacing: { personal: 1, graze: 1.4, huddle: 0.4 },
    // De noche: salen al anochecer y vuelven antes del alba; de día duermen en su nido (el sol les quema)
    activeHours: [[20, 23], [1, 4]], siestaHours: [12, 14],
    sleepHours: [6, 19],
    speed: { walk: 0.1, run: 0.6 },
    range: { roam: 1, flee: 0.5 },
    flight: { mode: 'refuge', freeze: 0, alarm: 0.5, zigzag: 0.1 },
    senses: { smell: 1.5, vigilance: 0.05 },
    predator: {
      // Lo que pillen: mejor si duerme, está solo o es una cría; también humanos
      prey: { rabbit: 1, deer: 0.6, human: 0.7, crow: 0.2 },
      huntBelow: 0.6, huntChance: 0.5, carrion: 0.9,
      catch: {
        rabbit: { adult: 0.3, young: 0.6, weak: 0.5 },
        deer: { adult: 0.05, young: 0.35, weak: 0.3 },
        human: { adult: 0.08, young: 0.4, weak: 0.3 },
        crow: { adult: 0.02, young: 0.5, weak: 0.2 },
      },
      packBonus: 0.08, packMax: 3, joinHunt: 0.8, snowBonus: 0.05,
      giveUpAfter: 15, giveUp: 0.7,
      trip: { chance: 0, days: [1, 1], islands: 1 },
      carry: { tire: 1.5, relay: 0.6 },
      // Grito de guerra al salir
      howl: 0.7,
      plantsBelow: 0.1,
    },
    afterRun: { pant: 10, awake: 60 },
    gatherHours: 1,
    homing: { late: 0.05, lateMinutes: [20, 90], leaderReturn: 0.8 },
    herdRun: { together: 0.7, findBack: 0.6 },
    youngDays: 20, adultDays: 40, lifespanDays: [120, 360],
    breeding: {
      mode: 'season', seasons: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      conceivePerDay: 0.03, minSatiety: 0.6, gestationDays: 15,
      litter: { sizes: [1, 2, 3], weights: [50, 35, 15] }, crowdShift: 1, hungryShift: 1,
      nurseDays: 8, orphanDeath: 0.3,
    },
    // Sacan casi toda el agua de la carne (en la Tierra Quemada no hay agua)
    stomach: 0.05, bitePerMinute: 0.002, hungerPerDay: 0.35,
    thirstPerDay: 0.3, drinkPerMinute: 0.05, waterFromFood: 1,
    tirePerDay: 0.9, restPerHour: 0.15,
    waterRange: 20, thirstSearch: 40, corpseDays: 1,
    // Nido de carbón en la Tierra Quemada
    refuge: {
      kind: 'lair', adultsInside: true,
      digIn: [Material.CHARRED], digHours: 12,
      rainStay: 0.9, sunbathe: 0, leave: 0.95,
      collapseDeath: 0.5, floodEscape: 0.5, drownPerHour: 0.3, unblock: 0.9,
    },
    dispersal: { male: 0.4, female: 0.3 },
    // El sol les quema, el fuego no; la Escarcha en su nido les apaga la brasa
    sunHurt: 0.08, frostHurt: 0.05, fireproof: true,
    // Nacen de 5 a 7 días después de formarse la Tierra Quemada: un nido por cada 9 tiles, de 1 a 3 en cada uno
    burntBorn: { delayDays: [5, 7], tilesPerNest: 9, perNest: [1, 3], feedsBurnt: 2 },
    founders: [MA, FA],
  },
];

export const SPECIES_BY_KEY: Readonly<Record<string, SpeciesDef>> = Object.fromEntries(SPECIES_DEFS.map(s => [s.key, s]));
