import { Component, input, output } from '@angular/core';
import { OsWindow } from '../interfaces/window.interface';

@Component({
  selector: 'app-desktop-icon',
  standalone: true,
  templateUrl: './desktop-icon.html',
  styleUrl: './desktop-icon.css',
})
export class DesktopIconComponent {
  win = input.required<OsWindow>();
  onOpen = output<string>();
  onMoveIcon = output<{ id: string; x: number; y: number }>();
  onTrash = output<string>();

  private dragging = false;
  private moved = false;
  private offsetX = 0;
  private offsetY = 0;
  private lastTapTime = 0;
  private readonly DOUBLE_TAP_MS = 800;

  startDrag(e: PointerEvent) {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    this.moved = false;
    this.dragging = true;
    this.offsetX = e.clientX - this.win().desktopX;
    this.offsetY = e.clientY - this.win().desktopY;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      if (!this.dragging) return;
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx < 8 && dy < 8) return;
      this.moved = true;
      this.onMoveIcon.emit({
        id: this.win().id,
        x: ev.clientX - this.offsetX,
        y: ev.clientY - this.offsetY,
      });
    };

    const onUp = (ev: PointerEvent) => {
      this.dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      const trash = document.getElementById('trash-bin');
      if (trash) {
        const rect = trash.getBoundingClientRect();
        if (
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom
        ) {
          this.onTrash.emit(this.win().id);
          return;
        }
      }

      if (!this.moved) {
        const now = Date.now();
        if (now - this.lastTapTime < this.DOUBLE_TAP_MS) {
          this.onOpen.emit(this.win().id);
          this.lastTapTime = 0;
        } else {
          this.lastTapTime = now;
        }
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }
}
