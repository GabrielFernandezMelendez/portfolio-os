import { Animal } from '../../domain/models/animal.model';
import { RandomSource } from '../../domain/ports/random-source.port';
import { PLANT_DEFS } from '../../config/plants.config';
import { ANIMAL_NAMES, FOOD_NAME_CHANCE } from '../../config/animal-names.config';
import { DIARY_KEEP, DIARY_PER_DAY } from '../../config/fauna.config';

/**
 * Escribe en el diario del animal (texto en i18n: animal.diary.<key>). Como mucho DIARY_PER_DAY entradas al día
 * (las importantes, `force`, entran siempre) y se guardan las DIARY_KEEP últimas. Devuelve si la escribió.
 */
export function write(a: Animal, key: string, now: number, params?: Record<string, string | number>, force = false): boolean {
  const day = Math.floor(now / 1440);
  if (a.diaryDay !== day) {
    a.diaryDay = day;
    a.diaryToday = 0;
  }
  if (!force && a.diaryToday >= DIARY_PER_DAY) return false;
  // No repite la misma frase dos veces seguidas
  if (!force && a.diary[0]?.key === key) return false;
  a.diaryToday++;
  a.diary.unshift({ minute: now, key, params });
  if (a.diary.length > DIARY_KEEP) a.diary.length = DIARY_KEEP;
  return true;
}

/**
 * Nombre irónico para un animal nuevo: a veces el de una comida (su favorita o la de su madre: Bellota, Brote...),
 * si no, uno "de persona" de su sexo. Evita repetir los que están vivos mientras pueda.
 */
export function nameFor(species: string, sex: 'male' | 'female', favourite: number, motherFavourite: number | null,
  random: RandomSource, taken: ReadonlySet<string>): string {
  const pool = ANIMAL_NAMES[species];
  if (!pool) return '?';
  const pick = (list: readonly string[]): string | null => {
    const free = list.filter(n => !taken.has(n));
    const from = free.length ? free : list;
    return from.length ? from[Math.floor(random.next() * from.length)] : null;
  };
  if (random.next() < FOOD_NAME_CHANCE) {
    const plant = motherFavourite ?? favourite;
    const foodNames = pool.food[PLANT_DEFS[plant]?.key];
    const n = foodNames ? pick(foodNames) : null;
    if (n) return n;
  }
  const base = pick(pool[sex]) ?? '?';
  // Si ya están todos los nombres, el segundo es "II", el tercero "III"...
  if (!taken.has(base)) return base;
  for (const suffix of ['II', 'III', 'IV', 'V', 'VI']) if (!taken.has(`${base} ${suffix}`)) return `${base} ${suffix}`;
  return base;
}
