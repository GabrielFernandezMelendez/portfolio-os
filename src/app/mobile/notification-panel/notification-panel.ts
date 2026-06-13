import { Component, input, output, signal, OnInit,
         OnDestroy, HostListener, inject, computed } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';

export interface MobileNotification {
  id:           string;
  icon:         string;
  title:        string;
  message:      string;
  time:         string;
  dismissable?: boolean;
}

@Component({
  selector:    'app-notification-panel',
  standalone:  true,
  templateUrl: './notification-panel.html',
  styleUrl:    './notification-panel.css',
})
export class NotificationPanelComponent implements OnInit, OnDestroy {

  isDark         = input<boolean>(true);
  golPaused      = input<boolean>(false);
  onClose        = output<void>();
  onToggleTheme  = output<void>();
  onToggleGol    = output<void>();
  onOpenSettings = output<void>();

  i18n       = inject(I18nService);
  lang       = computed(() => this.i18n.currentLang());

  currentTime = signal('');
  currentDate = signal('');
  closing     = signal(false);
  dismissing  = signal(false);
  swipeOffset = signal(0);
  isSwiping   = signal(false);
  tipDismissed = signal(sessionStorage.getItem('tip-dismissed') === 'true');

  private touchStartX      = 0;
  private touchStartY      = 0;
  private panelTouchStartY = 0;
  private clockInterval:   any;

  readonly DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  readonly DAYS_EN   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  readonly MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  readonly MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  get notifications(): MobileNotification[] {
    return [{
      id:      'available',
      icon:    '💼',
      title:   this.i18n.t('notification.available_title'),
      message: this.i18n.t('notification.available_message'),
      time:    this.i18n.t('notification.available_time'),
    }];
  }

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
    const isEn   = this.i18n.currentLang() === 'en';
    const days   = isEn ? this.DAYS_EN   : this.DAYS_ES;
    const months = isEn ? this.MONTHS_EN : this.MONTHS_ES;
    this.currentTime.set(`${h}:${m}`);
    this.currentDate.set(`${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`);
  }

  @HostListener('touchstart', ['$event'])
  onPanelTouchStart(e: TouchEvent) {
    this.panelTouchStartY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onPanelTouchEnd(e: TouchEvent) {
    const deltaY = e.changedTouches[0].clientY - this.panelTouchStartY;
    if (deltaY < -50) this.dismiss();
  }

  dismiss() {
    this.closing.set(true);
    setTimeout(() => {
      this.closing.set(false);
      this.onClose.emit();
    }, 280);
  }

  closePanel() { this.dismiss(); }

  onTipTouchStart(e: TouchEvent) {
    e.stopPropagation();
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isSwiping.set(true);
  }

  onTipTouchMove(e: TouchEvent) {
    e.stopPropagation();
    const deltaX = e.touches[0].clientX - this.touchStartX;
    const deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);
    if (deltaY > 20) { this.swipeOffset.set(0); return; }
    this.swipeOffset.set(deltaX);
  }

  onTipTouchEnd(e: TouchEvent) {
    e.stopPropagation();
    const deltaX = e.changedTouches[0].clientX - this.touchStartX;
    this.isSwiping.set(false);
    if (Math.abs(deltaX) < 30) {
      this.swipeOffset.set(0);
    } else if (deltaX < 0) {
      this.swipeOffset.set(-80);
    } else {
      this.swipeOffset.set(80);
    }
  }

  deleteTip() {
    this.dismissing.set(true);
    setTimeout(() => {
      sessionStorage.setItem('tip-dismissed', 'true');
      this.tipDismissed.set(true);
      this.dismissing.set(false);
      this.swipeOffset.set(0);
    }, 500);
  }
}