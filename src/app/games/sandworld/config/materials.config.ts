import { Material, MaterialId, MaterialProps } from '../domain/models/material.model';

// Tabla de materiales [PROPUESTA]: valores de partida para afinar jugando (análisis funcional §5.2)
export const MATERIALS: Readonly<Record<MaterialId, MaterialProps>> = {
  [Material.ROCK]:  { weight: 2.6, repose: Infinity, permeability: 0.0,  retention: 0.05, erosion: 0.02, fertility: 0.0 },
  [Material.SOIL]:  { weight: 1.5, repose: 0.9,      permeability: 0.15, retention: 0.6,  erosion: 0.3,  fertility: 0.5 },
  [Material.SAND]:  { weight: 1.6, repose: 0.55,     permeability: 0.45, retention: 0.15, erosion: 0.7,  fertility: 0.1 },
  [Material.HUMUS]: { weight: 0.9, repose: 0.8,      permeability: 0.3,  retention: 0.85, erosion: 0.45, fertility: 1.0 },
  [Material.ASH]:   { weight: 0.6, repose: 0.45,     permeability: 0.35, retention: 0.4,  erosion: 0.9,  fertility: 0.8 },
  [Material.MUD]:   { weight: 1.8, repose: 0.3,      permeability: 0.05, retention: 0.95, erosion: 0.8,  fertility: 0.6 },
  [Material.SNOW]:  { weight: 0.3, repose: 0.7,      permeability: 0.2,  retention: 0.1,  erosion: 0.5,  fertility: 0.0 },
  [Material.ICE]:   { weight: 0.9, repose: Infinity, permeability: 0.0,  retention: 0.0,  erosion: 0.05, fertility: 0.0 },
};
