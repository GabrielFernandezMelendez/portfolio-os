import { ChunkData, cellIndex, groundAt, tileIndex } from '../../domain/models/chunk.model';
import { Biome, BiomeId } from '../../domain/models/biome.model';
import { Material, MaterialId } from '../../domain/models/material.model';
import { WORLD } from '../../domain/models/world.model';
import { TERRAIN_RAMPS, TERRAIN_WALLS, WATERFALL } from '../../config/palette.config';
import { clamp, fbm, hash2, valueNoise } from '../../application/world/noise';

/*
  Horneado del terreno de un chunk en un buffer RGBA (función pura: sin Pixi ni DOM, testeable en Node).

  Cómo funciona:
  1. Se muestrea el chunk a 1 píxel de pantalla (20 muestras por tile y eje).
  2. Para cada muestra se calcula su terraza: la altura continua de las celdas, interpolada y cuantizada
     en niveles, con el contorno deformado por ruido para que no siga la cuadrícula.
  3. Se pinta de atrás hacia delante: cada muestra pone su píxel superior y una columna de pared
     solo hasta donde la tapa la muestra de delante.
*/

const N = WORLD.TILES;
const C = WORLD.CELLS;
const G = WORLD.CELLS_PER_TILE;
const TW = WORLD.TILE_W;
const TH = WORLD.TILE_H;
const STEP = WORLD.LEVEL_PX;
const MAXL = WORLD.MAX_LEVEL;
const DEPTH = WORLD.BASE_DEPTH;

/** Muestras por tile y eje (1 píxel en pantalla) */
const S = 20;
/** Muestras por lado del chunk */
const M = N * S + 1;
/** Agua mínima (en niveles) para considerarse lámina visible */
const WET = 0.06;

/** Margen superior para que quepan las terrazas más altas */
const TOP_MARGIN = (MAXL + 3) * STEP + 2;

/** Tamaño del buffer horneado y dónde cae el centro del tile (0,0) dentro de él */
export const BAKE_WIDTH = N * TW;
export const BAKE_HEIGHT = TOP_MARGIN + N * TH + DEPTH + 6;
export const BAKE_ORIGIN_X = BAKE_WIDTH / 2;
export const BAKE_ORIGIN_Y = TOP_MARGIN + TH / 2;

type Ramp = readonly number[];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)];

const shade = (ramp: Ramp, val: number, px: number, py: number): number =>
  ramp[clamp(Math.floor(val * (ramp.length - 1) + bayer(px, py)), 0, ramp.length - 1)];

const darken = (c: number, f: number): number =>
  (Math.round((c >> 16) * (1 - f)) << 16) | (Math.round(((c >> 8) & 255) * (1 - f)) << 8) | Math.round((c & 255) * (1 - f));

const lighten = (c: number, f: number): number => {
  const r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r + (255 - r) * f) << 16) | (Math.round(g + (255 - g) * f) << 8) | Math.round(b + (255 - b) * f);
};

const LAND_RAMP: Record<BiomeId, Ramp> = {
  [Biome.FOREST]: TERRAIN_RAMPS.forest,
  [Biome.DESERT]: TERRAIN_RAMPS.desert,
  [Biome.TUNDRA]: TERRAIN_RAMPS.tundra,
  [Biome.WETLAND]: TERRAIN_RAMPS.marsh,
};

const WALL: Record<BiomeId, readonly number[]> = {
  [Biome.FOREST]: TERRAIN_WALLS.forest,
  [Biome.DESERT]: TERRAIN_WALLS.desert,
  [Biome.TUNDRA]: TERRAIN_WALLS.tundra,
  [Biome.WETLAND]: TERRAIN_WALLS.forest,
};

/**
 * Color de la cara superior según el material de la capa de arriba.
 * La tierra (SOIL) no tiene rampa propia: usa la del bioma, como el terreno generado.
 */
