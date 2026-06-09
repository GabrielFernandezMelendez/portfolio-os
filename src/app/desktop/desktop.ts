import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { OsWindow } from '../interfaces/window.interface';
import { WindowComponent } from '../window/window';
import { DesktopIconComponent } from '../desktop-icon/desktop-icon';
import { TaskbarComponent } from '../taskbar/taskbar';
import { GithubComponent } from '../apps/github/github';
import { AboutComponent } from '../apps/about/about';
import { SkillsComponent } from '../apps/skills/skills';
@Component({
  selector: 'app-desktop',
  standalone: true,
  templateUrl: './desktop.html',
  styleUrl: './desktop.css',
  imports: [WindowComponent,DesktopIconComponent,TaskbarComponent,GithubComponent,AboutComponent,SkillsComponent],

})
export class DesktopComponent implements OnInit, OnDestroy {

windows = signal<OsWindow[]>([
  { id: 'about',      title: 'Sobre mí',    icon: '👤', filename: 'aboutme.txt',    isOpen: false, isMinimized: false, x: 100, y: 80,  zIndex: 1, width: 520, height: 420, onDesktop: true, desktopX: 20, desktopY: 160  },
  { id: 'experience', title: 'Experiencia', icon: '💼', filename: 'experience.exe', isOpen: false, isMinimized: false, x: 150, y: 100, zIndex: 1, width: 580, height: 460, onDesktop: true, desktopX: 20, desktopY: 250  },
  { id: 'skills',     title: 'Habilidades', icon: '🛠', filename: 'skills.ini',     isOpen: false, isMinimized: false, x: 200, y: 90,  zIndex: 1, width: 520, height: 480, onDesktop: true, desktopX: 20, desktopY: 340  },
  { id: 'education',  title: 'Formación',   icon: '🎓', filename: 'education.log',  isOpen: false, isMinimized: false, x: 120, y: 110, zIndex: 1, width: 500, height: 420, onDesktop: true, desktopX: 20, desktopY: 430  },
  { id: 'projects',   title: 'Proyectos',   icon: '📁', filename: 'projects.exe',   isOpen: false, isMinimized: false, x: 180, y: 95,  zIndex: 1, width: 620, height: 500, onDesktop: true, desktopX: 20, desktopY: 520  },
  { id: 'contact',    title: 'Contacto',    icon: '📬', filename: 'contact.bat',    isOpen: false, isMinimized: false, x: 160, y: 120, zIndex: 1, width: 460, height: 380, onDesktop: true, desktopX: 20, desktopY: 610  },
  { id: 'github',     title: 'GitHub',      icon: '🐙', filename: 'github.url',     isOpen: false, isMinimized: false, x: 140, y: 85,  zIndex: 1, width: 900, height: 600, onDesktop: true, desktopX: 20, desktopY: 700  },
]);

  topZIndex  = 10;
  isDark     = signal(true);

  private canvas!: HTMLCanvasElement;
  private ctx!:    CanvasRenderingContext2D;
  private grid:    boolean[][] = [];
  private interval: any;

  readonly CELL_SIZE  = 14;
  readonly INTERVAL_MS = 1500;

  // ── Colores por tema ──────────────────────────────
  get cellColor()   { return this.isDark() ? '#6366f1' : '#3730a3'; }
  get bgColor()     { return this.isDark() ? '#06060f' : '#f0f0f8'; }
  get gridColor()   { return this.isDark() ? 'rgba(99,102,241,0.06)' : 'rgba(55,48,163,0.08)'; }

  // ── Ciclo de vida Angular ─────────────────────────
  ngOnInit() {
    this.initGame();
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }

  // ── Gestión de ventanas ───────────────────────────
  openWindow(id: string) {
    this.topZIndex++;
    this.windows.update(wins => wins.map(w =>
      w.id === id ? { ...w, isOpen: true, isMinimized: false, zIndex: this.topZIndex } : w
    ));
  }

  closeWindow(id: string) {
    this.windows.update(wins => wins.map(w =>
      w.id === id ? { ...w, isOpen: false } : w
    ));
  }

  focusWindow(id: string) {
    this.topZIndex++;
    this.windows.update(wins => wins.map(w =>
      w.id === id ? { ...w, zIndex: this.topZIndex } : w
    ));
  }

  moveWindow(id: string, x: number, y: number) {
    this.windows.update(wins => wins.map(w =>
      w.id === id ? { ...w, x, y } : w
    ));
  }

  toggleTheme() {
    this.isDark.update(v => !v);
    this.drawGrid();
  }

