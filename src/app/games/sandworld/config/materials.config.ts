import { Material, MaterialDef, MaterialId, MaterialProps } from '../domain/models/material.model';

/*
  Registro de materiales [PROPUESTA]: valores de partida para afinar jugando (análisis funcional §5.2).
  Añadir un material = nuevo id en material.model.ts + una entrada aquí. La física, el agua y el dibujo
  lo leen todo de este registro, sin código específico por material.
*/
export const MATERIAL_DEFS: Readonly<Record<MaterialId, MaterialDef>> = {
  [Material.ROCK]:    { key: 'rock',    weight: 2.6, repose: Infinity, permeability: 0.0,  retention: 0.05, erosion: 0.02, fertility: 0.0, fuel: 0,   maxLoad: Infinity, flow: 1.3, ramp: 'gravel', wall: 'rock' },
  [Material.SOIL]:    { key: 'soil',    weight: 1.5, repose: 0.9,      permeability: 0.15, retention: 0.6,  erosion: 0.3,  fertility: 0.5, fuel: 0,   maxLoad: Infinity, flow: 1.0 },
  [Material.SAND]:    { key: 'sand',    weight: 1.6, repose: 0.55,     permeability: 0.45, retention: 0.15, erosion: 0.7,  fertility: 0.1, fuel: 0,   maxLoad: Infinity, flow: 1.0, ramp: 'desert', wall: 'desert' },
  [Material.HUMUS]:   { key: 'humus',   weight: 0.9, repose: 0.8,      permeability: 0.3,  retention: 0.85, erosion: 0.45, fertility: 1.0, fuel: 0.3, maxLoad: Infinity, flow: 0.7, ramp: 'humus' },
  [Material.ASH]:     { key: 'ash',     weight: 0.6, repose: 0.45,     permeability: 0.35, retention: 0.4,  erosion: 0.9,  fertility: 0.8, fuel: 0,   maxLoad: Infinity, flow: 1.0, ramp: 'ash' },
  [Material.MUD]:     { key: 'mud',     weight: 1.8, repose: 0.3,      permeability: 0.05, retention: 0.95, erosion: 0.8,  fertility: 0.6, fuel: 0,   maxLoad: 60,       flow: 0.4, ramp: 'mud' },
  [Material.SNOW]:    { key: 'snow',    weight: 0.3, repose: 0.7,      permeability: 0.2,  retention: 0.1,  erosion: 0.5,  fertility: 0.0, fuel: 0,   maxLoad: Infinity, flow: 0.9, ramp: 'tundra', wall: 'tundra' },
  [Material.ICE]:     { key: 'ice',     weight: 0.9, repose: Infinity, permeability: 0.0,  retention: 0.0,  erosion: 0.05, fertility: 0.0, fuel: 0,   maxLoad: 120,      flow: 1.2, ramp: 'ice', wall: 'tundra' },
  [Material.PEAT]:    { key: 'peat',    weight: 0.5, repose: 0.6,      permeability: 0.6,  retention: 1.0,  erosion: 0.3,  fertility: 0.7, fuel: 0.9, maxLoad: Infinity, flow: 0.6, ramp: 'peat' },
  [Material.CHARRED]: { key: 'charred', weight: 1.9, repose: 1.2,      permeability: 0.02, retention: 0.05, erosion: 0.15, fertility: 0.0, fuel: 0,   maxLoad: Infinity, flow: 1.3, ramp: 'charred', wall: 'charred' },
};

/** Solo las propiedades físicas (compatibilidad con el código que ya las leía así) */
export const MATERIALS: Readonly<Record<MaterialId, MaterialProps>> = MATERIAL_DEFS;
