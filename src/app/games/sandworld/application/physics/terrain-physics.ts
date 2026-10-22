import { Material, MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { ChunkCoord } from '../../domain/events/game-events';
import { LANDSLIDE_PASSES_PER_MINUTE, MAX_GROUND } from '../../config/physics.config';
import { World } from '../world/world';
import { TerrainGrid } from './terrain-grid';
import { LandslideSystem } from './landslides';
import { SpringChange, WaterOptions, WaterSystem } from './water';
import { ThermalSystem } from './thermal';
import { ClimateState } from '../climate/climate-state';
import { WinterCold } from '../climate/winter-cold';
import { rootsAt } from '../vegetation/vegetation';
import { FireSystem } from '../fire/fire';
import { FIRE_CHECK_MINUTES } from '../../config/fire.config';
import { SeededRandom } from '../../infrastructure/seeded-random';
import { FREEZE_RATE, FREEZE_TEMPERATURE, SNOW_PER_RAIN, SNOW_TEMPERATURE } from '../../config/climate.config';
import { SOIL_WATER_CAPACITY, WATER_MIN } from '../../config/water.config';
import { temperatureAt, tileIndex } from '../../domain/models/chunk.model';

const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
/** Cada cuántos minutos se mira si se congela el agua */
const FREEZE_CHECK_MINUTES = 10;

/**
 * Física del terreno de la partida. Avanza con el tiempo de juego (se para en pausa
 * y va más rápido a x2/x4 porque recibe más minutos).
 * Bloque 1: desprendimientos. Bloque 2: agua y reglas de material. Bloque 3: vertidos.
 * Bloque 4: frío y calor (nieve, hielo, calor de la Brasa) y manantiales que se tapan.
 */
export class TerrainPhysics {
  readonly grid: TerrainGrid;
  readonly water: WaterSystem;
  readonly thermal: ThermalSystem;
  /** Fuego y Tierra Quemada (arden las plantas; el suelo se chamusca o se calcina) */
  readonly fire: FireSystem;
  /** Estación y hora: desvío global de temperatura (lo actualiza quien lleva el reloj) */
  readonly climate = new ClimateState();
  /** Cuánto frío de invierno le llega a cada tile (por altura y bioma) */
  private readonly winter: WinterCold;
  private minutes = 0;
  private readonly landslides: LandslideSystem;

  constructor(private readonly world: World, private readonly waterOptions?: WaterOptions) {
    this.grid = new TerrainGrid(world);
    this.winter = new WinterCold(world);
    this.fire = new FireSystem(world, new SeededRandom(world.seed * 48271 + 17));
    this.landslides = new LandslideSystem(this.grid);
    const offset = () => this.climate.offset;
    this.water = new WaterSystem(this.grid, waterOptions, offset);
    this.thermal = new ThermalSystem(this.grid, (gx, gy, water) => this.addWater(gx, gy, water), offset);
    // Si cambia la altura de una celda, su agua y la de alrededor vuelven a moverse
    this.grid.onHeightChange = (gx, gy) => this.water.wake(gx, gy);
    // Las raíces de árboles y sauces sujetan el terreno: aguanta pendientes más fuertes
    this.grid.reposeBonus = ref => rootsAt(ref.chunk, ref.k);
    for (const { cx, cy } of world.exploration.list()) {
      this.water.addChunk(world.chunk(cx, cy));
      this.thermal.addChunk(world.chunk(cx, cy));
    }
  }

  /** Un chunk recién descubierto entra en la física */
  chunkRevealed(cx: number, cy: number): void {
    this.water.addChunk(this.world.chunk(cx, cy));
    this.thermal.addChunk(this.world.chunk(cx, cy));
    this.winter.refresh();
  }

  /** Manantiales que se han tapado o abierto desde la última llamada (se vacía al leerla) */
  takeSpringChanges(): SpringChange[] {
    return this.water.springChanges.splice(0);
  }

  /** Celdas que todavía se están asentando (útil para tests y depuración) */
  get settling(): number {
    return this.landslides.activeCount;
  }

  /** Un minuto de juego. Devuelve los chunks que han cambiado (para volver a hornearlos). */
  minute(): ChunkCoord[] {
    const changed = new Set<string>();
    for (let i = 0; i < LANDSLIDE_PASSES_PER_MINUTE; i++) this.landslides.step(changed);
    this.minutes++;
    if (this.minutes % 60 === 0) this.winter.refresh();
    this.thermal.minute(changed);
    this.water.minute(changed);
    if (this.minutes % FIRE_CHECK_MINUTES === 0) this.fire.update(FIRE_CHECK_MINUTES, changed);
    if (this.waterOptions?.freezing !== false && this.minutes % FREEZE_CHECK_MINUTES === 0) this.freezeStillWater(changed);
    // Material cambiado por una regla (p. ej. barro, de talud bajo): puede volver a deslizarse
    for (const [gx, gy] of this.water.transformed.splice(0)) {
      this.landslides.wake(gx, gy);
      changed.add(`${Math.floor(gx / WORLD.CELLS)},${Math.floor(gy / WORLD.CELLS)}`);
    }
    return [...changed].map(k => {
      const [cx, cy] = k.split(',').map(Number);
      return { cx, cy };
    });
  }

  /**
   * Añade `amount` niveles de material en la celda global (gx, gy) y despierta los desprendimientos.
   * Devuelve lo que se ha depositado de verdad (el terreno tiene un techo de altura).
   */
  deposit(gx: number, gy: number, material: MaterialId, amount: number, relabel = true): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell || amount <= 0) return 0;
    const room = Math.max(0, MAX_GROUND - this.grid.ground(cell));
    const added = Math.min(room, amount);
    this.grid.setSediment(cell, cell.chunk.sediment[cell.k] + added);
    // relabel = false: el material se suma pero el suelo aún no cambia de color (arenas a medio asentar)
    if (relabel) cell.chunk.material[cell.k] = material;
    this.landslides.wake(gx, gy);
    return added;
  }

  /** Añade agua en la celda global (gx, gy) (o la quita, con cantidad negativa) */
  addWater(gx: number, gy: number, amount: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    cell.chunk.water[cell.k] = Math.max(0, cell.chunk.water[cell.k] + amount);
    this.water.wake(gx, gy);
  }

  /**
   * Pone (o quita, con rate 0) un manantial en la celda global (gx, gy).
   * Un manantial nuevo recuerda la altura del terreno: si se entierra por encima, deja de manar.
   */
  setSpring(gx: number, gy: number, rate: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    if (cell.chunk.spring[cell.k] <= 0) cell.chunk.springBase[cell.k] = this.grid.ground(cell) - cell.chunk.cover[cell.k];
    cell.chunk.spring[cell.k] = Math.max(0, rate);
    this.water.wake(gx, gy);
  }

  /**
   * Marea: quita hasta `amount` niveles de capa helada y luego de sedimento; lo que sobre excava roca
   * a `rockRate` por nivel sobrante (más lenta), sin bajar nunca de `rockFloor`. Devuelve lo que se ha quitado.
   */
  dig(gx: number, gy: number, amount: number, rockRate = 0, rockFloor = 0): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell || amount <= 0) return 0;
    const fromCover = Math.min(cell.chunk.cover[cell.k], amount);
    if (fromCover > 0) this.grid.setCover(cell, cell.chunk.cover[cell.k] - fromCover);
    const removed = Math.min(cell.chunk.sediment[cell.k], amount - fromCover);
    if (removed > 0) this.grid.setSediment(cell, cell.chunk.sediment[cell.k] - removed);
    // Con la tierra ya quitada, la roca cede más despacio (así se abren canales entre lagos)
    const left = amount - fromCover - removed;
    let carved = 0;
    if (left > 0 && rockRate > 0) {
      carved = Math.min(left * rockRate, Math.max(0, cell.chunk.rock[cell.k] - rockFloor));
      if (carved > 0) this.grid.setRock(cell, cell.chunk.rock[cell.k] - carved);
    }
    this.landslides.wake(gx, gy);
    // Excavar alrededor también hace que se deslice lo de las vecinas hacia el hoyo
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.landslides.wake(gx + dx, gy + dy);
    return fromCover + removed + carved;
  }

  /** Escarcha: nieve encima y el agua de la celda (hasta `freeze` niveles) se congela en hielo */
  freeze(gx: number, gy: number, snow: number, freeze: number): void {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return;
    const frozen = Math.min(cell.chunk.water[cell.k], freeze);
    if (frozen > 0) {
      cell.chunk.water[cell.k] -= frozen;
      this.thermal.addCover(gx, gy, Material.ICE, frozen);
    }
    if (snow > 0) this.thermal.addCover(gx, gy, Material.SNOW, snow);
  }

  /**
   * Brasa: evapora el agua, seca el suelo (y el barro), funde lo helado, acumula calor y chamusca el suelo
   * (motas de ceniza, hasta `scorchMax`). Devuelve el calor acumulado en la celda (con mucho, prende la vegetación).
   */
  scorch(gx: number, gy: number, opts: { evaporate: number; dry: number; melt: number; heat: number; scorch: number; scorchMax: number }): number {
    const cell = this.grid.cell(gx, gy);
    if (!cell) return 0;
    const c = cell.chunk, k = cell.k;
    c.water[k] = Math.max(0, c.water[k] - opts.evaporate);
    c.moisture[k] = Math.max(0, c.moisture[k] - opts.dry);
    if (c.material[k] === Material.MUD && c.moisture[k] < 0.3) c.material[k] = Material.SOIL;
    // Lo que se funde se evapora con el calor (no se suma agua)
    const melted = Math.min(c.cover[k], opts.melt);
    if (melted > 0) this.grid.setCover(cell, c.cover[k] - melted);
    c.scorch[k] = Math.max(c.scorch[k], Math.min(opts.scorchMax, c.scorch[k] + opts.scorch));
    return this.thermal.addHeat(gx, gy, opts.heat);
  }

  /**
   * Lluvia o nieve sobre todo lo descubierto: `amount` niveles de agua por celda en este minuto.
   * Donde hace frío cae nieve (de temporada). La lluvia empapa primero el suelo y lo que sobra queda encima y corre.
   * Devuelve true si en la mayor parte de la isla ha caído nieve (para dibujar copos en vez de gotas).
   */
  precipitate(amount: number): boolean {
    let snowed = 0, rained = 0;
    for (const { cx, cy } of this.world.exploration.list()) {
      const c = this.world.chunk(cx, cy);
      for (let k = 0; k < C * C; k++) {
        const ci = k % C, cj = Math.floor(k / C);
        const gx = cx * C + ci, gy = cy * C + cj;
        const t = tileIndex(Math.floor(ci / G), Math.floor(cj / G));
        if (temperatureAt(c, t) + this.winter.offsetAt(c, t, this.climate) < SNOW_TEMPERATURE) {
          this.thermal.addCover(gx, gy, Material.SNOW, amount * SNOW_PER_RAIN, true);
          snowed++;
          continue;
        }
        rained++;
        let rain = amount;
        if (c.moisture[k] < 1) {
          const soak = Math.min(rain, (1 - c.moisture[k]) * SOIL_WATER_CAPACITY);
          c.moisture[k] += soak / SOIL_WATER_CAPACITY;
          rain -= soak;
        }
        if (rain > 0) {
          c.water[k] += rain;
          if (c.water[k] > WATER_MIN) this.water.wake(gx, gy);
        }
      }
    }
    return snowed > rained;
  }

  /** Tormenta eléctrica: lo resuelve el fuego (dónde cae el rayo y si prende) */
  strike(chance: number): void {
    this.fire.strike(chance);
  }

  /** Invierno: el agua de las celdas frías se va congelando (hielo de temporada, se funde al subir la temperatura) */
  private freezeStillWater(changed: Set<string>): void {
    const offset = this.climate.offset;
    if (offset > FREEZE_TEMPERATURE) return;   // con este desvío ningún tile llega a helar
    for (const key of this.water.wetKeys) {
      const [gx, gy] = TerrainGrid.fromKey(key);
      const cell = this.grid.cell(gx, gy);
      if (!cell) continue;
      const c = cell.chunk, k = cell.k;
      if (c.water[k] <= WATER_MIN) continue;
      const t = tileIndex(Math.floor((gx - c.cx * C) / G), Math.floor((gy - c.cy * C) / G));
      const cold = FREEZE_TEMPERATURE - (temperatureAt(c, t) + this.winter.offsetAt(c, t, this.climate));
      if (cold <= 0) continue;
      const ice = Math.min(c.water[k], FREEZE_RATE * FREEZE_CHECK_MINUTES * cold);
      c.water[k] -= ice;
      this.thermal.addCover(gx, gy, Material.ICE, ice, true);
      changed.add(`${c.cx},${c.cy}`);
    }
  }

  /** Coordenadas globales de celda a partir de chunk + celda local */
  static global(cx: number, cy: number, ci: number, cj: number): [number, number] {
    return [cx * WORLD.CELLS + ci, cy * WORLD.CELLS + cj];
  }
}
