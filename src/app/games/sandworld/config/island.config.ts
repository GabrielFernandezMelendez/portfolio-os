/*
  Tamaño de la isla [PROPUESTA]. La isla crece por parcelas: cada vez que sube de nivel se descubre un cuadrado de
  PLOT × PLOT chunks (empieza con uno). Así la isla es el doble de grande de lado (cuatro veces la superficie) sin
  cambiar el chunk (32 celdas): todo lo que se mide en "islas" (el olfato del lobo, lo que recorre) sigue igual en
  celdas, y los animales quedan más separados.
*/

/** Chunks por lado de cada parcela */
export const PLOT = 2;

/**
 * Chunks de una parcela. Los topes de población y lo que la isla puede alimentar se cuentan por parcela (no por
 * chunk): en una isla con el doble de lado caben los mismos animales que antes, con cuatro veces más espacio.
 */
export const CHUNKS_PER_PLOT = PLOT * PLOT;
