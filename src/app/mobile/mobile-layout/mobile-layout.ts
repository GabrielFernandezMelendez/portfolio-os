import { Component, signal, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MobileBackgroundComponent } from '../mobile-background/mobile-background';
import { MobileStatusBarComponent } from '../mobile-status-bar/mobile-status-bar';
import { NotificationPanelComponent } from '../notification-panel/notification-panel';
import { MobileHomeComponent } from '../mobile-home/mobile-home';
import { MobileAppViewComponent } from '../mobile-app-view/mobile-app-view';
import { MobileRecentsComponent } from '../mobile-recents/mobile-recents';
import { MobileNavbarComponent } from '../mobile-navbar/mobile-navbar';
import { MobileApp, MobilePage, MobileView } from '../mobile.interfaces';

@Component({
  selector: 'app-mobile-layout',
  standalone: true,
  imports: [
    MobileBackgroundComponent,
    MobileStatusBarComponent,
    NotificationPanelComponent,
    MobileHomeComponent,
    MobileAppViewComponent,
    MobileRecentsComponent,
    MobileNavbarComponent,
  ],
  templateUrl: './mobile-layout.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mobile-layout.css',
})
export class MobileLayoutComponent {
  @ViewChild(MobileAppViewComponent) appView?: MobileAppViewComponent;

  isDark = signal(true);
  golPaused = signal(false);
  mobileView = signal<MobileView>('home');
  activeApp = signal<string | null>(null);
  openedApps = signal<MobileApp[]>([]);

  private readonly PAGES_KEY = 'portfolio-pages-layout';

  // Apps que van a la página de juegos
  private readonly GAME_IDS = ['racing', 'sandworld'];

  readonly ALL_APPS: MobileApp[] = [
    { id: 'about', title: 'Sobre mí', icon: '👤', iconSvg: 'mobile-design/Icons/Perfil.svg' },
    {
      id: 'experience',
      title: 'Experiencia',
      icon: '💼',
      iconSvg: 'mobile-design/Icons/experiencia.svg',
    },
    { id: 'skills', title: 'Habilidades', icon: '🛠', iconSvg: 'mobile-design/Icons/skills.svg' },
    {
      id: 'education',
      title: 'Formación',
      icon: '🎓',
      iconSvg: 'mobile-design/Icons/education.svg',
    },
    { id: 'projects', title: 'Proyectos', icon: '📁', iconSvg: 'mobile-design/Icons/projects.svg' },
    { id: 'contact', title: 'Contacto', icon: '📬', iconSvg: 'mobile-design/Icons/contact.svg' },
    { id: 'github', title: 'GitHub', icon: '🐙', iconSvg: 'mobile-design/Icons/github.svg' },
    { id: 'settings', title: 'Ajustes', icon: '⚙️', iconSvg: 'mobile-design/Icons/settings.svg' },
    { id: 'racing', title: 'RaceTime', icon: '🏎️' },
    {
      id: 'sandworld',
      title: 'Sandworld',
      icon: '🏝️',
      iconSvg: 'mobile-design/Icons/sandworld.svg',
    },
  ];

  readonly DEFAULT_PAGES: MobilePage[] = [
    { id: 'page-cv', apps: this.ALL_APPS.filter((a) => !this.GAME_IDS.includes(a.id)) },
    { id: 'page-games', apps: this.ALL_APPS.filter((a) => this.GAME_IDS.includes(a.id)) },
  ];

  pages = signal<MobilePage[]>(this.loadPages());
  currentPage = signal<number>(0);

  private loadPages(): MobilePage[] {
    try {
      const saved = localStorage.getItem(this.PAGES_KEY);
      if (saved) {
        const parsed: MobilePage[] = JSON.parse(saved);
        const cleaned = parsed.filter((p, i) => i === 0 || p.apps.length > 0);
        return cleaned.length > 0 ? this.mergeNewApps(cleaned) : this.DEFAULT_PAGES;
      }
    } catch {}
    return this.DEFAULT_PAGES;
  }

  /**
   * Añade a la distribución guardada las apps de ALL_APPS que aún no aparecen
   * (por ejemplo, un juego nuevo). Respeta el orden y las carpetas del usuario.
   * Los juegos van a la página de juegos; el resto, a la última página.
   */
  private mergeNewApps(pages: MobilePage[]): MobilePage[] {
    const present = new Set<string>();
    for (const page of pages) {
      for (const app of page.apps) {
        present.add(app.id);
        app.apps?.forEach((inner) => present.add(inner.id)); // apps dentro de carpetas
      }
    }

    const missing = this.ALL_APPS.filter((a) => !present.has(a.id));
    if (missing.length === 0) return pages;

    const merged = pages.map((p) => ({ ...p, apps: [...p.apps] }));
    const gamesPage = merged.find((p) => p.id === 'page-games') ?? merged[merged.length - 1];

    for (const app of missing) {
      const target = this.GAME_IDS.includes(app.id) ? gamesPage : merged[merged.length - 1];
      target.apps.push(app);
    }

    localStorage.setItem(this.PAGES_KEY, JSON.stringify(merged));
    return merged;
  }

  private savePages() {
    localStorage.setItem(this.PAGES_KEY, JSON.stringify(this.pages()));
  }

  addPage() {
    if (this.pages().length >= this.ALL_APPS.length) return;
    this.pages.update((p) => [...p, { id: `page-${Date.now()}`, apps: [] }]);
    this.savePages();
  }

  removePage(pageId: string) {
    if (this.pages().length <= 1) return;
    this.pages.update((p) => p.filter((page) => page.id !== pageId));
    if (this.currentPage() >= this.pages().length) {
      this.currentPage.set(this.pages().length - 1);
    }
    this.savePages();
  }

