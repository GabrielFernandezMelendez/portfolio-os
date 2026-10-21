# Sandworld — decisiones de diseño

Lo que ya está decidido. Antes de cambiar algo de esta lista, se pregunta.

## Mundo y arenas
- Cada partida tendrá semilla aleatoria (mapa y especies), con opción de introducir una semilla para repetir un mapa.
- El Manantial **no** frena el fuego ni la Tierra Quemada; sobre la Tierra Quemada su agua se evapora.
- La Duna no afecta al fuego. Escarcha y Marea sí: muro helado (hay que renovarlo) y zanja de roca sin combustible.
- La Tierra Quemada nace con 9 tiles quemados juntos, crece despacio por sus bordes y no deja hacer lagos dentro.
  Mientras tenga criaturas no se puede destruir, solo contener; sin vida remite de fuera hacia dentro.

## Fauna
- Las especies se implementan de una en una; sus sprites son isométricos (mockup → aprobación → código).
- Equilibrio con **riesgo doble**: mucha comida → muchas crías (se deciden en el celo, nacen meses después) → hambruna;
  una población pequeña o dispersa → vulnerable (sin pareja, presa fácil). Mantener el equilibrio es cosa del jugador.
- Los animales no aparecen solos al empezar: llegan (hoy con el botón de prueba; más adelante, cartas y expansión).
- Ficha del animal: Vida (heridas y enfermedad), Sueño, Hambre, Sed y Felicidad en barras con porcentaje
  (**llena = bien**), raza, nombre, días vivo, "Le afecta", diario con scroll y órdenes Comer, Dormir y Correr.
- La **vejez es una sorpresa**: no se muestra cuánto vivirá.
- El **miedo no tiene barra**: se muestra como un **estado** abajo en la ficha ("Asustado"), igual que
  "Sediento" o "Hambriento". Sobre todo se ve en el comportamiento (se quedan quietos, huyen hasta relajarse,
  estampidas, evitan zonas, no duermen con tormenta).
- Los comportamientos naturales son comunes a todas las especies (espacio personal, reacciones, tiempo) y cada
  especie los ajusta con su registro y su temperamento.
- Correr (orden) puede hacer que el animal pierda su manada; ese momento será una decisión del jugador (fase 5).
- Los nombres se generan solos y son irónicos (nombres de persona o de su comida favorita: Bellota, Brote;
  un lobo "Conejito" por la comida favorita de su padre).

## Para la fase de pulido (no hacer antes)
- Selfies pixel art graciosos de cada animal con complementos (parche, cigarro, monóculo, tupé…).
- Afinar los nombres irónicos.
- Feedback visual cuando la Marea o la Escarcha frenan la Tierra Quemada.
- Ajustar duraciones de animaciones, restos de plantas y árboles en el agua.
- Ajustar todos los valores marcados como [PROPUESTA] en `config/`.