const MATERIAL_RAMP: Partial<Record<MaterialId, Ramp>> = {
  [Material.SAND]: TERRAIN_RAMPS.desert,   // arena de Duna: amarilla como su botella (la playa usa la rampa "sand")
  [Material.HUMUS]: TERRAIN_RAMPS.humus,
  [Material.ASH]: TERRAIN_RAMPS.ash,
  [Material.MUD]: TERRAIN_RAMPS.wetsand,
  [Material.SNOW]: TERRAIN_RAMPS.tundra,
  [Material.ICE]: TERRAIN_RAMPS.ice,
};

/** Paredes según material (si no, las del bioma) */
const MATERIAL_WALL: Partial<Record<MaterialId, readonly number[]>> = {
  [Material.SAND]: TERRAIN_WALLS.desert,
  [Material.SNOW]: TERRAIN_WALLS.tundra,
  [Material.ICE]: TERRAIN_WALLS.tundra,
};

/** Sedimento mínimo (en niveles) para que se vea el color del material */
const MATERIAL_VISIBLE = 0.02;

/** Rejillas que solo dependen de la semilla: se calculan una vez y se reutilizan en cada horneado */
interface StaticGrids {
  inside: Uint8Array;     // dentro del contorno irregular de la isla
  warp: Float32Array;     // deformación del contorno de las terrazas
  bioTile: Uint16Array;   // tile del que toma el bioma cada muestra (desplazado con ruido → bordes orgánicos)
  texture: Float32Array;  // variación de luz para que la superficie no sea plana
}

export class ChunkBaker {
  private readonly grids: StaticGrids;

  // Rejillas de trabajo reutilizadas entre horneados (evita crear arrays en cada frame)
  private readonly sLvl = new Int8Array(M * M);
  private readonly sSurf = new Float32Array(M * M);
  private readonly sWet = new Uint8Array(M * M);
  private readonly sGround = new Float32Array(M * M);
  private readonly sDepth = new Float32Array(M * M);
  private readonly sShore = new Float32Array(M * M);
  private readonly sWaterSurf = new Float32Array(M * M);
  private readonly gArr = new Float32Array(C * C);
  private readonly wsArr = new Float32Array(C * C);
  private readonly wetArr = new Float32Array(C * C);
  private readonly shoreDist = new Float32Array(C * C);

  /**
   * Qué celda pintó cada píxel del último horneado (índice + 1; 0 = vacío).
   * Da un picking exacto al píxel: tocar una pared o el agua selecciona la celda que se ve ahí.
   */
  private readonly owner = new Uint16Array(BAKE_WIDTH * BAKE_HEIGHT);

  constructor(private readonly seed: number) {
    this.grids = this.buildStaticGrids();
  }

  /** Hornea el chunk en `out` (RGBA, BAKE_WIDTH × BAKE_HEIGHT). Los píxeles fuera de la isla quedan transparentes. */
  bake(chunk: ChunkData, out: Uint8ClampedArray): void {
    out.fill(0);
    this.owner.fill(0);
    this.prepareCellArrays(chunk);
    this.prepareSamples();
    this.paint(chunk, out);
  }

  /** Celda (índice local) visible en el píxel (px, py) del buffer horneado, o -1 si no hay terreno */
  pickCell(px: number, py: number): number {
    const x = Math.floor(px), y = Math.floor(py);
    if (x < 0 || y < 0 || x >= BAKE_WIDTH || y >= BAKE_HEIGHT) return -1;
    return this.owner[y * BAKE_WIDTH + x] - 1;
  }

  /** Altura visible (terraza o lámina de agua, en niveles) en el centro de una celda, según el último horneado */
  surfaceAtCell(ci: number, cj: number): number {
    const a = Math.round((ci + 0.5) * S / G);
    const b = Math.round((cj + 0.5) * S / G);
    return this.sSurf[clamp(b, 0, M - 1) * M + clamp(a, 0, M - 1)];
  }

  // ── 1. Rejillas estáticas ─────────────────────────────────────────

