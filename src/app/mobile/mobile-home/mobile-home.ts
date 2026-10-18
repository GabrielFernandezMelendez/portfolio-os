import { Component, input, output, inject, computed, signal } from '@angular/core';
import { MobileApp, MobilePage } from '../mobile.interfaces';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector:    'app-mobile-home',
  standalone:  true,
  templateUrl: './mobile-home.html',
  styleUrl:    './mobile-home.css'
})
export class MobileHomeComponent {

  pages        = input.required<MobilePage[]>();
  currentPage  = input<number>(0);
  isDark       = input<boolean>(true);

  onOpenApp          = output<MobileApp>();
  onPageChange       = output<number>();
  onAddPage          = output<void>();
  onMoveAppToPage    = output<{ app: MobileApp; fromPageId: string; toPageIndex: number }>();
  onMoveAppToNewPage = output<{ app: MobileApp; fromPageId: string }>();
  onCreateFolder     = output<{ app1: MobileApp; app2: MobileApp; pageId: string }>();
  onAddAppToFolder   = output<{ app: MobileApp; folderId: string; fromPageId: string }>();
  onRenameFolder_emit = output<{ folderId: string; newName: string }>();

  i18n        = inject(I18nService);
  lang        = computed(() => this.i18n.currentLang());
  showConfirm = signal(false);

  // ── Drag state ────────────────────────────────
  draggingApp     = signal<MobileApp | null>(null);
  dragFromPageId  = signal<string>('');
  isDragging      = signal(false);
  ghostX          = signal(0);
  ghostY          = signal(0);
  showNewPageHint = signal(false);
  dropTargetId    = signal<string | null>(null);

  readonly screenWidth  = window.innerWidth;
  private readonly EDGE = 50;

  private longPressTimer: any    = null;
  private edgeNavTimer: any      = null;
  private dropHoverTimer: any    = null;
  private dragStartX             = 0;
  private dragStartY             = 0;
  private touchStartX            = 0;
  private touchStartY            = 0;
  private longPressTriggered     = false;
  private dropTargetReady        = false;

  // ── Carpeta abierta ───────────────────────────
  openFolder = signal<MobileApp | null>(null);
  folderEditName = signal('');

  getTitle(app: MobileApp): string {
    if (app.isFolder) return app.folderName || 'Carpeta';
    return this.i18n.t(`nav.${app.id}`);
  }

  canAddPage(totalApps: number): boolean {
    return this.pages().length < totalApps;
  }

  // ── Swipe entre páginas ───────────────────────
  onTouchStart(e: TouchEvent) {
    if (this.isDragging()) return;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent) {
    if (this.isDragging()) return;

    const deltaX = e.changedTouches[0].clientX - this.touchStartX;
    const deltaY = Math.abs(e.changedTouches[0].clientY - this.touchStartY);

    if (Math.abs(deltaX) < 50 || deltaY > 40) return;

    const current = this.currentPage();
    const total   = this.pages().length;

    if (deltaX < 0 && current < total - 1) {
      this.onPageChange.emit(current + 1);
    } else if (deltaX > 0 && current > 0) {
      this.onPageChange.emit(current - 1);
    }
  }

