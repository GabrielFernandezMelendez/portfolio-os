import { Component, inject } from '@angular/core';
import { I18nService, Language } from '../../i18n/i18n.service';

@Component({
  selector:    'app-settings-panel',
  standalone:  true,
  templateUrl: './settings-panel.html',
  styleUrl:    './settings-panel.css',
})
export class SettingsPanelComponent {

  i18n = inject(I18nService);

  languages: { code: Language; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ];

  setLang(lang: Language) {
    this.i18n.setLang(lang);
  }
}