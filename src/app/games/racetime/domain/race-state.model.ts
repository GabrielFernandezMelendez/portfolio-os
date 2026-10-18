// Game state types covering all phases from menu to race completion.

export type GamePhase =
  | 'menu'
  | 'car-select'
  | 'map-select'
  | 'settings'
  | 'credits'
  | 'countdown'
  | 'racing'
  | 'paused'
  | 'finished';

export interface LapTime {
  readonly lapNumber: number;
  readonly time: number; // milliseconds
}

export interface RaceResult {
  readonly trackId: string;
  readonly carId: string;
  readonly totalTime: number;
  readonly lapTimes: readonly LapTime[];
  readonly bestLapTime: number;
  readonly date: string; // ISO date
}

export interface RaceState {
  gamePhase: GamePhase;
  selectedCarId: string;
  selectedTrackId: string;
  currentLap: number;
  totalLaps: number;
  raceStartTime: number;
  lapStartTime: number;
  currentLapTime: number;
  totalRaceTime: number;
  lapTimes: LapTime[];
  isCountdownActive: boolean;
  countdownValue: number; // 3, 2, 1, 0 (GO)
}

export interface GameSettings {
  musicVolume: number; // 0 to 100
  language: 'es' | 'en';
  isDevMode: boolean;  // all maps unlocked
}