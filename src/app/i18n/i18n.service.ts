import { Injectable, signal, computed } from '@angular/core';
import es from './es.json';
import en from './en.json';

export type Language = 'es' | 'en';

const TRANSLATIONS: Record<Language, any> = { es, en };

@Injectable({ providedIn: 'root' })
export class I18nService {

  private readonly STORAGE_KEY = 'portfolio-lang';

  currentLang = signal<Language>(
    (localStorage.getItem(this.STORAGE_KEY) as Language) ?? 'es'
  );

  setLang(lang: Language) {
    this.currentLang.set(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
  }

  toggleLang() {
    this.setLang(this.currentLang() === 'es' ? 'en' : 'es');
  }

  t(key: string): string {
    const keys   = key.split('.');
    let   result = TRANSLATIONS[this.currentLang()];
    for (const k of keys) {
      result = result?.[k];
    }
    return result ?? key;
  }

  tArray<T>(key: string): T[] {
    const keys   = key.split('.');
    let   result = TRANSLATIONS[this.currentLang()];
    for (const k of keys) {
      result = result?.[k];
    }
    return Array.isArray(result) ? result : [];
  }
}