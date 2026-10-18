import { Component, input, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../../../i18n/i18n.service';

@Component({
  selector: 'app-about-mobile',
  standalone: true,
  templateUrl: './about-mobile.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './about-mobile.css',
})
export class AboutMobileComponent {
  isDark = input<boolean>(true);
  i18n = inject(I18nService);

  // Fuerza el tracking del signal en el componente
  lang = computed(() => this.i18n.currentLang());
}
