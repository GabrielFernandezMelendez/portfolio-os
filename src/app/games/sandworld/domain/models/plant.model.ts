// Plantas. Cada tile guarda la biomasa (0..1) de cada planta; el registro (config/plants.config.ts)
// dice dónde crece cada una, a qué ritmo y qué supone para los animales que la comen.

import { SeasonId } from './time.model';

export type PlantKind = 'small' | 'bush' | 'tree';

/** Qué le pasa a un animal que se come una planta tóxica */
export type ToxicEffect = 'lethal' | 'sick' | 'confused';

/** Dietas que pueden comerse una planta (la fauna llega en los bloques C y D) */
/** Qué come (las plantas dicen qué dietas las comen; 'carnivore' come carne: presas y carroña) */
export type Diet = 'grazer' | 'browser' | 'frugivore' | 'bird' | 'omnivore' | 'carnivore';

export interface PlantDef {
  readonly id: number;
  /** Clave para textos (plant.<key>) y sprites */
  readonly key: string;
  readonly kind: PlantKind;
  /** Dónde puede crecer: peso (0..1) por clave de bioma. Fuera de estos biomas no crece. */
  readonly biomes: Readonly<Record<string, number>>;
  /** Días para pasar de nada a llena con condiciones perfectas */
  readonly growthDays: number;
  /** Probabilidad al día de sembrar un tile vecino cuando está bien crecida */
  readonly spread: number;
  /** Rango de temperatura cómodo (0..1) */
  readonly temperature: readonly [min: number, max: number];
  /** Humedad mínima que necesita (suelo o clima, 0..1) */
  readonly moisture: number;
  /** Fertilidad mínima (0..1) */
  readonly fertility: number;
  /** Cuánto arde (bloque B) */
  readonly fuel: number;
  /** Pierde las hojas en invierno (árboles) */
  readonly deciduous?: boolean;
  /** Se vuelve ocre en otoño */
  readonly autumn?: boolean;
  /** Crece sobre roca desnuda (musgo) */
  readonly rock?: boolean;
  /** Crece en la nieve permanente (liquen, pino) */
  readonly snow?: boolean;
  /** Crece en orillas con poca agua encima (junco) */
  readonly shore?: boolean;
  /** Comida: cuánto alimenta (0..1) y a qué dietas */
  readonly food?: { readonly nutrition: number; readonly diets: readonly Diet[]; readonly seasons?: readonly SeasonId[] };
  /** Tóxica: efecto y probabilidad al comerla */
  readonly toxic?: { readonly effect: ToxicEffect; readonly chance: number };
  /** Agua que da al comerla (cactus) */
  readonly drink?: number;
  /** Enfría el tile (sombra) */
  readonly shade?: number;
  /** Cura (salvia, sauce) */
  readonly medicinal?: number;
  /** Refugio: los depredadores no entran (zarza) */
  readonly refuge?: boolean;
  /** Hace daño al comerla o atravesarla (espinas) */
  readonly hurts?: number;
  /** Sus raíces sujetan el terreno: talud extra con la planta llena */
  readonly roots?: number;
  /** Ahoga a arbustos y árboles del mismo tile (por día, con la planta llena) */
  readonly invasive?: number;
  /** Esencia que da al tile (flor luminosa) */
  readonly essence?: number;
  /** Solo nace donde ya hay un Claro Despierto */
  readonly gladeOnly?: boolean;
  /** Sprites como máximo en un tile con la planta llena (cuánto se ve) */
  readonly sprites: number;
  /**
   * Probabilidad de que un animal que se la come deje una semilla que germine en otro sitio.
   * Sin valor: no se propaga así (no tiene semillas que sobrevivan a la digestión o no se come).
   */
  readonly seeds?: number;
  /** Cultivo: tras cosecharla vuelve a crecer (bayas, frutales) en vez de desaparecer (hierba, setas) */
  readonly regrows?: boolean;
}

/** Diferencia entre dos estados de la vegetación: chunks a redibujar */
export interface VegetationChange {
  readonly cx: number;
  readonly cy: number;
}
