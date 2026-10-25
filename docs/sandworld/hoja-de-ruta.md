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
| 4F | Tercera especie y primer depredador: el lobo (olfato de hasta 2 islas, acecho y persecución por tiradas, presas débiles antes, plantar cara, carroña, viajes de caza, carne a los lobeznos con relevos, aullido, cría solo de la pareja dominante, cueva de roca natural o guarida de ramas). Refugios que se tapan y hunden por cantidad y tiempo (la cueva de roca solo se tapa) |
| 4G | Equilibrio: llegadas y marchas naturales por la orilla según lo que cabe en la isla (cada 3 días, tope de 1 a 2 grupos por chunk y tope por especie; la especie de más pierde grupos; una especie que desaparece tarda de 60 a 80 días en volver; lobos de fuera solo sin lobos y atraídos por la carroña), el lobo hambriento se va, apetito de invierno por especie, enfermedad por apretura, invierno que solo hiela lo alto, memoria de agua y comida y búsqueda cada vez más lejos, crías de refugio que maman cuando la madre vuelve, ciervo con gemelos al 40 % y vida de 4 a 7 años |

| 4H | Cuarta, quinta y sexta especie: el **cuervo** (vuela, nido en los árboles, roba presas, recuerda dónde hubo carne), los **humanos** (banda nómada, caza y recolección, choza, en grupo pueden matar al depredador; dibujados a doble densidad) y los **goblins** de la Tierra Quemada (nacen de 5 a 7 días después de la zona, cazan de noche, el sol les quema; la zona solo remite cuando mueren todos) |

## Ahora

- Probar el equilibrio con las 6 especies (producto mínimo viable) y pasar a la fase 5.
- **Isla el doble de grande** (parcelas de 2×2 chunks, mismos animales): hecho en 4L.
- Rendimiento del agua (rejilla de chunks por clave numérica), zoom lejano y búsqueda de presas: 4M.
- Sentidos comunes (vista y oído), peces, la loba que cuida la guarida y el botón para soltar la arena: 4N.
- Ajuste del lobo (caza en manada, pesca tras fallar, camadas según la comida): 4O.
- Manada que caza junta (90 %), lobos que no se van enseguida y vuelven antes, la sed antes que dormir, vista en Ajustes: 4P.
- Caza en manada de verdad (llamar al compañero, esperar para saltar juntos), reparto en la presa, cadáveres que el frío conserva: 4Q.
- Manada mínima de 5 que caza siempre junta, el que caza solo a escondidas, fundar manada o irse, cadáveres que se pudren: 4R.
- **Panel de Equilibrio**: barras por especie en el botón (con aviso "!"), y tres pestañas para que los testers elijan:
  Especies (estado en palabras y su porqué), Gráfico (30 días, con lo que contó la crónica) y Cadena alimentaria: 4S.
- **El paisaje del miedo**: una presa que ve a su depredador (aunque no cace) se aleja hasta dejar de verlo, su
  manada la sigue y evita esa zona día y medio; no duermen donde lo vieron: 4T.
- El lobo aprovecha su ciervo (vuelve a comer en cuanto se le pasa el atracón; el ciervo tarda 4 días en pudrirse): 4U.

## Después (fase 4)

- El resto de especies (hasta ~20) queda para la **ampliación**, después del producto mínimo viable.

## Fases siguientes

| Fase | Contenido | Resultado |
|---|---|---|
| 5 | Aparición natural de los animales y prueba de su equilibrio; guardado local; disparadores, cartas (Dios Espagueti), reglas permanentes, decisiones del jugador | **MVP jugable** |
| 6 | Escalera evolutiva, sociedades (huertos, descubrir el fuego), rivalidad con humanos | Evolución social |
| 7 | Catástrofes, expansión con nubes, criatura de ceniza y brasa (diseño guardado), fin de partida | Mundo ampliado |
| 8 | Simulación offline ("Mientras no estabas…"), combinaciones | Partidas largas |
| 9 | Optimización móvil (Web Worker, atlas, culling) y **pulido** (ver decisiones) | Lista para probar en móvil |
