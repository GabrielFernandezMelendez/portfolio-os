import { Injectable, signal } from '@angular/core';
import { DEFAULT_LANG, SandworldLang } from '../domain/models/settings.model';
import es from './es.json';
import en from './en.json';

type Dictionary = Record<string, string>;

/** Aplana {"hud": {"day": "Día {day}"}} → {"hud.day": "Día {day}"} */
function flatten(obj: object, prefix = '', out: Dictionary = {}): Dictionary {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') flatten(v as object, key, out);
    else out[key] = String(v);
  }
  return out;
}

const DICTIONARIES: Record<SandworldLang, Dictionary> = {
  es: flatten(es),
  en: flatten(en),
};

/**
 * Traductor propio del juego (sin librerías: el juego tiene que poder salir del portfolio tal cual).
 * Los JSON viajan dentro del chunk del juego. Si falta una clave en un idioma se usa el español, y si
 * tampoco existe se muestra la propia clave (así se ve enseguida qué falta).
 */
@Injectable()
export class Translator {
  readonly lang = signal<SandworldLang>(DEFAULT_LANG);

  setLang(lang: SandworldLang): void {
    this.lang.set(lang);
  }

  /** Traduce `key` sustituyendo {param} por su valor */
  t(key: string, params?: Readonly<Record<string, string | number>>): string {
    const text = DICTIONARIES[this.lang()][key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  }
}

/** Para los tests: claves presentes en un idioma y ausentes en el otro */
export function missingKeys(): { es: string[]; en: string[] } {
  const ks = Object.keys(DICTIONARIES.es), ke = Object.keys(DICTIONARIES.en);
  return { es: ke.filter(k => !(k in DICTIONARIES.es)), en: ks.filter(k => !(k in DICTIONARIES.en)) };
}