  private buildStaticGrids(): StaticGrids {
    const seed = this.seed;
    const inside = new Uint8Array(M * M);
    const warp = new Float32Array(M * M);
    const bioTile = new Uint16Array(M * M);
    const texture = new Float32Array(M * M);

    // Contorno irregular de la isla: cada borde se come entre 0 y ~0.22 tiles
    const jag = (t: number, k: number): number => 0.22 * valueNoise(t * 1.8 + k * 17.3, k * 3.1, seed + 99);

    for (let b = 0; b < M; b++) {
      for (let a = 0; a < M; a++) {
        const u = -0.5 + a / S;
        const v = -0.5 + b / S;
        const q = b * M + a;
        inside[q] =
          u > -0.5 + jag(v, 1) && u < N - 0.5 - jag(v, 2) && v > -0.5 + jag(u, 3) && v < N - 0.5 - jag(u, 4) ? 1 : 0;
        warp[q] = (valueNoise(u * 1.7, v * 1.7, seed + 40) - 0.5) * 0.35;
        const bu = u + (valueNoise(u * 2.3, v * 2.3, seed + 1) - 0.5) * 0.6;
        const bv = v + (valueNoise(u * 2.3, v * 2.3, seed + 2) - 0.5) * 0.6;
        bioTile[q] = tileIndex(clamp(Math.round(bu), 0, N - 1), clamp(Math.round(bv), 0, N - 1));
        texture[q] = (valueNoise(u * 5, v * 5, seed + 4) - 0.5) * 0.25 + (fbm(u * 0.8, v * 0.8, seed + 3) - 0.5) * 0.4;
      }
    }
    return { inside, warp, bioTile, texture };
  }

  // ── 2. Datos por celda ────────────────────────────────────────────

  private prepareCellArrays(chunk: ChunkData): void {
    for (let k = 0; k < C * C; k++) {
      const g = groundAt(chunk, k);
      const wet = chunk.water[k] > WET;
      this.gArr[k] = g;
      this.wetArr[k] = wet ? 1 : 0;
      this.wsArr[k] = wet ? g + chunk.water[k] : 0;
    }
    this.computeShoreDistance();
  }

  /** Distancia (en celdas) al agua más cercana: sirve para pintar orillas de arena o grava */
  private computeShoreDistance(): void {
    const d = this.shoreDist;
    for (let k = 0; k < C * C; k++) d[k] = this.wetArr[k] ? 0 : 99;
    for (let pass = 0; pass < 2; pass++) {
      for (let cj = 0; cj < C; cj++) {
        for (let ci = 0; ci < C; ci++) {
          const k = cellIndex(ci, cj);
          if (ci > 0) d[k] = Math.min(d[k], d[k - 1] + 1);
          if (cj > 0) d[k] = Math.min(d[k], d[k - C] + 1);
        }
      }
      for (let cj = C - 1; cj >= 0; cj--) {
        for (let ci = C - 1; ci >= 0; ci--) {
          const k = cellIndex(ci, cj);
          if (ci < C - 1) d[k] = Math.min(d[k], d[k + 1] + 1);
          if (cj < C - 1) d[k] = Math.min(d[k], d[k + C] + 1);
        }
      }
    }
  }

  /** Interpolación bilineal de un array de celdas en un punto (u, v) en coordenadas de tile */
  private bilinear(arr: Float32Array, u: number, v: number): number {
    const x = clamp((u + 0.5) * G - 0.5, 0, C - 1);
    const y = clamp((v + 0.5) * G - 0.5, 0, C - 1);
    const i0 = x | 0, j0 = y | 0;
    const i1 = i0 < C - 1 ? i0 + 1 : i0;
    const j1 = j0 < C - 1 ? j0 + 1 : j0;
    const fa = x - i0, fb = y - j0;
    return (arr[j0 * C + i0] * (1 - fa) + arr[j0 * C + i1] * fa) * (1 - fb) +
           (arr[j1 * C + i0] * (1 - fa) + arr[j1 * C + i1] * fa) * fb;
  }

