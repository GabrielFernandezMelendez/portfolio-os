import { Component, input, output, signal,
         OnInit, OnDestroy, HostListener } from '@angular/core';

export interface MobileNotification {
  id:      string;
  icon:    string;
  title:   string;
  message: string;
  time:    string;
}

@Component({
  selector:    'app-notification-panel',
  standalone:  true,
  templateUrl: './notification-panel.html',
  styleUrl:    './notification-panel.css'
})
export class NotificationPanelComponent implements OnInit, OnDestroy {

  isDark        = input<boolean>(true);
  golPaused     = input<boolean>(false);
  onClose       = output<void>();
  onToggleTheme = output<void>();
  onToggleGol   = output<void>();

  currentTime   = signal('');
  currentDate   = signal('');
  closing       = signal(false);

  private clockInterval: any;
  private touchStartY = 0;

  notifications: MobileNotification[] = [
    {
      id:      'available',
      icon:    '💼',
      title:   'Disponible para trabajar',
      message: 'Abierto a nuevas oportunidades',
      time:    'Ahora'
    }
  ];

  ngOnInit() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    clearInterval(this.clockInterval);
  }

  updateClock() {
    const now    = new Date();
    const h      = String(now.getHours()).padStart(2, '0');
    const m      = String(now.getMinutes()).padStart(2, '0');
    const days   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['Ene','Feb','Mar','Abr','May','Jun',
                    'Jul','Ago','Sep','Oct','Nov','Dic'];
    this.currentTime.set(`${h}:${m}`);
    this.currentDate.set(
      `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`
    );
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    this.touchStartY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - this.touchStartY;
    if (deltaY < -50) this.dismiss();
  }

  dismiss() {
    this.closing.set(true);
    setTimeout(() => {
      this.closing.set(false);
      this.onClose.emit();
    }, 280);
  }

  closePanel() {
    this.dismiss();
  }
}