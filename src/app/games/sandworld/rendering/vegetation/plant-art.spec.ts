import { FRESH, paint, plantArt } from './plant-art';
import { PLANT_DEFS } from '../../config/plants.config';
import { PLANT_ART } from '../../config/plant-art.config';

const opaque = (a: Int32Array) => a.filter(c => c >= 0).length;

describe('Dibujo de las plantas', () => {
  it('todas las plantas del registro tienen dibujo, y la joven es más pequeña que la adulta', () => {
    for (const p of PLANT_DEFS) {
      expect(PLANT_ART[p.key]).toBeDefined();
      const adult = plantArt(p.key), young = plantArt(p.key, true);
      expect(opaque(paint(young, FRESH))).toBeLessThan(opaque(paint(adult, FRESH)));
    }
  });

  it('el fruto comido desaparece y vuelve; la planta seca ya no tiene fruto', () => {
    const art = plantArt('redBerries');
    const red = (a: Int32Array) => a.filter(c => c >= 0 && (c >> 16) > 0xc0 && ((c >> 8) & 255) < 0x80).length;
    expect(red(paint(art, FRESH))).toBeGreaterThan(4);
    expect(red(paint(art, { ...FRESH, fruit: 0 }))).toBe(0);
    expect(red(paint(art, { ...FRESH, dead: 1 }))).toBe(0);
  });

  it('el roble sin hojas deja ver sus ramas, y al deshacerse pierde píxeles', () => {
    const art = plantArt('oak');
    const bare = paint(art, { ...FRESH, leaves: 0 });
    expect(opaque(bare)).toBeGreaterThan(20);
    expect(opaque(bare)).toBeLessThan(opaque(paint(art, FRESH)) / 2);
    expect(opaque(paint(art, { ...FRESH, gone: 0.5 }))).toBeLessThan(opaque(paint(art, FRESH)) * 0.7);
  });

  it('el pie de cada dibujo está centrado abajo', () => {
    for (const key of Object.keys(PLANT_ART)) {
      const a = plantArt(key);
      expect(a.w).toBe(a.footX * 2 + 1);
      const bottom = a.base.slice((a.h - 1) * a.w);
      expect(bottom.some(p => p)).toBe(true);
    }
  });
});
