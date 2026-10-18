import { SandworldLang } from '../models/settings.model';

/** Preferencias del jugador que sobreviven entre sesiones (no es la partida: el guardado llega en la fase 5) */
export interface StoredSettings {
  lang?: SandworldLang;
}

/** Puerto de almacenamiento de ajustes. Web: localStorage. Ionic: se podrá cambiar por Capacitor Preferences. */
export interface SettingsStorage {
  load(): StoredSettings;
  save(settings: StoredSettings): void;
}
