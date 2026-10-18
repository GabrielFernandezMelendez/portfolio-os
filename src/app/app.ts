import { Component, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { DesktopComponent } from './desktop/desktop';
import { MobileLayoutComponent } from './mobile/mobile-layout/mobile-layout';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DesktopComponent, MobileLayoutComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App {
  isMobile = signal(window.innerWidth < 768);

  @HostListener('window:resize')
  onResize() {
    this.isMobile.set(window.innerWidth < 768);
  }
}
