import { Component, ElementRef, ViewChild, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RacingService } from '../racing.service';
import { TrackGenerator } from '../application/track-generator';
import { CarRenderer } from '../application/car-renderer';
import { renderTrack } from '../application/track-renderer';
import { updatePhysics } from '../application/race-physics.service';

@Component({
  selector: 'app-racing',
  standalone: true,
  templateUrl: './racing.html',
  styleUrl: './racing.css',
})
export class RacingComponent implements OnInit, OnDestroy {

  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private game = inject(RacingService);
  private track!: TrackGenerator;
  private carRenderer = new CarRenderer();
  private ctx!: CanvasRenderingContext2D;
  private animFrameId = 0;
  private lastTime: number | null = null;

  // Input state — touch/mouse only accelerates, keyboard steers (desktop)
  private isAccelerating = false;
  private steerInput = 0;
  private keys: Record<string, boolean> = {};
  private mouseDown = false;

  // Camera
private readonly CAMERA_ZOOM = 0.8;
private readonly BASE_WIDTH = 5000;
private readonly BASE_HEIGHT = 3500;

  // HUD signals
  raceTime = this.game.raceTime;
  lapTime = this.game.lapTime;
  currentLap = this.game.currentLap;
  totalLaps = this.game.totalLaps;
  speed = signal(0);
  isPaused = this.game.isPaused;

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);

    const trackConfig = this.game.getSelectedTrack();
    this.track = new TrackGenerator(trackConfig);
    this.game.startRace();

    this.setupInputListeners();

    this.lastTime = null;
    this.animFrameId = requestAnimationFrame(this.gameLoop);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    this.removeInputListeners();
  }

  // ── Game loop ──

  private gameLoop = (timestamp: number): void => {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt <= 0) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = timestamp;

    if (!this.game.isPaused() && this.game.gamePhase() === 'racing') {
      this.update(dt);
    }

    this.render(dt);
    this.animFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(dt: number): void {
    let car = this.game.carState();
    car = { ...car, isAccelerating: this.isAccelerating, steerInput: this.steerInput };

    const newCar = updatePhysics(car, this.track, dt, this.game.getPhysicsConfig());
    this.game.carState.set(newCar);
    this.speed.set(Math.round(newCar.speed));

    this.game.updateTimers(dt, newCar.lapCount, this.track.getTotalLength(), newCar.distance);
  }

  private render(dt: number): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef.nativeElement;
    const car = this.game.carState();
    const carPos = this.track.getRailPosition(car.distance, car.railPosition);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#2d5a1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Camera follows the car — car stays centered on screen
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.translate(centerX, centerY);
    ctx.scale(this.CAMERA_ZOOM, this.CAMERA_ZOOM);
    ctx.translate(-carPos.x, -carPos.y);

    // Draw track
    renderTrack(ctx, this.track, this.BASE_WIDTH, this.BASE_HEIGHT);

    // Draw car
    const carConfig = this.game.getSelectedCar();
    this.carRenderer.render(ctx, car, carConfig, this.track, dt);

    ctx.restore();
  }

  // ── Canvas sizing ──

  private onResize = (): void => { this.resizeCanvas(); };

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  // ── Input ──

  private setupInputListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const canvas = this.canvasRef.nativeElement;
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseUp);
  }

  private removeInputListeners(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    const canvas = this.canvasRef.nativeElement;
    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove', this.onTouchMove);
    canvas.removeEventListener('touchend', this.onTouchEnd);
    canvas.removeEventListener('touchcancel', this.onTouchEnd);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('mouseleave', this.onMouseUp);
  }

  // Keyboard — steering only works here (desktop testing)
  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys[key] = true;

    if (['arrowup', 'w', ' '].includes(key)) {
      e.preventDefault();
      this.isAccelerating = true;
    }
    if (['arrowleft', 'a'].includes(key)) { e.preventDefault(); this.steerInput = -1; }
    if (['arrowright', 'd'].includes(key)) { e.preventDefault(); this.steerInput = 1; }
    if (key === 'escape' || key === 'p') this.togglePause();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys[key] = false;

    if (['arrowup', 'w', ' '].includes(key)) this.isAccelerating = false;
    if (['arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
      if (!this.keys['arrowleft'] && !this.keys['a'] &&
          !this.keys['arrowright'] && !this.keys['d']) {
        this.steerInput = 0;
      }
    }
  };

  // Touch — only accelerates, no steering
  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.isAccelerating = true;
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
  };

  private onTouchEnd = (): void => {
    this.isAccelerating = false;
  };

  // Mouse — only accelerates, no steering
  private onMouseDown = (): void => {
    this.mouseDown = true;
    this.isAccelerating = true;
  };

  private onMouseUp = (): void => {
    this.mouseDown = false;
    this.isAccelerating = false;
  };

  // ── Pause ──

  togglePause(): void {
    if (this.game.isPaused()) this.game.resume();
    else this.game.pause();
  }

  goToMenu(): void { this.game.goToMenu(); }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
  }
}