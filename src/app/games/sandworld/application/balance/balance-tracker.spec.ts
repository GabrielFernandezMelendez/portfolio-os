import { BalanceRow, BalanceTracker } from './balance-tracker';
import { SPECIES_DEFS } from '../../config/species.config';
import { BALANCE_DAYS } from '../../config/balance.config';

const id = (key: string) => SPECIES_DEFS.find(s => s.key === key)!.id;
const DEER = id('deer'), RABBIT = id('rabbit'), WOLF = id('wolf');

/** Filas con la población (y capacidad) de las especies dadas; las demás, sin nadie */
function rows(pop: Record<number, number>, capacity = 10, satiety = 0.8): BalanceRow[] {
  return SPECIES_DEFS.map(s => ({ species: s.id, population: pop[s.id] ?? 0, capacity, satiety: pop[s.id] ? satiety : null }));
}

describe('BalanceTracker', () => {
  it('solo enseña las especies que han pisado la isla (sin spoilers)', () => {
    const t = new BalanceTracker();
    const v = t.view(1, rows({ [DEER]: 6 }));
    expect(v.species.map(s => s.key)).toEqual(['deer']);
    expect(v.web.nodes.some(n => n.species === WOLF)).toBe(false);
  });

  it('una especie a la que cazan mucho está "apretada" por su cazador', () => {
    const t = new BalanceTracker();
    t.record([{ type: 'killed', species: WOLF, prey: DEER }, { type: 'killed', species: WOLF, prey: DEER }], 1);
    const deer = t.view(1, rows({ [DEER]: 6, [WOLF]: 5 })).species.find(s => s.species === DEER)!;
    expect(deer.mood).toBe('pressed');
    expect(deer.by).toBe(WOLF);
    expect(deer.severity).toBe('warn');
  });

  it('pasan hambre, demasiados para lo que hay y al borde', () => {
    const t = new BalanceTracker();
    expect(t.view(1, rows({ [DEER]: 6 }, 10, 0.3)).species[0].mood).toBe('hungry');
    expect(t.view(1, rows({ [DEER]: 20 }, 10)).species[0].mood).toBe('crowded');
    const edge = t.view(1, rows({ [DEER]: 2 })).species[0];
    expect(edge.mood).toBe('edge');
    expect(edge.severity).toBe('bad');
    expect(t.view(1, rows({ [DEER]: 2 })).alert).toBe(true);
  });

  it('marca "el último" cuando una especie se queda sin nadie, y "se fueron" si se marchó', () => {
    const t = new BalanceTracker();
    t.dawn(1, rows({ [RABBIT]: 4, [DEER]: 5 }));
    t.record([{ type: 'left', species: DEER }], 2);
    t.dawn(2, rows({}));
    const v = t.view(2, rows({}));
    expect(v.history.marks.map(m => [m.species, m.kind])).toEqual([[DEER, 'left'], [RABBIT, 'last']]);
    expect(v.species.find(s => s.species === RABBIT)!.mood).toBe('gone');
    expect(v.species.find(s => s.species === DEER)!.mood).toBe('left');
  });

  it('guarda como mucho BALANCE_DAYS puntos, y el último es ahora mismo', () => {
    const t = new BalanceTracker();
    for (let d = 1; d <= BALANCE_DAYS + 5; d++) t.dawn(d, rows({ [DEER]: d }));
    const h = t.view(BALANCE_DAYS + 5, rows({ [DEER]: 99 })).history;
    expect(h.days.length).toBe(BALANCE_DAYS);
    expect(h.series[0].values[h.series[0].values.length - 1]).toBe(99);
  });

  it('tendencia: sube o baja frente a hace unos días', () => {
    const t = new BalanceTracker();
    for (let d = 1; d <= 4; d++) t.dawn(d, rows({ [DEER]: 4 + d * 2 }));
    expect(t.view(4, rows({ [DEER]: 12 })).species[0].trend).toBe(1);
    expect(t.view(4, rows({ [DEER]: 3 })).species[0].trend).toBe(-1);
  });

  it('cadena: plantas abajo, herbívoros encima y el lobo por encima de su presa; roja si se cazan más de las que nacen', () => {
    const t = new BalanceTracker();
    t.record([{ type: 'killed', species: WOLF, prey: DEER }, { type: 'born', species: RABBIT, count: 3 }], 1);
    const web = t.view(1, rows({ [DEER]: 6, [RABBIT]: 5, [WOLF]: 5 })).web;
    const lv = (sp: number) => web.nodes.find(n => n.species === sp)!.level;
    expect(web.nodes.find(n => n.resource === 'plants')!.level).toBe(0);
    expect(lv(DEER)).toBe(1);
    expect(lv(WOLF)).toBeGreaterThan(lv(DEER));
    const edge = (prey: number) => web.edges.find(e => e.from === `s${prey}` && e.to === `s${WOLF}`)!;
    expect(edge(DEER).pressure).toBe(true);
    expect(edge(RABBIT).pressure).toBe(false);
  });
});
