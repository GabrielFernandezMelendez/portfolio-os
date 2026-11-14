import { Container } from 'pixi.js';
import { DUSK_TINT, NIGHT_TINT, SEASON_TINT, SKY, STORM_GREY } from '../config/palette.config';
import { lightLevel, twilight } from '../application/time/daylight';

const mix = (a: number, b: number, t: number): number => {
  const r = (a >> 16) + ((b >> 16) - (a >> 16)) * t;
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

const multiply = (a: number, b: number): number =>
  (Math.round(((a >> 16) * (b >> 16)) / 255) << 16) |
  (Math.round((((a >> 8) & 255) * ((b >> 8) & 255)) / 255) << 8) |
  Math.round(((a & 255) * (b & 255)) / 255);

/** Estación de la que viene el clima, a la que va y cuánto lleva de transición (0..1) */
export interface SeasonBlend {
  readonly from: number;
  readonly to: number;
  readonly t: number;
}

/**
 * Aplica la luz del momento: color del cielo y tinte del mundo (frío de noche, cálido al amanecer y al atardecer),
 * el tono de la estación (con transición suave) y lo gris que está el día si llueve.
 */
export class DaylightLayer {
  private lastSky = -1;
  private lastTint = -1;

  constructor(
    private readonly setBackground: (color: number) => void,
    private readonly world: Container,
  ) {}

  apply(minuteOfDay: number, season: SeasonBlend = { from: 0, to: 0, t: 0 }, gloom = 0): void {
    const light = lightLevel(minuteOfDay);
    const warm = twilight(minuteOfDay);

    const seasonTint = mix(SEASON_TINT[season.from], SEASON_TINT[season.to], season.t);
    const daySky = mix(SKY.day, STORM_GREY, gloom);
    const sky = mix(mix(SKY.night, daySky, light), SKY.dusk, warm * 0.8 * (1 - gloom));
    const light2 = mix(mix(NIGHT_TINT, 0xffffff, light), DUSK_TINT, warm * 0.45);
    // El tono de la estación y lo gris de la lluvia se multiplican con la luz del día
    const tint = multiply(multiply(light2, seasonTint), mix(0xffffff, 0xb4bcc8, gloom));

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
