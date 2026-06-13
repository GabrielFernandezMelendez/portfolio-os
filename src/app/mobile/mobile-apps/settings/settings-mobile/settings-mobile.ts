import { Component, input, inject } from '@angular/core';
import { I18nService, Language } from '../../../../i18n/i18n.service';

@Component({
  selector:    'app-settings-mobile',
  standalone:  true,
  templateUrl: './settings-mobile.html',
  styleUrl:    './settings-mobile.css',
})
export class SettingsMobileComponent {
  isDark = input<boolean>(true);
  i18n   = inject(I18nService);

  languages: { code: Language; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
  ];

  setLang(lang: Language) {
    this.i18n.setLang(lang);
  }
}