import { SpeciesDef } from '../domain/models/species.model';
import { Season } from '../domain/models/time.model';

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
    // Después de correr jadea 20 minutos y en 2 horas no pega ojo
    afterRun: { pant: 20, awake: 120 },
    gatherHours: 2,
    youngDays: 20, adultDays: 60, lifespanDays: [180, 300],
    breeding: {
      rutSeason: Season.AUTUMN, birthSeason: Season.SPRING,
      conceivePerDay: 0.12, minSatiety: 0.5, twinsChance: 0.3, twinsSatiety: 0.8,
    },
    // Llena el estómago con 0,125 de comida (½ tile de hierba): come ~¼ de tile de hierba al día
    stomach: 0.125, bitePerMinute: 0.00035, hungerPerDay: 0.5,
    // Se vacía de agua en algo más de un día; bebe hasta llenarse en ~40 minutos
    thirstPerDay: 0.8, drinkPerMinute: 0.025,
    tirePerDay: 0.9, restPerHour: 0.15, sleepHours: [22, 5],
    waterRange: 12, thirstSearch: 30, corpseDays: 3,
  },
];

export const SPECIES_BY_KEY: Readonly<Record<string, SpeciesDef>> = Object.fromEntries(SPECIES_DEFS.map(s => [s.key, s]));