  goToPage(index: number) {
    this.currentPage.set(index);
  }

  toggleTheme() {
    this.isDark.update((v: boolean) => !v);
  }
  toggleGol() {
    this.golPaused.update((v: boolean) => !v);
  }

  private previousView: MobileView = 'home';

  /**
   * ¿Hay un juego abierto en pantalla? Mientras se juega, los gestos son del juego (arrastrar la cámara en
   * diagonal hacia abajo, deslizar desde arriba...): no se abre la pantalla de notificaciones.
   */
  private inGame(): boolean {
    return this.mobileView() === 'app' && this.GAME_IDS.includes(this.activeApp() ?? '');
  }

  openNotifications() {
    if (this.inGame()) return;
    this.previousView = this.mobileView();
    this.mobileView.set('notifications');
  }

  closeNotifications() {
    this.mobileView.set(this.previousView);
  }

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
    this.openedApps.update((list: MobileApp[]) => list.filter((a) => a.id !== id));
    if (this.activeApp() === id) this.activeApp.set(null);
    if (this.openedApps().length === 0) {
      this.mobileView.set('home');
    } else {
      this.mobileView.set('recents');
    }
  }

  goHome() {
    if (this.mobileView() === 'app' && this.appView) {
      this.appView.dismiss();
      setTimeout(() => {
        this.mobileView.set('home');
        this.activeApp.set(null);
      }, 250);
    } else {
      this.mobileView.set('home');
      this.activeApp.set(null);
    }
  }

  goBack() {
    if (this.mobileView() === 'app' && this.appView) {
      this.appView.dismiss();
      setTimeout(() => {
        this.mobileView.set('home');
        this.activeApp.set(null);
      }, 250);
    } else {
      this.mobileView.set('home');
    }
  }

  goRecents() {
    this.mobileView.set('recents');
  }

  private swipeStartX = 0;
  private swipeStartY = 0;

  onSwipeStart(e: TouchEvent) {
    this.swipeStartX = e.touches[0].clientX;
    this.swipeStartY = e.touches[0].clientY;
  }

  onSwipeEnd(e: TouchEvent) {
    const deltaX = e.changedTouches[0].clientX - this.swipeStartX;
    const deltaY = e.changedTouches[0].clientY - this.swipeStartY;
    if (deltaX > 40 && deltaY > 40 && this.mobileView() !== 'notifications') {
      this.openNotifications();
    }
  }

  openSettings() {
    this.closeNotifications();
    this.openApp({ id: 'settings', title: 'Ajustes', icon: '⚙️' });
  }

  moveAppToPage(event: { app: MobileApp; fromPageId: string; toPageIndex: number }) {
    const { app, fromPageId, toPageIndex } = event;
    const targetPage = this.pages()[toPageIndex];

    if (!targetPage || targetPage.id === fromPageId) return;

    const targetPageId = targetPage.id;

    this.pages.update((pages) => {
      return pages.map((page) => {
        if (page.id === fromPageId) {
          return { ...page, apps: page.apps.filter((a) => a.id !== app.id) };
        }
        if (page.id === targetPageId) {
          if (page.apps.some((a) => a.id === app.id)) return page;
          return { ...page, apps: [...page.apps, app] };
        }
        return page;
      });
    });

    this.savePages();
  }

  moveAppToNewPage(event: { app: MobileApp; fromPageId: string }) {
    const { app, fromPageId } = event;

    const updated = this.pages().map((page) =>
      page.id === fromPageId
        ? { ...page, apps: page.apps.filter((a) => a.id !== app.id) }
        : { ...page, apps: [...page.apps] },
    );

    this.pages.set([...updated, { id: `page-${Date.now()}`, apps: [app] }]);

    setTimeout(() => {
      this.currentPage.set(this.pages().length - 1);
    }, 50);

    this.savePages();
  }

  // ── Carpetas ──────────────────────────────────
  createFolder(app1: MobileApp, app2: MobileApp, pageId: string) {
    const folder: MobileApp = {
      id: `folder-${Date.now()}`,
      title: 'Carpeta',
      icon: '📁',
      isFolder: true,
      folderName: 'Carpeta',
      apps: [app1, app2],
    };

    this.pages.update((pages) => {
      return pages.map((page) => {
        if (page.id !== pageId) return { ...page, apps: [...page.apps] };

        const newApps = page.apps.filter((a) => a.id !== app1.id && a.id !== app2.id);

        // Insertar la carpeta en la posición de app2
        const app2Index = page.apps.findIndex((a) => a.id === app2.id);
        newApps.splice(Math.min(app2Index, newApps.length), 0, folder);

        return { ...page, apps: newApps };
      });
    });

    this.savePages();
  }

  addAppToFolder(app: MobileApp, folderId: string, fromPageId: string) {
    this.pages.update((pages) => {
      return pages.map((page) => {
        if (page.id === fromPageId) {
          return {
            ...page,
            apps: page.apps
              .map((a) => {
                if (a.id === folderId && a.isFolder) {
                  return { ...a, apps: [...(a.apps || []), app] };
                }
                return a;
              })
              .filter((a) => a.id !== app.id || a.id === folderId),
          };
        }
        return { ...page, apps: [...page.apps] };
      });
    });

    this.savePages();
  }

  renameFolder(folderId: string, newName: string) {
    this.pages.update((pages) => {
      return pages.map((page) => ({
        ...page,
        apps: page.apps.map((a) =>
          a.id === folderId ? { ...a, folderName: newName, title: newName } : a,
        ),
      }));
    });

    this.savePages();
  }
}
