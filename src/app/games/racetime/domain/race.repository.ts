// Port defining persistence operations for race data.
// The infrastructure layer provides the concrete implementation.

import { RaceResult, GameSettings } from './race-state.model';

export interface IRaceRepository {
  saveBestTime(result: RaceResult): void;
  getBestTime(trackId: string): RaceResult | null;
  getAllBestTimes(): RaceResult[];

  saveSettings(settings: GameSettings): void;
  getSettings(): GameSettings;

  saveSelectedCar(carId: string): void;
  getSelectedCar(): string;

  getDailyTrackId(): string; // returns track id based on current date
}