  // ── Long press + drag ─────────────────────────
  onAppTouchStart(e: TouchEvent, app: MobileApp, pageId: string) {
    if (app.isFolder && this.openFolder()) return;

    this.dragStartX = e.touches[0].clientX;
    this.dragStartY = e.touches[0].clientY;
    this.longPressTriggered = false;

    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.draggingApp.set(app);
      this.dragFromPageId.set(pageId);
      this.isDragging.set(true);
      this.ghostX.set(this.dragStartX - 36);
      this.ghostY.set(this.dragStartY - 36);
      try { navigator.vibrate(50); } catch {}
    }, 500);
  }

  onAppTouchMove(e: TouchEvent) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    if (!this.isDragging()) {
      const deltaX = Math.abs(x - this.dragStartX);
      const deltaY = Math.abs(y - this.dragStartY);
      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(this.longPressTimer);
      }
      return;
    }

    e.preventDefault();
    this.ghostX.set(x - 36);
    this.ghostY.set(y - 36);

    this.detectDropTarget(x, y);
    this.handleEdgeNavigation(x);
  }

  private detectDropTarget(x: number, y: number) {
    const dragging = this.draggingApp();
    if (!dragging) return;

    // Buscar el app-icon bajo el dedo
    const elements = document.elementsFromPoint(x, y);
    let targetId: string | null = null;

    for (const el of elements) {
      const appEl = (el as HTMLElement).closest('[data-app-id]') as HTMLElement | null;
      if (appEl) {
        const id = appEl.getAttribute('data-app-id');
        if (id && id !== dragging.id) {
          targetId = id;
          break;
        }
      }
    }

    if (targetId !== this.dropTargetId()) {
      this.dropTargetId.set(targetId);
      this.dropTargetReady = false;
      clearTimeout(this.dropHoverTimer);

      if (targetId) {
        this.dropHoverTimer = setTimeout(() => {
          this.dropTargetReady = true;
          try { navigator.vibrate(30); } catch {}
        }, 400);
      }
    }
  }

  private handleEdgeNavigation(x: number) {
    // No navegar si estamos sobre un drop target
    if (this.dropTargetId()) return;

    const current    = this.currentPage();
    const total      = this.pages().length;
    const isLastPage = current === total - 1;
    const isFirstPage = current === 0;

    if (x > this.screenWidth - this.EDGE) {
      if (isLastPage) {
        if (!this.edgeNavTimer && !this.showNewPageHint()) {
          this.edgeNavTimer = setTimeout(() => {
            this.showNewPageHint.set(true);
            this.edgeNavTimer = null;
          }, 600);
        }
      } else {
        this.showNewPageHint.set(false);
        if (!this.edgeNavTimer) {
          this.edgeNavTimer = setTimeout(() => {
            this.onPageChange.emit(current + 1);
            this.edgeNavTimer = null;
          }, 400);
        }
      }
    } else if (x < this.EDGE) {
      this.showNewPageHint.set(false);
      this.clearEdgeTimer();
      if (!isFirstPage && !this.edgeNavTimer) {
        this.edgeNavTimer = setTimeout(() => {
          this.onPageChange.emit(current - 1);
          this.edgeNavTimer = null;
        }, 400);
      }
    } else {
      this.showNewPageHint.set(false);
      this.clearEdgeTimer();
    }
  }

  private clearEdgeTimer() {
    if (this.edgeNavTimer) {
      clearTimeout(this.edgeNavTimer);
      this.edgeNavTimer = null;
    }
  }

  onAppTouchEnd(e: TouchEvent) {
    clearTimeout(this.longPressTimer);
    clearTimeout(this.dropHoverTimer);
    this.clearEdgeTimer();

    if (!this.isDragging()) return;

    e.preventDefault();
    e.stopPropagation();

    const app = this.draggingApp();
    if (!app) { this.resetDrag(); return; }

    const current    = this.currentPage();
    const fromPageId = this.dragFromPageId();
    const targetId   = this.dropTargetId();

    // Soltar sobre otra app → crear carpeta o añadir a carpeta
    if (targetId && this.dropTargetReady) {
      const currentPageData = this.pages()[current];
      const targetApp = currentPageData?.apps.find(a => a.id === targetId);

      if (targetApp) {
        if (targetApp.isFolder) {
          this.onAddAppToFolder.emit({ app, folderId: targetId, fromPageId });
        } else {
          this.onCreateFolder.emit({ app1: app, app2: targetApp, pageId: fromPageId });
        }
        this.resetDrag();
        return;
      }
    }

    // Soltar en borde última página → nueva página
    if (this.showNewPageHint()) {
      this.onMoveAppToNewPage.emit({ app, fromPageId });
    } else {
      const targetPage = this.pages()[current];
      if (targetPage && targetPage.id !== fromPageId) {
        this.onMoveAppToPage.emit({ app, fromPageId, toPageIndex: current });
      }
    }

    this.resetDrag();
  }

  private resetDrag() {
    this.draggingApp.set(null);
    this.dragFromPageId.set('');
    this.isDragging.set(false);
    this.showNewPageHint.set(false);
    this.dropTargetId.set(null);
    this.dropTargetReady = false;
    this.ghostX.set(0);
    this.ghostY.set(0);
    this.clearEdgeTimer();
    clearTimeout(this.dropHoverTimer);
  }

  // ── Click en app o carpeta ────────────────────
  onAppClick(e: Event, app: MobileApp) {
    if (this.longPressTriggered) {
      e.stopPropagation();
      this.longPressTriggered = false;
      return;
    }

    if (app.isFolder) {
      this.openFolder.set(app);
      this.folderEditName.set(app.folderName || 'Carpeta');
      return;
    }

    this.onOpenApp.emit(app);
  }

  // ── Carpeta modal ─────────────────────────────
closeFolder() {
  this.closingFolder.set(true);
  setTimeout(() => {
    this.closingFolder.set(false);
    this.openFolder.set(null);
  }, 300);
}

openAppFromFolder(app: MobileApp) {
  this.closingFolder.set(true);
  setTimeout(() => {
    this.closingFolder.set(false);
    this.openFolder.set(null);
    this.onOpenApp.emit(app);
  }, 300);
}

  

  // ── Popup ─────────────────────────────────────
  confirmAddPage() { this.showConfirm.set(true);  }
  onConfirm()      { this.showConfirm.set(false); this.onAddPage.emit(); }
  onCancel()       { this.showConfirm.set(false); }

  onRenameFolder() {
  const folder = this.openFolder();
  if (!folder) return;
  const name = this.folderEditName().trim() || 'Carpeta';
  this.folderEditName.set(name);

  // Emitir output para que layout actualice el signal
  this.onRenameFolder_emit.emit({ folderId: folder.id, newName: name });
}

closingFolder = signal(false);


}