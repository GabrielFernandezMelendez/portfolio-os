/** Un trozo de Tierra Quemada: los tiles (globales) que están unidos */
export interface BurntRegion {
  readonly tiles: readonly { readonly gi: number; readonly gj: number }[];
}

/**
 * La Tierra Quemada vista desde la fauna: qué zonas hay y si tienen vida. Mientras una zona tiene vida (sus
 * criaturas), crece por sus bordes; sin vida, remite de fuera hacia dentro.
 */
export interface BurntLand {
  regions(): BurntRegion[];
  setLife(region: BurntRegion, alive: boolean): void;
}
