import { Component, input, output, OnInit } from '@angular/core';
import { OsWindow } from '../interfaces/window.interface';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

@Component({
  selector: 'app-window',
  standalone: true,
  templateUrl: './window.html',
  styleUrl: './window.css',
})
export class WindowComponent implements OnInit {
  win = input.required<OsWindow>();
  onClose = output<string>();
  onFocus = output<string>();
  onMove = output<{ id: string; x: number; y: number }>();
  onResize = output<{ id: string; x: number; y: number; width: number; height: number }>();
  onMinimize = output<string>();

  private isMaximized = false;
  private prevX = 0;
  private prevY = 0;
  private prevWidth = 0;
  private prevHeight = 0;

  private dragging = false;
  private resizing = false;
  private resizeDir: ResizeDirection = null;
  private startMouseX = 0;
  private startMouseY = 0;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;
  private offsetX = 0;
  private offsetY = 0;

  get MIN_WIDTH() {
    return this.win().minWidth ?? 280;
  }
  get MIN_HEIGHT() {
    return this.win().minHeight ?? 180;
  }

  // ── Helper coordenadas mouse/touch ────────────────
  private getCoords(e: MouseEvent | TouchEvent): { x: number; y: number } {
    if (e instanceof TouchEvent) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
  }

  // ── Drag ──────────────────────────────────────────
  startDrag(e: MouseEvent | TouchEvent) {
    e.preventDefault();
    const coords = this.getCoords(e);
    this.dragging = true;
    this.offsetX = coords.x - this.win().x;
    this.offsetY = coords.y - this.win().y;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!this.dragging) return;
      const c = this.getCoords(ev);
      this.onMove.emit({
        id: this.win().id,
        x: c.x - this.offsetX,
        y: c.y - this.offsetY,
      });
    };

    const onUp = () => {
      this.dragging = false;
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('touchmove', onMove as any, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }

  // ── Resize ────────────────────────────────────────
  startResize(e: MouseEvent | TouchEvent, dir: ResizeDirection) {
    e.preventDefault();
    e.stopPropagation();
    const coords = this.getCoords(e);
    this.resizing = true;
    this.resizeDir = dir;
    this.startMouseX = coords.x;
    this.startMouseY = coords.y;
    this.startX = this.win().x;
    this.startY = this.win().y;
    this.startWidth = this.win().width;
    this.startHeight = this.win().height;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!this.resizing) return;
      const c = this.getCoords(ev);
      const dx = c.x - this.startMouseX;
      const dy = c.y - this.startMouseY;

      let x = this.startX;
      let y = this.startY;
      let width = this.startWidth;
      let height = this.startHeight;

      if (this.resizeDir!.includes('e')) width = Math.max(this.MIN_WIDTH, this.startWidth + dx);
      if (this.resizeDir!.includes('s')) height = Math.max(this.MIN_HEIGHT, this.startHeight + dy);

      if (this.resizeDir!.includes('w')) {
        const newWidth = Math.max(this.MIN_WIDTH, this.startWidth - dx);
        x = this.startX + (this.startWidth - newWidth);
        width = newWidth;
      }

      if (this.resizeDir!.includes('n')) {
        const newHeight = Math.max(this.MIN_HEIGHT, this.startHeight - dy);
        y = this.startY + (this.startHeight - newHeight);
        height = newHeight;
      }

      this.onResize.emit({ id: this.win().id, x, y, width, height });
    };

    const onUp = () => {
      this.resizing = false;
      this.resizeDir = null;
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('touchmove', onMove as any, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }

  // ── Maximize / Minimize / Focus / Close ──────────
  minimize() {
    this.onMinimize.emit(this.win().id);
  }
  focus() {
    this.onFocus.emit(this.win().id);
  }
  close() {
    this.onClose.emit(this.win().id);
  }

  maximize() {
    if (!this.isMaximized) {
      this.prevX = this.win().x;
      this.prevY = this.win().y;
      this.prevWidth = this.win().width;
      this.prevHeight = this.win().height;
      this.onResize.emit({
        id: this.win().id,
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight - 42,
      });
      this.isMaximized = true;
    } else {
      this.onResize.emit({
        id: this.win().id,
        x: this.prevX,
        y: this.prevY,
        width: this.prevWidth,
        height: this.prevHeight,
      });
      this.isMaximized = false;
    }
  }

  ngOnInit() {}
}
