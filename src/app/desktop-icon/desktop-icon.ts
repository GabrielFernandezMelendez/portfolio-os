import { Component, input, output, signal } from '@angular/core';
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

  private dragging  = false;
  private moved     = false;
  private offsetX   = 0;
  private offsetY   = 0;

  startDrag(e: MouseEvent) {
    e.preventDefault();
    this.moved    = false;
    this.dragging = true;
    this.offsetX  = e.clientX - this.win().desktopX;
    this.offsetY  = e.clientY - this.win().desktopY;

    const onMove = (ev: MouseEvent) => {
      if (!this.dragging) return;
      this.moved = true;
      this.onMoveIcon.emit({
        id: this.win().id,
        x:  ev.clientX - this.offsetX,
        y:  ev.clientY - this.offsetY
      });
    };

    const onUp = (ev: MouseEvent) => {
      this.dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);

      // Comprobar si se soltó sobre la papelera
      const trash = document.getElementById('trash-bin');
      if (trash) {
        const rect = trash.getBoundingClientRect();
        if (
          ev.clientX >= rect.left && ev.clientX <= rect.right &&
          ev.clientY >= rect.top  && ev.clientY <= rect.bottom
        ) {
          this.onTrash.emit(this.win().id);
          return;
        }
      }

      if (!this.moved) {
        this.onOpen.emit(this.win().id);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }
}