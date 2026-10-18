import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'app-about',
  standalone: true,
  templateUrl: './about.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './about.css',
})
export class AboutComponent {
  i18n = inject(I18nService);
}
