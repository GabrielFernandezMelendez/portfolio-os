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
    // Después de correr jadea 20 minutos y en 2 horas no pega ojo
    afterRun: { pant: 20, awake: 120 },
    gatherHours: 2,
    // Si corre toda la manada: 3 de cada 4 salen juntos; el que se separa encuentra a los suyos 6 de cada 10 veces
    herdRun: { together: 0.75, findBack: 0.6 },
    youngDays: 20, adultDays: 60, lifespanDays: [180, 300],
    breeding: {
      mode: 'rut', rutSeason: Season.AUTUMN, birthSeason: Season.SPRING,
      conceivePerDay: 0.12, minSatiety: 0.5, twinsChance: 0.3, twinsSatiety: 0.8,
    },
    // Llena el estómago con 0,125 de comida (½ tile de hierba): come ~¼ de tile de hierba al día
    stomach: 0.125, bitePerMinute: 0.00035, hungerPerDay: 0.5,
    // Se vacía de agua en algo más de un día; bebe hasta llenarse en ~40 minutos
    thirstPerDay: 0.8, drinkPerMinute: 0.025,
    tirePerDay: 0.9, restPerHour: 0.15, sleepHours: [22, 5],
    waterRange: 12, thirstSearch: 30, corpseDays: 3,
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
    afterRun: { pant: 10, awake: 60 },
    gatherHours: 1,
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
    // Saca casi toda el agua de las plantas: comiendo hasta llenarse recupera casi lo mismo de sed
    thirstPerDay: 0.5, drinkPerMinute: 0.05, waterFromFood: 0.8,
    tirePerDay: 0.9, restPerHour: 0.15,
    waterRange: 8, thirstSearch: 20, corpseDays: 2,
    refuge: {
      digIn: [Material.SOIL, Material.HUMUS, Material.PEAT], digHours: 12,
      rainStay: 0.7, sunbathe: 0.15, leave: 0.9,
      collapse: 0.5, collapseDeath: 0.4, floodEscape: 0.7, drownPerHour: 0.3, unblock: 0.8,
    },
    dispersal: { male: 0.6, female: 0.25 },
    disease: { outbreak: 0.02, crowdedAbove: 1.3, spread: 0.25, days: 5, lethality: 0.6 },
    founders: [
      { sex: 'female', age: 'adult' }, { sex: 'female', age: 'adult' }, { sex: 'female', age: 'adult' },
      { sex: 'male', age: 'adult' }, { sex: 'male', age: 'adult' },
    ],
  },
];

export const SPECIES_BY_KEY: Readonly<Record<string, SpeciesDef>> = Object.fromEntries(SPECIES_DEFS.map(s => [s.key, s]));
