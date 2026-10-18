import { WeatherSystem } from './weather';
import { ClimateState } from './climate-state';
import { WeatherEventDef } from '../../domain/models/weather.model';
import { CALENDAR, Season, toGameTime } from '../../domain/models/time.model';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { SEASON_TEMPERATURE } from '../../config/climate.config';
import { World } from '../world/world';
import { TerrainPhysics } from '../physics/terrain-physics';
import { BiomeSystem } from '../world/biomes';

const SEASON = CALENDAR.DAYS_PER_SEASON * CALENDAR.MINUTES_PER_DAY;

/** Fenómeno de prueba que solo cuenta cuántas veces se aplica */
function testEvent(episodes: [number, number]): { def: WeatherEventDef; minutes: () => number } {
  let n = 0;
  const def: WeatherEventDef = {
    key: 'test', hours: [2, 6], intensity: [0.5, 1], gloom: 0.3, breaksDrought: true,
    episodes: { [Season.SPRING]: episodes, [Season.SUMMER]: episodes, [Season.AUTUMN]: episodes, [Season.WINTER]: episodes },
    apply: () => { n++; return 'rain'; },
  };
  return { def, minutes: () => n };
}

describe('Clima', () => {
  it('la temperatura de cada estación se aplica y cambia suave al final de la estación', () => {
    const c = new ClimateState();
    c.update(toGameTime(10 * 1440 + 14 * 60));                    // primavera, día 11, a la hora más cálida
    expect(c.offset).toBeCloseTo(SEASON_TEMPERATURE[0] + 0.05, 5);
    c.update(toGameTime(SEASON + 10 * 1440 + 14 * 60));           // verano
    expect(c.offset).toBeCloseTo(SEASON_TEMPERATURE[1] + 0.05, 5);
    // A mitad de la transición verano → otoño está entre las dos
    c.update(toGameTime(2 * SEASON - 2.5 * 1440));
    expect(c.offset).toBeLessThan(SEASON_TEMPERATURE[1]);
    expect(c.offset).toBeGreaterThan(SEASON_TEMPERATURE[2] - 0.06);
  });

  it('cada estación tiene entre min y max episodios, sin solaparse, y se aplican', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { def, minutes } = testEvent([0, 10]);
      const w = new WeatherSystem({ precipitate: () => false }, new SeededRandom(seed), [def]);
      w.planSeason(Season.SPRING, 0);
      let starts = 0, prevKey: string | null = null;
      for (let m = 0; m < SEASON; m++) {
        w.minute(toGameTime(m));
        if (w.current.key && !prevKey) starts++;
        prevKey = w.current.key;
      }
      expect(starts).toBeGreaterThanOrEqual(0);
      expect(starts).toBeLessThanOrEqual(10);
      expect(minutes()).toBeLessThanOrEqual(10 * 6 * 60);
    }
  });

  it('una estación con [0, 0] episodios no tiene ninguno; con [3, 3], tres como mucho (los solapados se descartan)', () => {
    const none = testEvent([0, 0]);
    const w0 = new WeatherSystem({ precipitate: () => false }, new SeededRandom(3), [none.def]);
    w0.planSeason(Season.SUMMER, 0);
    for (let m = 0; m < SEASON; m++) w0.minute(toGameTime(m));
    expect(none.minutes()).toBe(0);
    const three = testEvent([3, 3]);
    const w3 = new WeatherSystem({ precipitate: () => false }, new SeededRandom(3), [three.def]);
    w3.planSeason(Season.SUMMER, 0);
    for (let m = 0; m < SEASON; m++) w3.minute(toGameTime(m));
    expect(three.minutes()).toBeGreaterThanOrEqual(2 * 60);
    expect(three.minutes()).toBeLessThanOrEqual(3 * 6 * 60);
  });

  it('la nieve de invierno cubre la isla pero no convierte el bosque en tundra', () => {
    const world = new World(11);
    const chunk = world.chunk(0, 0);
    const physics = new TerrainPhysics(world);
    const biomes = new BiomeSystem(world, new SeededRandom(1));
    // Clima base templado en toda la isla: en invierno nieva en todas partes, pero el clima medio no es de tundra
    chunk.temperature.fill(0.4);
    for (let d = 0; d < 4; d++) biomes.update(1);
    const before = [...chunk.biome];
    physics.climate.update(toGameTime(3 * SEASON + 10 * 1440 + 3 * 60));   // invierno, de madrugada
    for (let m = 0; m < 600; m++) physics.precipitate(0.0004);
    expect([...chunk.cover].filter(c => c > 0.05).length).toBeGreaterThan(200);
    for (let d = 0; d < 4; d++) biomes.update(1);
    expect([...chunk.biome]).toEqual(before);
  });
});
