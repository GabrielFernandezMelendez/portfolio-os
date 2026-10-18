import { Chronicle } from './chronicle';
import { toGameTime } from '../../domain/models/time.model';
import { CHRONICLE_HISTORY, CHRONICLE_RELEASE_MS } from '../../config/chronicle.config';

describe('Chronicle', () => {
  const t = toGameTime(9 * 60);

  it('publica el primero al momento y después como mucho uno cada 30 s (2 por minuto)', () => {
    const c = new Chronicle();
    for (let i = 0; i < 5; i++) c.push({ type: 'time', key: `m${i}` }, t, 0);
    expect(c.entries.length).toBe(1);

    c.tick(CHRONICLE_RELEASE_MS - 1);
    expect(c.entries.length).toBe(1);
    c.tick(CHRONICLE_RELEASE_MS);
    expect(c.entries.length).toBe(2);

    // En un minuto real completo salen 2 más, no los 3 que quedan
    for (let ms = CHRONICLE_RELEASE_MS; ms <= CHRONICLE_RELEASE_MS * 3 - 1; ms += 1000) c.tick(ms);
    expect(c.entries.length).toBe(3);
  });

  it('agrupa mensajes iguales que esperan en la cola', () => {
    const c = new Chronicle();
    c.push({ type: 'time', key: 'first' }, t, 0);                       // sale al momento
    for (let i = 0; i < 3; i++) c.push({ type: 'time', key: 'chronicle.dawn' }, t, 10);
    c.push({ type: 'time', key: 'chronicle.newDay', params: { day: 2 } }, t, 10);
    expect(c.pending).toBe(2);
    c.tick(CHRONICLE_RELEASE_MS);
    expect(c.entries[0].key).toBe('chronicle.dawn');
    expect(c.entries[0].count).toBe(3);
  });

  it('con mismos textos pero distintos parámetros no agrupa', () => {
    const c = new Chronicle();
    c.push({ type: 'time', key: 'first' }, t, 0);
    c.push({ type: 'time', key: 'chronicle.newDay', params: { day: 2 } }, t, 10);
    c.push({ type: 'time', key: 'chronicle.newDay', params: { day: 3 } }, t, 10);
    expect(c.pending).toBe(2);
  });

  it('sale antes el de mayor prioridad', () => {
    const c = new Chronicle();
    c.push({ type: 'time', key: 'first' }, t, 0);
    c.push({ type: 'time', key: 'low' }, t, 10);
    c.push({ type: 'world', key: 'high', priority: 5 }, t, 10);
    c.tick(CHRONICLE_RELEASE_MS);
    expect(c.entries[0].key).toBe('high');
  });

  it('catástrofes y cartas se saltan el límite', () => {
    const c = new Chronicle();
    c.push({ type: 'time', key: 'first' }, t, 0);
    c.push({ type: 'catastrophe', key: 'flood' }, t, 1);
    c.push({ type: 'letter', key: 'letter' }, t, 2);
    expect(c.entries.map(e => e.key)).toEqual(['letter', 'flood', 'first']);
  });

  it('guarda como mucho los últimos 100, el más reciente primero, con día y hora', () => {
    const c = new Chronicle();
    for (let i = 0; i < CHRONICLE_HISTORY + 20; i++) c.push({ type: 'letter', key: `l${i}` }, t, i);
    expect(c.entries.length).toBe(CHRONICLE_HISTORY);
    expect(c.entries[0].key).toBe(`l${CHRONICLE_HISTORY + 19}`);
    expect(c.entries[0].day).toBe(1);
    expect(c.entries[0].hour).toBe(9);
  });

  it('revision solo cambia cuando se publica algo', () => {
    const c = new Chronicle();
    const r0 = c.revision;
    c.tick(5000);
    expect(c.revision).toBe(r0);
    c.push({ type: 'time', key: 'x' }, t, 5000);
    expect(c.revision).toBe(r0 + 1);
  });
});
