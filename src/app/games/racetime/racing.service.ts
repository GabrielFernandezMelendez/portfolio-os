import { Injectable, signal } from '@angular/core';
import { CarState, CarPhysicsConfig } from './domain/car.model';
import { GamePhase, RaceState, GameSettings } from './domain/race-state.model';
import { TrackConfig } from './domain/track.model';
import { CARS_CONFIG } from './config/cars.config';
import { TRACKS_CONFIG } from './config/tracks.config';
import { createInitialCarState, DEFAULT_PHYSICS } from './application/race-physics.service';

// Game state management — owns all signals, no DOM dependency.

@Injectable({ providedIn: 'root' })
export class RacingService {

  readonly gamePhase = signal<GamePhase>('racing');
  readonly carState = signal<CarState>(createInitialCarState());
  readonly selectedCarId = signal<string>('fury');
  readonly selectedTrackId = signal<string>('silverstone');
  readonly raceTime = signal<number>(0);
  readonly lapTime = signal<number>(0);
  readonly currentLap = signal<number>(0);
  readonly totalLaps = signal<number>(5);
  readonly isPaused = signal<boolean>(false);

  readonly settings = signal<GameSettings>({
    musicVolume: 70,
    language: 'es',
    isDevMode: true,
  });

  getSelectedCar() {
    return CARS_CONFIG.find(c => c.id === this.selectedCarId()) || CARS_CONFIG[0];
  }

  getSelectedTrack(): TrackConfig {
    return TRACKS_CONFIG.find(t => t.id === this.selectedTrackId()) || TRACKS_CONFIG[0];
  }

  getPhysicsConfig(): CarPhysicsConfig {
    return DEFAULT_PHYSICS;
  }

  startRace(): void {
    this.carState.set(createInitialCarState());
    this.raceTime.set(0);
    this.lapTime.set(0);
    this.currentLap.set(0);
    this.totalLaps.set(this.getSelectedTrack().totalLaps);
    this.gamePhase.set('racing');
    this.isPaused.set(false);
  }

  pause(): void {
    this.isPaused.set(true);
    this.gamePhase.set('paused');
  }

  resume(): void {
    this.isPaused.set(false);
    this.gamePhase.set('racing');
  }

  goToMenu(): void {
    this.gamePhase.set('menu');
  }

  updateTimers(dt: number, lapCount: number, totalTrackLength: number, distance: number): void {
    this.raceTime.update(t => t + dt);

    if (lapCount > this.currentLap()) {
      this.currentLap.set(lapCount);
      this.lapTime.set(0);
    } else {
      this.lapTime.update(t => t + dt);
    }

    // Check if race is finished
    if (lapCount >= this.totalLaps()) {
      this.gamePhase.set('finished');
    }
  }
}