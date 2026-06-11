import { Component, signal } from '@angular/core';
import { MobileBackgroundComponent }  from '../mobile-background/mobile-background';
import { MobileStatusBarComponent }   from '../mobile-status-bar/mobile-status-bar';
import { NotificationPanelComponent } from '../notification-panel/notification-panel';
import { MobileHomeComponent }        from '../mobile-home/mobile-home';
import { MobileAppViewComponent }     from '../mobile-app-view/mobile-app-view';
import { MobileRecentsComponent }     from '../mobile-recents/mobile-recents';
import { MobileNavbarComponent }      from '../mobile-navbar/mobile-navbar';
import { MobileApp, MobileView }      from '../mobile.interfaces';

@Component({
  selector:    'app-mobile-layout',
  standalone:  true,
  imports:     [
    MobileBackgroundComponent,
    MobileStatusBarComponent,
    NotificationPanelComponent,
    MobileHomeComponent,
    MobileAppViewComponent,
    MobileRecentsComponent,
    MobileNavbarComponent,
  ],
  templateUrl: './mobile-layout.html',
  styleUrl:    './mobile-layout.css'
})
export class MobileLayoutComponent {

  // ── Estado global ─────────────────────────────
  isDark     = signal(true);
  golPaused  = signal(false);
  mobileView = signal<MobileView>('home');
  activeApp  = signal<string | null>(null);
  openedApps = signal<MobileApp[]>([]);

  // ── Apps disponibles ──────────────────────────
  apps: MobileApp[] = [
    { id: 'about',      title: 'Sobre mí',    icon: '👤' },
    { id: 'experience', title: 'Experiencia', icon: '💼' },
    { id: 'skills',     title: 'Habilidades', icon: '🛠' },
    { id: 'education',  title: 'Formación',   icon: '🎓' },
    { id: 'projects',   title: 'Proyectos',   icon: '📁' },
    { id: 'contact',    title: 'Contacto',    icon: '📬' },
    { id: 'github',     title: 'GitHub',      icon: '🐙' },
  ];

  // ── Tema y fondo ──────────────────────────────
  toggleTheme() { this.isDark.update((v: boolean) => !v); }
  toggleGol()   { this.golPaused.update((v: boolean) => !v); }

  // ── Notificaciones ────────────────────────────
  openNotifications()  { this.mobileView.set('notifications'); }
  closeNotifications() { this.mobileView.set('home'); }

  // ── Gestión de apps ───────────────────────────
  openApp(app: MobileApp) {
    this.activeApp.set(app.id);
    this.mobileView.set('app');
    if (!this.openedApps().find((a: MobileApp) => a.id === app.id)) {
      this.openedApps.update((list: MobileApp[]) => [...list, app]);
    }
  }

  resumeApp(app: MobileApp) {
    this.activeApp.set(app.id);
    this.mobileView.set('app');
  }

  closeApp(id: string) {
    this.openedApps.update((list: MobileApp[]) => list.filter(a => a.id !== id));
    if (this.activeApp() === id) this.activeApp.set(null);
    if (this.openedApps().length === 0) {
      this.mobileView.set('home');
    } else {
      this.mobileView.set('recents');
    }
  }

  // ── Navbar ────────────────────────────────────
  goHome() {
    this.mobileView.set('home');
    this.activeApp.set(null);
  }

  goBack() {
    if (this.mobileView() === 'app' || this.mobileView() === 'recents') {
      this.mobileView.set('home');
    } else {
      this.mobileView.set('home');
    }
  }

  goRecents() {
    this.mobileView.set('recents');
  }
}