import { Component, input, output, inject, computed } from '@angular/core';
import { MobileApp } from '../mobile.interfaces';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector:    'app-mobile-home',
  standalone:  true,
  templateUrl: './mobile-home.html',
  styleUrl:    './mobile-home.css'
})
export class MobileHomeComponent {
  apps      = input.required<MobileApp[]>();
  isDark    = input<boolean>(true);
  onOpenApp = output<MobileApp>();

  i18n = inject(I18nService);
  lang = computed(() => this.i18n.currentLang());

  getTitle(app: MobileApp): string {
    return this.i18n.t(`nav.${app.id}`);
  }
}