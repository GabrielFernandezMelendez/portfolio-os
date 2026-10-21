# Sandworld — hoja de ruta

Cada fase se divide en bloques. Cada bloque: lista de tareas validada → (mockup si es visual) → script de entrega →
hash → commit (checkpoint) → deploy. La versión jugable (MVP) llega al final de la fase 5.

## Hecho

| Fase | Contenido |
|---|---|
| 0 | Identidad visual: pixel art isométrico con degradados tramados, transiciones orgánicas, relieve |
| 1 | Chunk con celdas, horneado orgánico, cámara y gestos, HUD de madera (crónica, indicadores), idiomas |
| 2 | Materiales, agua (ríos, lagos, barro), desprendimientos, 8 arenas con pincel y asentamiento |
| 3 | Clima, biomas vivos (pantano, roquedal, Claro Despierto…), día y noche, estaciones, tiempo atmosférico |
| 4A | Vegetación: 20 plantas con registro, plantas persistentes con etapas y muertes, sprites por código, frutos, humus y pantano, huertos |
| 4B | Fuego y Tierra Quemada: sequedad, rayos, frente de fuego, ceniza, remisión, muro de Escarcha y zanja de Marea |
| 4C | Fauna, primera especie: el ciervo (necesidades, manada, celo y crías, dieta con frutos, ficha Estado/Diario, órdenes, sprites) |
| 4D | Comportamiento común de la fauna: espacio personal, estímulos (arenas, fuego, rayos, cadáveres), miedo interno, estampidas, costumbre, tiempo |
| 4D2 | Correr deja jadeando (no dormido), huidas de hasta 1 isla, exploración en solitario (hasta 1,5 islas) y reagrupación nocturna, rutas que rodean lagos, signos "!" y "?", estado "Asustado" |

| 4D3 | Vista de lejos: una moneda por manada (cara de la especie y cuántos son) a zoom ×1 y ×1,5; tocarla abre la ficha de la guía |
| 4D4 | Correr desde la vista de moneda: corre toda la manada; 75 % juntos y 25 % se separan, que luego quizá encuentran a los suyos |
| 4E | Segunda especie: el conejo (madrigueras, vida nocturna, cría por temporada con camadas de 2 a 7, quedarse quieto o correr a la madriguera, zigzag, jóvenes que fundan colonias, enfermedad, arenas contra la madriguera) |

## Ahora

- Siguiente especie (propuesta: el lobo, el primer depredador; investigar antes con Dwarf Fortress y RimWorld).

## Después (fase 4)

- Más especies, una a una: ciervo y conejo hechos → lobo → … hasta ~20.
  Orden recomendado: presa pequeña que compite por la hierba (conejo) y luego el depredador (lobo), que trae
  el riesgo de que una manada pequeña o dispersa sea cazada.
- Panel de Equilibrio con la densidad de cada especie.

## Fases siguientes

| Fase | Contenido | Resultado |
|---|---|---|
| 5 | Disparadores, cartas (Dios Espagueti), reglas permanentes, decisiones del jugador, guardado local | **MVP jugable** |
| 6 | Escalera evolutiva, sociedades (huertos, descubrir el fuego), rivalidad con humanos | Evolución social |
| 7 | Catástrofes, expansión con nubes, "las cosas" de la Tierra Quemada, fin de partida | Mundo ampliado |
| 8 | Simulación offline ("Mientras no estabas…"), combinaciones | Partidas largas |
| 9 | Optimización móvil (Web Worker, atlas, culling) y **pulido** (ver decisiones) | Lista para probar en móvil |
