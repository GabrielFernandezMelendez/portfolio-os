import { Component, input, OnInit, OnDestroy, ElementRef, ViewChild, effect } from '@angular/core';

@Component({
  selector:    'app-mobile-background',
  standalone:  true,
  template:    '<canvas #canvas class="pixel-canvas"></canvas>',
  styles: [`
    .pixel-canvas {
      position: absolute;
      inset:    0;
      z-index:  0;
    }
  `]
})
export class MobileBackgroundComponent implements OnInit, OnDestroy {

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  isDark = input<boolean>(true);
  paused = input<boolean>(false);

  readonly CELL      = 18;
  readonly COLORS    = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];
  readonly TRAIL_LEN = 12;
  readonly SPEED     = 0.1;

  private ctx!:        CanvasRenderingContext2D;
  private cols         = 0;
  private rows         = 0;
  private drops:       number[]  = [];
  private dropColors:  string[]  = [];
  private animFrameId: number    = 0;

  constructor() {
    effect(() => {
      this.isDark();
      if (this.ctx) this.draw();
    });
  }

  ngOnInit() {
    const canvas  = this.canvasRef.nativeElement;
    this.ctx      = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', () => this.resize());
  }

  resize() {
    const canvas   = this.canvasRef.nativeElement;
    canvas.width   = window.innerWidth;
    canvas.height  = window.innerHeight;
    this.cols      = Math.ceil(canvas.width  / this.CELL);
    this.rows      = Math.ceil(canvas.height / this.CELL);
    this.drops     = Array.from({ length: this.cols }, () => Math.random() * -this.rows);
    this.dropColors= Array.from({ length: this.cols }, () => this.randomColor());
  }

  animate() {
    if (!this.paused()) {
      this.draw();
      this.drops = this.drops.map((d, i) => {
        const next = d + this.SPEED;
        if (next > this.rows + this.TRAIL_LEN) {
          this.dropColors[i] = this.randomColor();
          return Math.random() * -this.rows;
        }
        return next;
      });
    }
    this.animFrameId = requestAnimationFrame(() => this.animate());
  }

  draw() {
    const canvas = this.canvasRef.nativeElement;
    const bg     = this.isDark() ? '#06060f' : '#f0f0f8';
    const grid   = this.isDark() ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)';
    const S      = this.CELL;

    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.ctx.strokeStyle = grid;
    this.ctx.lineWidth   = 0.5;
    for (let r = 0; r <= this.rows; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0,            r * S);
      this.ctx.lineTo(canvas.width, r * S);
      this.ctx.stroke();
    }
    for (let c = 0; c <= this.cols; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * S, 0);
      this.ctx.lineTo(c * S, canvas.height);
      this.ctx.stroke();
    }

    for (let c = 0; c < this.cols; c++) {
      const head  = Math.floor(this.drops[c]);
      const color = this.dropColors[c];
      for (let t = 0; t < this.TRAIL_LEN; t++) {
        const row = head - t;
        if (row < 0 || row >= this.rows) continue;
        const opacity = (1 - t / this.TRAIL_LEN) * (t === 0 ? 1 : 0.75);
        this.ctx.fillStyle = this.hexToRgba(color, opacity);
        this.ctx.fillRect(c * S + 1, row * S + 1, S - 2, S - 2);
      }
    }
  }

  randomColor(): string {
    return this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
  }

  hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
}