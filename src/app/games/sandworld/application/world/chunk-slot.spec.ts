import { inSlot } from './chunk-slot';

describe('Reparto de revisiones por chunks', () => {
  it('cada chunk se revisa exactamente una vez por hora, cada uno en su minuto', () => {
    for (const count of [1, 4, 9, 16, 70]) {
      const times = new Array(count).fill(0);
      const minutes: number[] = [];
      for (let m = 0; m < 60; m++) for (let i = 0; i < count; i++) if (inSlot(i, count, { minute: m, every: 60 })) { times[i]++; minutes.push(m); }
      expect(times.every(t => t === 1)).toBe(true);
      // Repartidos: en un 3×3, como mucho un chunk por minuto
      if (count <= 60) expect(new Set(minutes).size).toBe(count);
    }
  });
});
