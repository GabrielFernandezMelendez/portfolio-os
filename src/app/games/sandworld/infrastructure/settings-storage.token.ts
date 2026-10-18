import { InjectionToken } from '@angular/core';
import { SettingsStorage } from '../domain/ports/settings-storage.port';

/** Token para inyectar el adaptador de ajustes (web: localStorage; Ionic: Preferences) */
export const SETTINGS_STORAGE = new InjectionToken<SettingsStorage>('SANDWORLD_SETTINGS_STORAGE');
