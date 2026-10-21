import { AnimalAction, AnimalOrder, DeathCause, DiaryEntry, Factor, Sex } from '../../domain/models/animal.model';
import { SPECIES_DEFS } from '../../config/species.config';
import { ELDER_FROM, RUN_MIN } from '../../config/fauna.config';
import { FaunaSystem } from './fauna-system';
import { LifeStage, ageDays, lifeStage } from './needs';
import { leaderOf } from './herds';
import { STARTLE_FEAR } from '../../config/temperament.config';

/** Lo que enseña la ficha de un animal (una foto de su estado: la interfaz no toca el animal) */
export interface AnimalView {
  readonly id: number;
  readonly name: string;
  readonly species: string;
  readonly sex: Sex;
  /** Cría (dibujo pequeño) o adulto */
  readonly young: boolean;
  readonly stage: LifeStage;
  /** Lo que hace (o 'inside': está en su madriguera y no se le ve) */
  readonly action: AnimalAction | 'inside';
  readonly alive: boolean;
  readonly cause: DeathCause | null;
  readonly health: number;
  readonly rest: number;
  readonly satiety: number;
  readonly hydration: number;
  readonly happiness: number;
  readonly days: number;
  /**
   * Línea de la vida: dónde va (edad / la vida más larga de su especie) y dónde empiezan joven, adulto y viejo.
   * No dice cuánto vivirá ESTE animal: la vejez es una sorpresa.
   */
  readonly life: number;
  readonly marks: readonly [juvenile: number, adult: number, elder: number];
  readonly herdSize: number;
  readonly leader: string | null;
  readonly factors: readonly Factor[];
  readonly diary: readonly DiaryEntry[];
  readonly order: AnimalOrder | null;
  readonly canRun: boolean;
}

export function animalView(fauna: FaunaSystem, id: number, now: number): AnimalView | null {
  const a = fauna.animal(id);
  if (!a) return null;
  const s = SPECIES_DEFS[a.species];
  const max = s.lifespanDays[1];
  const alive = a.diedAt === null;
  const at = alive ? now : a.diedAt!;
  const members = alive ? fauna.members(a.herd) : [];
  const leader = leaderOf(members, s, now);
  return {
    id: a.id, name: a.name, species: s.key, sex: a.sex, young: ageDays(a, at) < s.youngDays,
    stage: lifeStage(a, s, at), action: alive && a.inside !== null ? 'inside' : a.action, alive, cause: a.cause,
    health: Math.max(0, a.health), rest: a.rest, satiety: a.satiety, hydration: a.hydration, happiness: a.happiness,
    days: Math.floor(ageDays(a, at)), life: Math.min(1, ageDays(a, at) / max),
    marks: [s.youngDays / max, s.adultDays / max, (s.lifespanDays[0] * ELDER_FROM) / max],
    herdSize: members.length, leader: leader && leader !== a ? leader.name : null,
    factors: liveFactors(a.factors, alive && a.fear >= STARTLE_FEAR, alive && a.sickUntil !== null), diary: [...a.diary], order: a.order, canRun: alive && a.rest >= RUN_MIN,
  };
}

/**
 * "Le afecta" al día: los factores se calculan cada hora, pero un susto dura minutos. "Asustado" y "Enfermo" salen
 * (los primeros) mientras lo esté y desaparecen en cuanto se le pasa.
 */
function liveFactors(factors: readonly Factor[], scared: boolean, sick: boolean): Factor[] {
  const rest = factors.filter(f => f.key !== 'fear' && f.key !== 'sick');
  const now: Factor[] = [];
  if (sick) now.push({ key: 'sick', value: -0.3 });
  if (scared) now.push({ key: 'fear', value: -0.2 });
  return [...now, ...rest].slice(0, 4);
}
