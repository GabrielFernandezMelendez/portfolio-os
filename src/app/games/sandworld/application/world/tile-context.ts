import { ChunkData, cellIndex, temperatureAt, tileIndex } from '../../domain/models/chunk.model';
import { Material } from '../../domain/models/material.model';
import { TileContext } from '../../domain/models/biome.model';
import { WORLD } from '../../domain/models/world.model';

/** Sedimento (en niveles) por debajo del cual se ve la roca */
const BARE_ROCK = 0.05;
/** Agua (en niveles) a partir de la cual una celda cuenta como mojada */
const WET = 0.05;

/** Resume las 16 celdas del tile (i, j) para decidir su bioma */
export function tileContext(chunk: ChunkData, i: number, j: number): TileContext {
  const G = WORLD.CELLS_PER_TILE;
  let water = 0, moisture = 0, mud = 0, sand = 0, ash = 0, charred = 0, rock = 0, cover = 0;
  for (let dj = 0; dj < G; dj++) {
    for (let di = 0; di < G; di++) {
      const k = cellIndex(i * G + di, j * G + dj);
      if (chunk.water[k] > WET) water++;
      moisture += chunk.moisture[k];
      // La nieve y el hielo de temporada no cuentan para el bioma: se mira lo que hay debajo
      if (chunk.cover[k] > BARE_ROCK && !chunk.coverSeasonal[k]) { cover++; continue; }
      if (chunk.sediment[k] <= BARE_ROCK) { rock++; continue; }
      switch (chunk.material[k]) {
        case Material.MUD: case Material.PEAT: mud++; break;
        case Material.SAND: sand++; break;
        case Material.ASH: ash++; break;
        case Material.CHARRED: charred++; break;
      }
    }
  }
  const n = G * G;
  const t = tileIndex(i, j);
  return {
    temperature: temperatureAt(chunk, t),
    humidity: chunk.humidity[t],
    water: water / n,
    moisture: moisture / n,
    mud: mud / n,
    sand: sand / n,
    ash: ash / n,
    charred: charred / n,
    rock: rock / n,
    cover: cover / n,
    fertility: chunk.fertility[t],
    essence: chunk.essence[t],
    affinity: chunk.affinity[t],
    glade: chunk.glade[t] === 1,
  };
}
