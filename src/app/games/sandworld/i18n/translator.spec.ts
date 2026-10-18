import { Translator, missingKeys } from './translator';

describe('Translator', () => {
  it('español e inglés tienen exactamente las mismas claves', () => {
    expect(missingKeys()).toEqual({ es: [], en: [] });
  });

  it('traduce, sustituye parámetros y cambia de idioma', () => {
    const t = new Translator();
    expect(t.t('hud.day', { day: 3 })).toBe('Día 3');
    t.setLang('en');
    expect(t.t('hud.day', { day: 3 })).toBe('Day 3');
    expect(t.t('chronicle.newSeason.2')).toContain('Autumn');
  });

  it('una clave desconocida se muestra tal cual y un parámetro que falta se deja visible', () => {
    const t = new Translator();
    expect(t.t('no.existe')).toBe('no.existe');
    expect(t.t('hud.day')).toBe('Día {day}');
  });
});
