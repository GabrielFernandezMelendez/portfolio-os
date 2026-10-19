import { plantLook } from './plant-look';
import { PLANT_DEFS } from '../../config/plants.config';
import { CALENDAR, toGameTime } from '../../domain/models/time.model';

const oak = PLANT_DEFS.find(p => p.key === 'oak')!;
const pine = PLANT_DEFS.find(p => p.key === 'pine')!;
const SEASON = CALENDAR.DAYS_PER_SEASON * 1440;
const at = (season: number, day: number) => toGameTime(season * SEASON + (day - 1) * 1440 + 12 * 60);

describe('Aspecto de estación de las plantas', () => {
  it('el roble: verde en primavera, ocre poco a poco en otoño, sin hojas en invierno y verde otra vez al final', () => {
    expect(plantLook(oak, 0.5, at(0, 1), false)).toMatchObject({ autumn: 0, leaves: 1 });
    const early = plantLook(oak, 0.5, at(2, 2), false).autumn;
    const mid = plantLook(oak, 0.5, at(2, 4), false).autumn;
    expect(mid).toBeGreaterThan(early);
    expect(plantLook(oak, 0.5, at(2, 10), false).autumn).toBe(1);
    expect(plantLook(oak, 0.5, at(3, 3), false).leaves).toBeGreaterThan(0);   // aún perdiendo hojas
    expect(plantLook(oak, 0.5, at(3, 12), false).leaves).toBe(0);
    expect(plantLook(oak, 0.5, at(3, 30), false)).toMatchObject({ autumn: 0, leaves: 1 });
  });

  it('cada árbol cambia a su ritmo (el retraso depende de su semilla)', () => {
    expect(plantLook(oak, 0.05, at(2, 3), false).autumn).toBeGreaterThan(plantLook(oak, 0.95, at(2, 3), false).autumn);
  });

  it('el pino no cambia con las estaciones, pero se cubre de nieve', () => {
    expect(plantLook(pine, 0.5, at(3, 12), true)).toEqual({ autumn: 0, leaves: 1, dry: 0, snow: true });
  });
});