  // ── Game of Life ──────────────────────────────────
  initGame() {
    this.canvas     = document.getElementById('gol-canvas') as HTMLCanvasElement;
    this.ctx        = this.canvas.getContext('2d')!;
    this.resizeCanvas();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.seedGrid();
      this.drawGrid();
    });

    this.canvas.addEventListener('click', (e: MouseEvent) => {
      if (e.target !== this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const col  = Math.floor((e.clientX - rect.left)  / this.CELL_SIZE);
      const row  = Math.floor((e.clientY - rect.top)   / this.CELL_SIZE);
      if (row >= 0 && row < this.grid.length && col >= 0 && col < this.grid[0].length) {
        this.grid[row][col] = !this.grid[row][col];
        this.drawGrid();
      }
    });

    this.seedGrid();
    this.drawGrid();
    this.interval = setInterval(() => {
      this.step();
      this.drawGrid();
    }, this.INTERVAL_MS);
  }

  resizeCanvas() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ── Patrones iniciales ────────────────────────────
  seedGrid() {
    const rows = Math.ceil(this.canvas.height / this.CELL_SIZE);
    const cols = Math.ceil(this.canvas.width  / this.CELL_SIZE);

    // Grid vacío
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(false));

    // GLIDER — esquina superior izquierda
    this.placeGlider(2, 2);

    // PULSAR — centro de la pantalla
    const centerRow = Math.floor(rows / 2) - 6;
    const centerCol = Math.floor(cols / 2) - 6;
    this.placePulsar(centerRow, centerCol);
  }

  placeGlider(row: number, col: number) {
    // Patrón clásico del Glider
    const pattern = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 1],
    ];
    this.placePattern(pattern, row, col);
  }

  placePulsar(row: number, col: number) {
    // Patrón del Pulsar (período 3)
    const pattern = [
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [1,0,0,0,0,1,0,1,0,0,0,0,1],
      [0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,1,1,1,0,0,0,1,1,1,0,0],
    ];
    this.placePattern(pattern, row, col);
  }

  placePattern(pattern: number[][], startRow: number, startCol: number) {
    const rows = this.grid.length;
    const cols = this.grid[0].length;
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        const tr = startRow + r;
        const tc = startCol + c;
        if (tr >= 0 && tr < rows && tc >= 0 && tc < cols) {
          this.grid[tr][tc] = pattern[r][c] === 1;
        }
      }
    }
  }

  // ── Siguiente generación ──────────────────────────
  step() {
    const rows    = this.grid.length;
    const cols    = this.grid[0].length;
    const next    = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const neighbors = this.countNeighbors(r, c);
        const alive     = this.grid[r][c];
        next[r][c] = alive
          ? neighbors === 2 || neighbors === 3
          : neighbors === 3;
      }
    }
    this.grid = next;
  }

  countNeighbors(row: number, col: number): number {
    const rows = this.grid.length;
    const cols = this.grid[0].length;
    let count  = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = (row + dr + rows) % rows;
        const nc = (col + dc + cols) % cols;
        if (this.grid[nr][nc]) count++;
      }
    }
    return count;
  }

  // ── Render ────────────────────────────────────────
  drawGrid() {
    const rows = this.grid.length;
    const cols = this.grid[0].length;
    const S    = this.CELL_SIZE;

    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

// Líneas del grid con color de células
const gridAlpha = this.isDark() ? 'rgba(99,102,241,0.5)' : 'rgba(55,48,163,0.35)';this.ctx.strokeStyle = gridAlpha;
this.ctx.lineWidth   = 0.5;
for (let r = 0; r <= rows; r++) {
  this.ctx.beginPath();
  this.ctx.moveTo(0, r * S);
  this.ctx.lineTo(this.canvas.width, r * S);
  this.ctx.stroke();
}
for (let c = 0; c <= cols; c++) {
  this.ctx.beginPath();
  this.ctx.moveTo(c * S, 0);
  this.ctx.lineTo(c * S, this.canvas.height);
  this.ctx.stroke();
}
    // Células vivas
    this.ctx.fillStyle = this.cellColor;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.grid[r][c]) {
          this.ctx.fillRect(c * S + 1, r * S + 1, S - 2, S - 2);
        }
      }
    }
  }

  resizeWindow(event: { id: string; x: number; y: number; width: number; height: number }) {
  this.windows.update(wins => wins.map(w =>
    w.id === event.id
      ? { ...w, x: event.x, y: event.y, width: event.width, height: event.height }
      : w
  ));
}

// Mover icono del escritorio
moveDesktopIcon(id: string, x: number, y: number) {
  this.windows.update(wins => wins.map(w =>
    w.id === id ? { ...w, desktopX: x, desktopY: y } : w
  ));
}

// Eliminar del escritorio (arrastrar a papelera)
removeFromDesktop(id: string) {
  this.windows.update(wins => wins.map(w =>
    w.id === id ? { ...w, onDesktop: false } : w
  ));
}

// Estado del Game of Life
golRunning = signal(true);


toggleGol() {
  this.golRunning.update(v => !v);
  this.restartInterval();
}

minimizeWindow(id: string) {
  this.windows.update(wins => wins.map(w =>
    w.id === id ? { ...w, isMinimized: true } : w
  ));
}



golSpeed = signal<number>(1);

private getIntervalMs(): number {
  if (this.golSpeed() === 2) return 1000;
  if (this.golSpeed() === 3) return 500;
  return 3000;
}

private restartInterval() {
  clearInterval(this.interval);
  this.interval = null;
  if (this.golRunning()) {
    this.interval = setInterval(() => {
      this.step();
      this.drawGrid();
    }, this.getIntervalMs());
  }
}

setGolSpeed(speed: number) {
  this.golSpeed.set(speed);
  this.restartInterval();
}
}