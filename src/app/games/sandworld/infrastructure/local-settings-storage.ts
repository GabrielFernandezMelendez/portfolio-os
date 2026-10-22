import { SettingsStorage, StoredSettings } from '../domain/ports/settings-storage.port';
import { SANDWORLD_LANGS } from '../domain/models/settings.model';

const KEY = 'sandworld.settings';

/** Ajustes en localStorage. Nunca lanza: en modo privado o sin almacenamiento simplemente no recuerda. */
export class LocalSettingsStorage implements SettingsStorage {
  load(): StoredSettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const data = JSON.parse(raw) as StoredSettings;
      // Solo se aceptan valores válidos: un dato corrupto no rompe el juego
      const out: StoredSettings = {};
      if (SANDWORLD_LANGS.includes(data.lang as never)) out.lang = data.lang;
      if (typeof data.blood === 'boolean') out.blood = data.blood;
      return out;
    } catch {
      return {};
    }
  }

  save(settings: StoredSettings): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* sin almacenamiento disponible */
    }
  }
}
