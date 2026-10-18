import { lightLevel, twilight } from './daylight';
import { CALENDAR } from '../../domain/models/time.model';

describe('daylight', () => {
  it('es de noche a medianoche y de día a mediodía', () => {
    expect(lightLevel(0)).toBe(0);
    expect(lightLevel(12 * 60)).toBe(1);
    expect(lightLevel(23 * 60)).toBe(0);
  });

  it('a la hora del amanecer y del anochecer la luz está a medias', () => {
    expect(lightLevel(CALENDAR.DAWN)).toBeCloseTo(0.5, 2);
    expect(lightLevel(CALENDAR.DUSK)).toBeCloseTo(0.5, 2);
  });

  it('la luz sube de forma continua durante el amanecer', () => {
    let prev = -1;
    for (let m = CALENDAR.DAWN - 200; m <= CALENDAR.DAWN + 200; m += 5) {
      const l = lightLevel(m);
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });

  it('la calidez solo aparece en las transiciones', () => {
    expect(twilight(CALENDAR.DUSK)).toBe(1);
    expect(twilight(12 * 60)).toBe(0);
    expect(twilight(0)).toBe(0);
  });
});
