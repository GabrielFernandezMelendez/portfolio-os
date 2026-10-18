import { Container } from 'pixi.js';
import { DUSK_TINT, NIGHT_TINT, SKY } from '../config/palette.config';
import { lightLevel, twilight } from '../application/time/daylight';

const mix = (a: number, b: number, t: number): number => {
  const r = (a >> 16) + ((b >> 16) - (a >> 16)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

/** Aplica la luz del momento del día: color del cielo y tinte del mundo (frío de noche, cálido al amanecer y al atardecer). */
export class DaylightLayer {
  private lastSky = -1;
  private lastTint = -1;

  constructor(
    private readonly setBackground: (color: number) => void,
    private readonly world: Container,
  ) {}

  apply(minuteOfDay: number): void {
    const light = lightLevel(minuteOfDay);
    const warm = twilight(minuteOfDay);

    const sky = mix(mix(SKY.night, SKY.day, light), SKY.dusk, warm * 0.8);
    const tint = mix(mix(NIGHT_TINT, 0xffffff, light), DUSK_TINT, warm * 0.45);

    // Solo se toca Pixi cuando el color cambia de verdad
    if (sky !== this.lastSky) {
      this.setBackground(sky);
      this.lastSky = sky;
    }
    if (tint !== this.lastTint) {
      this.world.tint = tint;
      this.lastTint = tint;
    }
  }
}
