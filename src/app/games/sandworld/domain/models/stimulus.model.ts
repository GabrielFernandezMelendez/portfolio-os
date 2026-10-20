// Estímulos: lo que pasa en el mundo y pueden notar los animales (un ruido, algo que cae, un rayo...).
// El mundo los emite; cada especie reacciona según su temperamento (config/temperament.config.ts).
// El miedo que provocan es interno: el jugador solo lo ve en cómo se comportan.

export type StimulusType =
  | 'fire'        // fuego que prende
  | 'sandFall'    // arena que cae de la nada (Duna)
  | 'dig'         // el suelo se abre (Marea)
  | 'spring'      // brota agua (Manantial)
  | 'heat'        // el suelo quema (Brasa)
  | 'frost'       // todo se hiela de golpe (Escarcha)
  | 'glow'        // algo brilla (Despertar, Afinidad)
  | 'lightning'   // cae un rayo cerca
  | 'thunder'     // trueno: se oye en toda la isla
  | 'corpse';     // uno de los suyos muerto

/** Cómo reacciona una especie a un tipo de estímulo */
export type Reaction = 'flee' | 'startle' | 'curious' | 'avoid' | 'ignore';

export interface Stimulus {
  readonly type: StimulusType;
  /** Dónde (celda global, con decimales) */
  readonly gx: number;
  readonly gy: number;
  /** Fuerza (0..1): un vertido largo o un rayo encima asustan más */
  readonly strength: number;
  /** Celdas alrededor en las que hace daño (Duna que cae encima, rayo); 0 = no hace daño */
  readonly hurtRadius?: number;
  /** Animal al que se refiere (un cadáver) */
  readonly animal?: number;
}
