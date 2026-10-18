import { TrackConfig } from '../domain/track.model';

export const TRACKS_CONFIG: readonly TrackConfig[] = [
{
    id: 'silverstone',
    name: 'Silverstone',
    totalLaps: 3,
    railSpacing: 28,
    wallMargin: 40,
    waypoints: [
      // Start/finish straight
      { x: 800, y: 500, radius: 0 },
      { x: 1600, y: 500, radius: 0 },
      // Sweeping right curve
      { x: 2100, y: 550, radius: 400 },
      { x: 2400, y: 700, radius: 350 },
      // Short straight
      { x: 2500, y: 1000, radius: 0 },
      // Tight hairpin
      { x: 2600, y: 1300, radius: 200 },
      { x: 2400, y: 1500, radius: 200 },
      // Long back straight
      { x: 2000, y: 1600, radius: 0 },
      { x: 1400, y: 1650, radius: 0 },
      // Chicane (S-curve)
      { x: 1100, y: 1550, radius: 250 },
      { x: 900, y: 1650, radius: 250 },
      { x: 700, y: 1550, radius: 250 },
      // Medium curve
      { x: 500, y: 1400, radius: 300 },
      { x: 400, y: 1200, radius: 350 },
      // Another straight
      { x: 350, y: 1000, radius: 0 },
      // Sweeping left
      { x: 300, y: 800, radius: 400 },
      { x: 350, y: 650, radius: 350 },
      // Final curve back to start
      { x: 500, y: 550, radius: 300 },
      { x: 800, y: 500, radius: 0 },
    ],
  },
  {
    id: 'monza',
    name: 'Monza',
    totalLaps: 5,
    railSpacing: 28,
    wallMargin: 40,
    waypoints: [
      { x: 200, y: 150, radius: 0 },
      { x: 800, y: 150, radius: 0 },
      { x: 1000, y: 250, radius: 140 },
      { x: 950, y: 400, radius: 130 },
      { x: 750, y: 450, radius: 0 },
      { x: 550, y: 420, radius: 110 },
      { x: 400, y: 500, radius: 100 },
      { x: 250, y: 580, radius: 130 },
      { x: 100, y: 480, radius: 140 },
      { x: 80, y: 300, radius: 150 },
      { x: 200, y: 150, radius: 0 },
    ],
  },
  {
    id: 'suzuka',
    name: 'Suzuka',
    totalLaps: 4,
    railSpacing: 28,
    wallMargin: 40,
    waypoints: [
      { x: 300, y: 200, radius: 0 },
      { x: 600, y: 150, radius: 0 },
      { x: 850, y: 180, radius: 130 },
      { x: 950, y: 300, radius: 120 },
      { x: 880, y: 450, radius: 110 },
      { x: 700, y: 500, radius: 0 },
      { x: 500, y: 480, radius: 100 },
      { x: 350, y: 530, radius: 110 },
      { x: 200, y: 500, radius: 120 },
      { x: 100, y: 400, radius: 140 },
      { x: 120, y: 280, radius: 130 },
      { x: 300, y: 200, radius: 0 },
    ],
  },
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `track-${i + 4}`,
    name: `Circuit ${i + 4}`,
    totalLaps: 5,
    railSpacing: 28,
    wallMargin: 40,
    waypoints: [
      { x: 250, y: 150, radius: 0 },
      { x: 700, y: 150, radius: 0 },
      { x: 900, y: 250 + i * 15, radius: 120 + i * 5 },
      { x: 850, y: 500, radius: 130 },
      { x: 550, y: 580, radius: 110 + i * 3 },
      { x: 250, y: 550, radius: 120 },
      { x: 100, y: 400, radius: 140 },
      { x: 100, y: 250, radius: 130 },
      { x: 250, y: 150, radius: 0 },
    ],
  })),
];