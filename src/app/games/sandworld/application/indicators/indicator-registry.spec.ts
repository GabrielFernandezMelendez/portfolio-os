import { IndicatorRegistry } from './indicator-registry';
import { registerWorldIndicators, vegetationLevel, waterLevel } from './world-indicators';
import { World } from '../world/world';

describe('IndicatorRegistry', () => {
  it('devuelve los indicadores en orden de registro y limita el valor a 0..1', () => {
    const r = new IndicatorRegistry();
    r.register({ id: 'a', icon: 'drop', labelKey: 'a', color: '#000', read: () => 1.7 });
    r.register({ id: 'b', icon: 'leaf', labelKey: 'b', color: '#000', read: () => -2 });
    r.register({ id: 'c', icon: 'leaf', labelKey: 'c', color: '#000', read: () => NaN });
    expect(r.snapshot().map(v => [v.id, v.value])).toEqual([['a', 1], ['b', 0], ['c', 0]]);
  });

  it('no admite dos indicadores con el mismo id', () => {
    const r = new IndicatorRegistry();
    r.register({ id: 'a', icon: 'drop', labelKey: 'a', color: '#000', read: () => 0 });
    expect(() => r.register({ id: 'a', icon: 'drop', labelKey: 'a', color: '#000', read: () => 0 })).toThrow();
  });

  it('los indicadores del mundo leen valores razonables del chunk inicial', () => {
    const world = new World(11, 1);
    world.chunk(0, 0);
    expect(waterLevel(world)).toBeGreaterThan(0);
    expect(vegetationLevel(world)).toBeGreaterThan(0);
    const r = new IndicatorRegistry();
    registerWorldIndicators(r, world);
    expect(r.snapshot().map(v => v.id)).toEqual(['water', 'vegetation']);
  });
});
