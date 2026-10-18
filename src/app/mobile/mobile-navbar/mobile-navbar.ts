import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { MobileView } from '../mobile.interfaces';

@Component({
  selector: 'app-mobile-navbar',
  standalone: true,
  templateUrl: './mobile-navbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mobile-navbar.css',
})
export class MobileNavbarComponent {
  isDark = input<boolean>(true);
  activeView = input<MobileView>('home');

  onBack = output<void>();
  onHome = output<void>();
  onRecents = output<void>();
}
