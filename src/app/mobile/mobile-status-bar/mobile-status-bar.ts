import { Component, input, output, signal,
         OnInit, OnDestroy, HostListener } from '@angular/core';

@Component({
  selector:    'app-mobile-status-bar',
  standalone:  true,
  templateUrl: './mobile-status-bar.html',
  styleUrl:    './mobile-status-bar.css'
})
export class MobileStatusBarComponent implements OnInit, OnDestroy {

  isDark          = input<boolean>(true);
  onSwipeDown     = output<void>();

  currentTime     = signal('00:00');
  private clockInterval: any;
  private touchStartY = 0;

  ngOnInit() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.clockInterval);
  }

  updateClock() {
    const now = new Date();
    const h   = String(now.getHours()).padStart(2, '0');
    const m   = String(now.getMinutes()).padStart(2, '0');
    this.currentTime.set(`${h}:${m}`);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    this.touchStartY = e.touches[0].clientY;
  }

@HostListener('touchend', ['$event'])
onTouchEnd(e: TouchEvent) {
  const deltaY = e.changedTouches[0].clientY - this.touchStartY;
  if (this.touchStartY < 120 && deltaY > 40) {
    this.onSwipeDown.emit();
  }
}
}