import { Chronicle } from './chronicle';
import { toGameTime } from '../../domain/models/time.model';
import { CHRONICLE_HISTORY, CHRONICLE_RELEASE_MS } from '../../config/chronicle.config';

describe('Chronicle', () => {
  const t = toGameTime(9 * 60);

  describe('franja (con ritmo)', () => {
    it('saca el primero al momento y después como mucho uno cada 30 s (2 por minuto)', () => {
      const c = new Chronicle();
      for (let i = 0; i < 5; i++) c.push({ type: 'time', key: `m${i}` }, t, 0);
      expect(c.strip.length).toBe(1);

      c.tick(CHRONICLE_RELEASE_MS - 1);
      expect(c.strip.length).toBe(1);
      c.tick(CHRONICLE_RELEASE_MS);
      expect(c.strip.length).toBe(2);

      // En un minuto real completo salen 2 más, no los 3 que quedan
      for (let ms = CHRONICLE_RELEASE_MS; ms <= CHRONICLE_RELEASE_MS * 3 - 1; ms += 1000) c.tick(ms);
      expect(c.strip.length).toBe(3);
    });

    it('agrupa mensajes iguales que esperan en la cola', () => {
      const c = new Chronicle();
      c.push({ type: 'time', key: 'first' }, t, 0);                       // sale al momento
      for (let i = 0; i < 3; i++) c.push({ type: 'time', key: 'chronicle.dawn' }, toGameTime(9 * 60 + i), 10);
      c.push({ type: 'time', key: 'chronicle.newDay', params: { day: 2 } }, t, 10);
      expect(c.pending).toBe(2);
      c.tick(CHRONICLE_RELEASE_MS);
      expect(c.strip[0].key).toBe('chronicle.dawn');
      expect(c.strip[0].count).toBe(3);
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
      expect(c.strip[0].key).toBe('high');
    });

    it('catástrofes y cartas se saltan el límite', () => {
      const c = new Chronicle();
      c.push({ type: 'time', key: 'first' }, t, 0);
      c.push({ type: 'catastrophe', key: 'flood' }, t, 1);
      c.push({ type: 'letter', key: 'letter' }, t, 2);
      expect(c.strip.map(e => e.key)).toEqual(['letter', 'flood', 'first']);
    });
  });

  describe('libro (todo, en orden de juego)', () => {
    it('recibe cada mensaje al momento aunque la franja lo tenga en cola', () => {
      const c = new Chronicle();
      for (let i = 0; i < 5; i++) c.push({ type: 'time', key: `m${i}` }, toGameTime(i * 60), 0);
      expect(c.strip.length).toBe(1);
      expect(c.entries.map(e => e.key)).toEqual(['m4', 'm3', 'm2', 'm1', 'm0']);
    });

    it('la prioridad no desordena el libro: queda por día y hora de juego', () => {
      const c = new Chronicle();
      const day = (d: number) => toGameTime((d - 1) * 1440 + 8 * 60);
      c.push({ type: 'time', key: 'first' }, day(1), 0);
      c.push({ type: 'world', key: 'low', priority: 0 }, day(3), 10);
      c.push({ type: 'world', key: 'high', priority: 9 }, day(7), 20);
      c.tick(CHRONICLE_RELEASE_MS);
      expect(c.entries.map(e => e.day)).toEqual([7, 3, 1]);
    });

    it('si llega un mensaje atrasado, se coloca en su sitio', () => {
      const c = new Chronicle();
      c.push({ type: 'time', key: 'a' }, toGameTime(100), 0);
      c.push({ type: 'time', key: 'c' }, toGameTime(300), 0);
      c.push({ type: 'time', key: 'b' }, toGameTime(200), 0);
      expect(c.entries.map(e => e.key)).toEqual(['c', 'b', 'a']);
    });

    it('la cola llena no hace perder mensajes del libro', () => {
      const c = new Chronicle();
      for (let i = 0; i < 40; i++) c.push({ type: 'world', key: `w${i}` }, toGameTime(i), 0);
      expect(c.entries.length).toBe(40);
    });

    it('un mensaje igual al último del mismo día suma ×N', () => {
      const c = new Chronicle();
      c.push({ type: 'world', key: 'settled' }, toGameTime(60), 0);
      c.push({ type: 'world', key: 'settled' }, toGameTime(120), 0);
      expect(c.entries.length).toBe(1);
      expect(c.entries[0].count).toBe(2);
      c.push({ type: 'world', key: 'settled' }, toGameTime(1440 + 60), 0);
      expect(c.entries.length).toBe(2);
    });

    it('guarda como mucho los últimos 100, el más reciente primero, con día y hora', () => {
      const c = new Chronicle();
      for (let i = 0; i < CHRONICLE_HISTORY + 20; i++) c.push({ type: 'letter', key: `l${i}` }, toGameTime(9 * 60 + i), i);
      expect(c.entries.length).toBe(CHRONICLE_HISTORY);
      expect(c.entries[0].key).toBe(`l${CHRONICLE_HISTORY + 19}`);
      expect(c.entries[0].day).toBe(1);
      expect(c.entries[0].hour).toBe(10);
    });
  });

  it('revision solo cambia cuando cambia algo', () => {
    const c = new Chronicle();
    const r0 = c.revision;
    c.tick(5000);
    expect(c.revision).toBe(r0);
    c.push({ type: 'time', key: 'x' }, t, 5000);
    expect(c.revision).toBeGreaterThan(r0);
  });
});