  // ── 3. Datos por muestra (terraza, agua, orilla) ──────────────────

  private prepareSamples(): void {
    const { inside, warp } = this.grids;
    for (let b = 0; b < M; b++) {
      for (let a = 0; a < M; a++) {
        const q = b * M + a;
        if (!inside[q]) continue;
        const u = -0.5 + a / S;
        const v = -0.5 + b / S;
        const g = this.bilinear(this.gArr, u, v);
        const lvl = clamp(Math.floor(g + warp[q]), 0, MAXL);
        this.sLvl[q] = lvl;
        this.sGround[q] = g;
        this.sShore[q] = this.bilinear(this.shoreDist, u, v);

        const wetFraction = this.bilinear(this.wetArr, u, v);
        const waterSurf = wetFraction > 0 ? this.bilinear(this.wsArr, u, v) / wetFraction : 0;
        this.sWaterSurf[q] = waterSurf;
        // La superficie del agua se interpola solo entre celdas mojadas: lagos planos y ríos sin escalones
        if (wetFraction > 0.5 && waterSurf > lvl + 0.05) {
          this.sWet[q] = 1;
          this.sSurf[q] = waterSurf;
          this.sDepth[q] = waterSurf - g;
        } else {
          this.sWet[q] = 0;
          this.sSurf[q] = lvl;
          this.sDepth[q] = 0;
        }
      }
    }
  }

  // ── 4. Pintado de atrás hacia delante ─────────────────────────────

