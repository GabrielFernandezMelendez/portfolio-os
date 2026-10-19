import { Container, Sprite, Texture } from 'pixi.js';
import { ChunkData, cellIndex, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { BURNING_BAND, frontOrder } from '../../application/fire/fire';
import { FLAME_FRAMES, flameTexture } from './fire-sprites';

type CellTop = (ci: number, cj: number) => { x: number; y: number };

const N = WORLD.TILES;
const G = WORLD.CELLS_PER_TILE;
/** Cada cuánto se vuelve a mirar dónde hay fuego (ms reales) y cada cuánto parpadean las llamas */
const SCAN_MS = 250;
const FLICKER_MS = 110;
const SMOKE = [0x6a6a70, 0x8a8a90, 0xa8a8ae];
const EMBER = [0xc83a1a, 0xf08a24, 0xffd04a];

interface Flame { readonly sprite: Sprite; readonly w: number; readonly h: number; frame: number }
interface Puff { readonly sprite: Sprite; vx: number; vy: number; life: number; readonly max: number }
interface Ember { readonly sprite: Sprite; readonly phase: number }

/**
 * Fuego de un chunk, en el mismo contenedor que sus plantas (para que se ordene con ellas por profundidad):
 * - llamas de suelo en el frente que avanza por cada tile que arde (salen de la tierra, no solo de los árboles)
 * - humo que sube de lo que arde y, más suave, de la Tierra Quemada
 * - brasas que laten en las grietas de la Tierra Quemada
 */
export class FireLayer {
  private flames: Flame[] = [];
  private embers: Ember[] = [];
  private readonly puffs: Puff[] = [];
  private scan = 0;
  private flicker = 0;
  private clock = 0;
  /** Puntos de donde sale humo (y cuánto) */
  private smokeFrom: { x: number; y: number; rate: number }[] = [];

  constructor(private readonly view: Container) {}

  /** Vuelve a mirar el chunk (terreno cambiado): brasas de la Tierra Quemada */
  layout(chunk: ChunkData, cellTop: CellTop): void {
    for (const e of this.embers) e.sprite.destroy();
    this.embers = [];
    for (let k = 0; k < chunk.material.length; k++) {
      if (chunk.material[k] !== Material.CHARRED) continue;
      const ci = k % WORLD.CELLS, cj = Math.floor(k / WORLD.CELLS);
      if (hash(ci, cj, 5) > 0.35) continue;
      const top = cellTop(ci, cj);
      const s = dot(EMBER[Math.floor(hash(ci, cj, 6) * 3)]);
      s.position.set(Math.round(top.x - 3 + hash(ci, cj, 7) * 6), Math.round(top.y - 1 + hash(ci, cj, 8) * 3));
      s.zIndex = top.y - 0.8;
      this.view.addChild(s);
      this.embers.push({ sprite: s, phase: hash(ci, cj, 9) * Math.PI * 2 });
    }
  }

  /** Animación (tiempo real) */
  update(dtMs: number, chunk: ChunkData, cellTop: CellTop): void {
    this.clock += dtMs;
    this.scan -= dtMs;
    if (this.scan <= 0) {
      this.scan = SCAN_MS;
      this.rescan(chunk, cellTop);
    }
    this.flicker -= dtMs;
    if (this.flicker <= 0) {
      this.flicker = FLICKER_MS;
      for (const f of this.flames) {
        f.frame = (f.frame + 1) % FLAME_FRAMES;
        f.sprite.texture = flameTexture(f.w, f.h, f.frame);
      }
    }
    // Brasas: laten
    for (const e of this.embers) e.sprite.alpha = 0.35 + 0.65 * Math.max(0, Math.sin(this.clock / 260 + e.phase));
    // Humo
    for (const src of this.smokeFrom) {
      if (Math.random() < (dtMs / 1000) * src.rate && this.puffs.length < 90) this.puff(src.x, src.y);
    }
    for (let n = this.puffs.length - 1; n >= 0; n--) {
      const p = this.puffs[n];
      p.life -= dtMs;
      p.sprite.x += p.vx * dtMs;
      p.sprite.y += p.vy * dtMs;
      p.sprite.alpha = Math.max(0, p.life / p.max) * 0.55;
      if (p.life <= 0) {
        p.sprite.destroy();
        this.puffs.splice(n, 1);
      }
    }
  }

  destroy(): void {
    for (const f of this.flames) f.sprite.destroy();
    for (const e of this.embers) e.sprite.destroy();
    for (const p of this.puffs) p.sprite.destroy();
  }

  /** Llamas en el frente de cada tile que arde; humo de lo que arde y de la Tierra Quemada */
  private rescan(chunk: ChunkData, cellTop: CellTop): void {
    for (const f of this.flames) f.sprite.destroy();
    this.flames = [];
    this.smokeFrom = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const t = tileIndex(i, j);
        if (chunk.burnt[t] === 1) {
          const top = cellTop(i * G + 1.5, j * G + 1.5);
          this.smokeFrom.push({ x: top.x, y: top.y - 2, rate: 0.6 });
        }
        if (chunk.fire[t] <= 0) continue;
        const order = frontOrder(i, j, chunk.fireFrom[t]);
        const age = chunk.fireAge[t];
        const from = Math.max(0, Math.floor((age - BURNING_BAND) * G * G));
        const to = Math.min(G * G, Math.max(2, Math.ceil(age * G * G) + 1));
        for (let n = from; n < to; n++) {
          const k = order[n];
          const ci = k % WORLD.CELLS, cj = Math.floor(k / WORLD.CELLS);
          if (chunk.water[cellIndex(ci, cj)] > 0.05) continue;
          for (let m = 0; m < 2; m++) {
            const top = cellTop(ci, cj);
            const w = 2 + Math.floor(hash(ci, cj, m) * 2);
            const h = Math.round((2 + hash(ci, cj, m + 3) * 4) * (0.6 + chunk.fire[t] * 0.6));
            const s = new Sprite(flameTexture(w, h, m));
            s.position.set(Math.round(top.x - 3 + hash(ci, cj, m + 7) * 6 - w / 2), Math.round(top.y + hash(ci, cj, m + 9) * 3 - h + 1));
            s.zIndex = top.y + 0.2;
            this.view.addChild(s);
            this.flames.push({ sprite: s, w, h, frame: m });
          }
          const top = cellTop(ci, cj);
          this.smokeFrom.push({ x: top.x, y: top.y - 6, rate: 1.5 * chunk.fire[t] });
        }
      }
    }
  }

  private puff(x: number, y: number): void {
    const s = dot(SMOKE[Math.floor(Math.random() * SMOKE.length)]);
    s.width = Math.random() < 0.4 ? 2 : 1;
    s.position.set(Math.round(x - 2 + Math.random() * 4), Math.round(y));
    s.zIndex = 9999;
    this.view.addChild(s);
    const max = 1600 + Math.random() * 1200;
    this.puffs.push({ sprite: s, vx: 0.002 + Math.random() * 0.004, vy: -0.012 - Math.random() * 0.008, life: max, max });
  }
}

/** Un píxel de color */
function dot(color: number): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.tint = color;
  s.width = 1;
  s.height = 1;
  return s;
}

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
