import {
  Component, input, output, OnInit
} from '@angular/core';
import { OsWindow } from '../interfaces/window.interface';

type ResizeDirection =
  | 'n' | 's' | 'e' | 'w'
  | 'ne' | 'nw' | 'se' | 'sw'
  | null;

@Component({
  selector: 'app-window',
  standalone: true,
  templateUrl: './window.html',
  styleUrl:    './window.css'
})
export class WindowComponent implements OnInit {

  win     = input.required<OsWindow>();
  onClose  = output<string>();
  onFocus  = output<string>();
  onMove   = output<{ id: string; x: number; y: number }>();
  onResize = output<{ id: string; x: number; y: number; width: number; height: number }>();
onMinimize = output<string>();

private isMaximized  = false;
private prevX        = 0;
private prevY        = 0;
private prevWidth    = 0;
private prevHeight   = 0;



minimize() {
  this.onMinimize.emit(this.win().id);
}

maximize() {
  if (!this.isMaximized) {
    this.prevX      = this.win().x;
    this.prevY      = this.win().y;
    this.prevWidth  = this.win().width;
    this.prevHeight = this.win().height;
    this.onResize.emit({
      id:     this.win().id,
      x:      0,
      y:      0,
      width:  window.innerWidth,
      height: window.innerHeight - 42
    });
    this.isMaximized = true;
  } else {
    this.onResize.emit({
      id:     this.win().id,
      x:      this.prevX,
      y:      this.prevY,
      width:  this.prevWidth,
      height: this.prevHeight
    });
    this.isMaximized = false;
  }
}
  private dragging:        boolean          = false;
  private resizing:        boolean          = false;
  private resizeDir:       ResizeDirection  = null;
  private startMouseX:     number           = 0;
  private startMouseY:     number           = 0;
  private startX:          number           = 0;
  private startY:          number           = 0;
  private startWidth:      number           = 0;
  private startHeight:     number           = 0;
  private offsetX:         number           = 0;
  private offsetY:         number           = 0;

  readonly MIN_WIDTH  = 280;
  readonly MIN_HEIGHT = 180;

  // ── Drag ──────────────────────────────────────────
  startDrag(e: MouseEvent) {
    e.preventDefault();
    this.dragging = true;
    this.offsetX  = e.clientX - this.win().x;
    this.offsetY  = e.clientY - this.win().y;

    const onMove = (ev: MouseEvent) => {
      if (!this.dragging) return;
      this.onMove.emit({
        id: this.win().id,
        x:  ev.clientX - this.offsetX,
        y:  ev.clientY - this.offsetY
      });
    };

    const onUp = () => {
      this.dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  // ── Resize ────────────────────────────────────────
  startResize(e: MouseEvent, dir: ResizeDirection) {
    e.preventDefault();
    e.stopPropagation();
    this.resizing     = true;
    this.resizeDir    = dir;
    this.startMouseX  = e.clientX;
    this.startMouseY  = e.clientY;
    this.startX       = this.win().x;
    this.startY       = this.win().y;
    this.startWidth   = this.win().width;
    this.startHeight  = this.win().height;

    const onMove = (ev: MouseEvent) => {
      if (!this.resizing) return;
      const dx = ev.clientX - this.startMouseX;
      const dy = ev.clientY - this.startMouseY;

      let x      = this.startX;
      let y      = this.startY;
      let width  = this.startWidth;
      let height = this.startHeight;

      if (this.resizeDir!.includes('e')) width  = Math.max(this.MIN_WIDTH,  this.startWidth  + dx);
      if (this.resizeDir!.includes('s')) height = Math.max(this.MIN_HEIGHT, this.startHeight + dy);

      if (this.resizeDir!.includes('w')) {
        const newWidth = Math.max(this.MIN_WIDTH, this.startWidth - dx);
        x     = this.startX + (this.startWidth - newWidth);
        width = newWidth;
      }

      if (this.resizeDir!.includes('n')) {
        const newHeight = Math.max(this.MIN_HEIGHT, this.startHeight - dy);
        y      = this.startY + (this.startHeight - newHeight);
        height = newHeight;
      }

      this.onResize.emit({ id: this.win().id, x, y, width, height });
    };

    const onUp = () => {
      this.resizing  = false;
      this.resizeDir = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  

  focus() { this.onFocus.emit(this.win().id); }
  close()  { this.onClose.emit(this.win().id); }
  ngOnInit() {}
}