  private paint(chunk: ChunkData, out: Uint8ClampedArray): void {
    const { inside, bioTile, texture } = this.grids;
    const owner = this.owner;
    let cell = 0;                                         // celda de la muestra que se está pintando (+1)
    const put = (px: number, py: number, c: number): void => {
      if (px < 0 || py < 0 || px >= BAKE_WIDTH || py >= BAKE_HEIGHT) return;
      owner[py * BAKE_WIDTH + px] = cell;
      const k = (py * BAKE_WIDTH + px) * 4;
      out[k] = c >> 16;
      out[k + 1] = (c >> 8) & 255;
      out[k + 2] = c & 255;
      out[k + 3] = 255;
    };

    for (let s = 0; s <= 2 * (M - 1); s++) {
      for (let a = Math.max(0, s - (M - 1)); a <= Math.min(M - 1, s); a++) {
        const b = s - a;
        const q = b * M + a;
        if (!inside[q]) continue;

        const u = -0.5 + a / S;
        const v = -0.5 + b / S;
        cell = cellIndex(clamp(Math.floor((u + 0.5) * G), 0, C - 1), clamp(Math.floor((v + 0.5) * G), 0, C - 1)) + 1;
        const lvl = this.sLvl[q];
        const isWet = this.sWet[q] === 1;
        const surf = this.sSurf[q];
        const px = Math.round(BAKE_ORIGIN_X + (u - v) * TW / 2);
        const base = BAKE_ORIGIN_Y + (u + v) * TH / 2;
        const py = Math.round(base - surf * STEP);

        // Vecinos de delante (derecha-abajo, izquierda-abajo y justo debajo en pantalla)
        const qR = a + 1 < M ? q + 1 : q;
        const qL = b + 1 < M ? q + M : q;
        const qF = a + 1 < M && b + 1 < M ? q + M + 1 : q;
        const edgeR = !inside[qR];
        const edgeL = !inside[qL];
        const edgeF = edgeR || edgeL || !inside[qF];
        const frontLvl = Math.min(edgeR ? -9 : this.sLvl[qR], edgeL ? -9 : this.sLvl[qL]);

        const biome = chunk.biome[bioTile[q]] as BiomeId;
        const tex = texture[q];
        const material = chunk.sediment[cell - 1] > MATERIAL_VISIBLE ? chunk.material[cell - 1] as MaterialId : Material.SOIL;
        const materialRamp = MATERIAL_RAMP[material];

        // Cara superior
        let color: number;
        if (isWet) {
          const depth = this.sDepth[q];
          const val = 0.75 - clamp(depth / 1.2) * 0.6 + tex * 0.8;
          color = depth < 0.12
            ? shade(TERRAIN_RAMPS.shallow, clamp(val + 0.15), px, py)
            : shade(TERRAIN_RAMPS.water, clamp(val), px, py);
        } else {
          const g = this.sGround[q];
          const slope = (this.bilinear(this.gArr, u + 0.2, v) - this.bilinear(this.gArr, u - 0.2, v)) +
                        (this.bilinear(this.gArr, u, v + 0.2) - this.bilinear(this.gArr, u, v - 0.2)) * 0.35;
          const val = 0.3 + lvl * 0.05 - slope * 0.35 + (g - lvl) * 0.25 + tex;
          let ramp: Ramp = materialRamp ?? LAND_RAMP[biome];
          // Orilla: arena seca, arena mojada o grava (tundra) cerca del agua y a su misma altura
          const shore = this.sShore[q] + tex * 1.5;
          if (!materialRamp && shore < 1.5 && lvl <= Math.floor(this.sWaterSurf[q] + 0.6)) {
            ramp = biome === Biome.TUNDRA ? TERRAIN_RAMPS.gravel : shore < 0.8 ? TERRAIN_RAMPS.wetsand : TERRAIN_RAMPS.sand;
          }
          color = shade(ramp, clamp(val), px, py);
          // Briznas sueltas en la hierba
          if (ramp === TERRAIN_RAMPS.forest) {
            const r = hash2(px, py, 11);
            if (r < 0.015) color = TERRAIN_RAMPS.forest[4];
            else if (r > 0.988) color = TERRAIN_RAMPS.forest[0];
          }
          // Borde iluminado de la terraza
          if (frontLvl < lvl && frontLvl > -9) color = lighten(color, 0.22);
        }
        put(px, py, color);

        // Pared: solo hasta la superficie de la muestra de delante (o hasta la base en el borde de la isla)
        const frontSurf = edgeF ? -DEPTH / STEP - 1 : Math.min(this.sSurf[qR], this.sSurf[qL], this.sSurf[qF]);
        const drop = Math.round((surf - frontSurf) * STEP) + 1;
        if (drop <= 1) continue;

        const bottom = edgeF ? Math.round(base + DEPTH + (valueNoise(px * 0.15, 0, this.seed + 21) - 0.5) * 4) : py + drop;
        const wall = MATERIAL_WALL[material] ?? (lvl >= 5 && biome !== Biome.TUNDRA ? TERRAIN_WALLS.rock : WALL[biome]);
        const leftFace = (edgeL ? -9 : this.sLvl[qL]) <= (edgeR ? -9 : this.sLvl[qR]);
        const waterPx = isWet ? Math.round((surf - lvl) * STEP) : 0;

        for (let y = py + 1, d = 1; y <= bottom; y++, d++) {
          let wc: number;
          if (d <= waterPx) {
            // Espuma solo en cascadas de verdad; si el desnivel es pequeño, agua normal
            wc = drop > STEP + 1 ? WATERFALL[(y + px + 999) % 3] : TERRAIN_RAMPS.water[2];
          } else {
            const dd = d - waterPx;
            if (dd <= 1 && !isWet) {
              wc = wall[0];                                     // labio de hierba o arena
            } else {
              const t = clamp((dd - 1) / 14) + (bayer(px, y) - 0.5) * 0.35;
              wc = t < 0.4 ? wall[1] : t < 0.75 ? wall[2] : wall[3];
              if ((Math.round(base) - y) % STEP === 0) wc = darken(wc, 0.12);   // estratos
            }
          }
          put(px, y, leftFace ? wc : darken(wc, 0.18));        // la cara derecha queda en sombra
        }
      }
    }
  }
}
