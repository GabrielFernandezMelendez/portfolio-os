---
name: sandworld-investigar
description: Investigar comportamientos y mecánicas en juegos de colonias y simuladores parecidos antes de proponer una especie, un comportamiento animal o una mecánica nueva en Sandworld.
---

# Investigar antes de proponer

Úsala cuando toque: una especie nueva, comportamientos de animales, correcciones de comportamiento o
cualquier mecánica nueva (depredación, enfermedades, sociedades…). La idea es inspirarse en lo que ya funciona
y es divertido en otros juegos, no inventarlo desde cero.

## 1. Dónde mirar
- **Colonias y gestión:** RimWorld, Dwarf Fortress, Oxygen Not Included, Banished, Going Medieval, Timberborn.
- **Ecosistemas y vida salvaje:** Equilinox, Eco, Terra Nil, Planet Zoo, WorldBox, Ecosystem, The Sapling, Spore (fase de criatura).
- **Criaturas con personalidad:** Creatures, Black & White, Niche, Ancestors.
- **Comportamiento real:** la etología de la especie (cómo vive, come, se agrupa, se reproduce y huye),
  para que lo que se copie de un juego sea creíble.

Busca en la web (wikis de los juegos, análisis, postmortems, foros de modding) y no te fíes solo de lo que recuerdas.

## 2. Qué sacar
- Necesidades y cómo se cubren (y qué pasa cuando no).
- Reacciones a amenazas, al clima y al jugador.
- Vida social: grupos, jerarquía, crías, duelo, rivalidad.
- Cómo se le enseña al jugador lo que siente el animal sin abrumarle (estados, animaciones, diario).
- Lo que los jugadores critican (comportamientos tontos, microgestión, problemas de rendimiento con muchos animales).

## 3. Cómo adaptarlo a Sandworld
- Respeta `docs/sandworld/decisiones.md` (lo que ya está decidido no se cambia sin preguntar).
- Si es natural para muchos animales, va al **comportamiento común**; la especie solo aporta parámetros
  (registro y temperamento). Nada de lógica escrita para una sola especie.
- Ten en cuenta el coste en móvil: cuántos animales y cada cuánto se calcula.
- Encaja con el riesgo doble del equilibrio (superpoblación → hambruna; grupos pequeños → vulnerables).

## 4. Cómo presentárselo a Gabriel
Antes de programar nada, una lista breve:

| Mecánica | Juego o fuente | Cómo quedaría en Sandworld | Común o de la especie | Coste |
|---|---|---|---|---|

Después, tu recomendación (qué meter ahora, qué dejar para más adelante) y las fuentes enlazadas.
Gabriel elige; con eso se hace la lista de tareas.
