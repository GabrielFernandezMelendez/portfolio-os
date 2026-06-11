import { Component, input, output } from '@angular/core';
import { OsWindow } from '../interfaces/window.interface';

@Component({
  selector:    'app-desktop-icon',
  standalone:  true,
  templateUrl: './desktop-icon.html',
  styleUrl:    './desktop-icon.css'
})
export class DesktopIconComponent {
  win        = input.required<OsWindow>();
  onOpen     = output<string>();
  onMoveIcon = output<{ id: string; x: number; y: number }>();
  onTrash    = output<string>();

  private dragging = false;
  private moved    = false;
  private offsetX  = 0;
  private offsetY  = 0;

  // ── Helper coordenadas mouse/touch ────────────────
  private getCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if (e instanceof TouchEvent) {
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: t.clientX, y: t.clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }

  startDrag(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const coords  = this.getCoords(e);
    this.moved    = false;
    this.dragging = true;
    this.offsetX  = coords.x - this.win().desktopX;
    this.offsetY  = coords.y - this.win().desktopY;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!this.dragging) return;
      const c = this.getCoords(ev);
      this.moved = true;
      this.onMoveIcon.emit({
        id: this.win().id,
        x:  c.x - this.offsetX,
        y:  c.y - this.offsetY
      });
    };

    const onUp = (ev: MouseEvent | TouchEvent) => {
      this.dragging = false;
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('mouseup',   onUp as any);
      document.removeEventListener('touchend',  onUp as any);

      const c     = this.getCoords(ev);
      const trash = document.getElementById('trash-bin');
      if (trash) {
        const rect = trash.getBoundingClientRect();
        if (c.x >= rect.left && c.x <= rect.right &&
            c.y >= rect.top  && c.y <= rect.bottom) {
          this.onTrash.emit(this.win().id);
          return;
        }
      }

      if (!this.moved) {
        this.onOpen.emit(this.win().id);
      }
    };

    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('touchmove', onMove as any, { passive: false });
    document.addEventListener('mouseup',   onUp as any);
    document.addEventListener('touchend',  onUp as any);
  }
}