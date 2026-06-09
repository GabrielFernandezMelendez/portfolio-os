import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { OsWindow } from '../interfaces/window.interface';

@Component({
  selector:    'app-taskbar',
  standalone:  true,
  templateUrl: './taskbar.html',
  styleUrl:    './taskbar.css'
})
export class TaskbarComponent implements OnInit, OnDestroy {

  windows     = input.required<OsWindow[]>();
  isDark      = input.required<boolean>();
  golRunning  = input.required<boolean>();

  onOpenWindow  = output<string>();
  onToggleTheme = output<void>();
  onToggleGol   = output<void>();

  currentTime = signal('00:00:00');
  currentDate = signal('');
  tooltip     = signal('');
  tooltipX    = signal(0);

  private clockInterval: any;

  ngOnInit() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.clockInterval);
  }

  updateClock() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    const s    = String(now.getSeconds()).padStart(2, '0');
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    this.currentTime.set(`${h}:${m}:${s}`);
    this.currentDate.set(`${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`);
  }

  showTooltip(name: string, x: number) {
    this.tooltip.set(name);
    this.tooltipX.set(x);
  }

  hideTooltip() {
    this.tooltip.set('');
  }

  openWindow(id: string) {
    this.onOpenWindow.emit(id);
  }


golSpeed   = input.required<number>();
onSetSpeed = output<number>();

cycleSpeed() {
  const next = (this.golSpeed() % 3) + 1;
  this.onSetSpeed.emit(next);
}

}