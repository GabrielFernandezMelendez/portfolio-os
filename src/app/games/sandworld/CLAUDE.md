# Sandworld — reglas del proyecto

Simulador de ecosistemas en pixel art isométrico, dentro de Portfolio OS (Angular + TypeScript + PixiJS).
Móvil en vertical primero. Interfaz en español e inglés. Tono con humor ácido.

Antes de proponer nada, lee `docs/sandworld/` (hoja de ruta y decisiones de diseño).

## Cómo trabajamos (obligatorio)

1. **Lista de tareas antes de programar.** Propón el plan y espera a que Gabriel lo valide.
2. **Mockup antes de cualquier cambio visual** (capturas o GIF sobre el juego real, isométrico). Sin aprobación no hay código visual.
3. **Explica el porqué** de cada cambio, no solo el qué.
4. **Entrega por script** con commit (skill `sandworld-entrega`). Nada de diffs sueltos.
5. **Las especies se hacen de una en una:** mockup del sprite → aprobación → código.
6. **Comportamientos y mecánicas nuevas se investigan antes** en juegos parecidos (skill `sandworld-investigar`).
7. Lo que se decida para "la fase de pulido" se apunta en `docs/sandworld/decisiones.md`, no se hace ahora.

## Modular y escalable

El juego tiene que crecer a ~20 especies, decenas de plantas, arenas y cartas sin reescribir nada. Por eso:
- **Añadir contenido = añadir datos, no tocar lógica.** Una especie nueva es una entrada en `species.config.ts`,
  otra en `temperament.config.ts`, su dibujo y sus textos. Si para añadirla hay que meter un `if (especie === …)`
  en la lógica, el diseño está mal: se generaliza el sistema y el dato decide.
- **Comportamientos comunes, parámetros por especie.** Lo natural (espacio personal, miedo, sed, refugio, celo…)
  se escribe una vez para todos los animales; cada especie solo ajusta números y reacciones.
- **Un archivo, una responsabilidad.** Si un archivo crece mezclando cosas (p. ej. decidir y moverse), se parte
  en módulos pequeños (`needs.ts`, `breeding.ts`, `reactions.ts`…).
- **Sistemas desacoplados.** Se comunican por puertos, eventos y estímulos, no llamándose por dentro. Un sistema
  nuevo (depredación, enfermedades…) se enchufa sin cambiar los que ya existen.

## Gameplay emergente

Buscamos lo de Dwarf Fortress y RimWorld: que la historia nazca sola de sistemas sencillos que se cruzan, y que
cada individuo, aunque vaya en grupo, no sea una copia de los demás.
- **Nada pasa el 100 % de las veces.** Cada decisión de un animal (seguir al grupo, separarse, volver, huir, ir a
  mirar...) es una **probabilidad**, no una regla fija. Las probabilidades viven en el registro de cada especie
  (`config/`), nunca escritas a mano en la lógica, y se tiran con `RandomSource` (así los tests son repetibles).
- **Cada individuo decide por su cuenta**: en una misma situación, unos hacen una cosa y otros otra.
- **Lo que pasa se cuenta**: diario y crónica, para que el jugador pueda reconstruir la historia.
- Los tests de comportamiento comprueban **proporciones** en muchas tiradas (p. ej. "entre el 15 y el 35 % se
  separa"), no un resultado concreto.

## Arquitectura (hexagonal)

```
src/app/games/sandworld/
  domain/          modelos, eventos y puertos. No importa nada de fuera (ni Angular, ni Pixi).
    models/  events/  ports/
  application/     la simulación: lógica pura que solo habla con el mundo a través de puertos.
    physics/ water/ fire/ vegetation/ fauna/ climate/ world/ sands/ chronicle/ time/ indicators/
  config/          registros y constantes de equilibrio. TODO lo ajustable vive aquí.
  infrastructure/  adaptadores técnicos (azar con semilla, almacenamiento, entrada táctil).
  rendering/       Pixi: solo LEE el estado y lo dibuja. Nunca cambia la simulación.
  ui/              Angular con diseño atómico: atoms/ molecules/ organisms/
  i18n/            es.json y en.json (mismas claves en los dos).
  sandworld.service.ts   raíz de composición de la lógica y estado para la interfaz (signals).
  sandworld-runtime.ts   raíz de composición del render (motor, cámara, capas, entrada).
```

Reglas de dependencias:
- `domain` no depende de nadie. `application` depende de `domain` y `config`. `rendering` y `ui` leen de `application` y `domain`, nunca al revés.
- La simulación habla con el mundo por **puertos** (p. ej. `FaunaWorld`) y el azar por `RandomSource`: así se prueba sin Pixi ni Angular, con mundos de mentira.
- El estado del mundo (celdas, agua, plantas, animales) va en arrays tipados y objetos de dominio, **no en signals**. La interfaz recibe fotos (p. ej. `AnimalView`).

## Rendimiento

Es importante desde ya, porque el objetivo es móvil:
- Nada de trabajo por frame que pueda hacerse por minuto de juego, ni por minuto lo que pueda hacerse por día.
- Búsquedas acotadas por radio (nunca recorrer el mapa entero por animal), cachés de texturas, sin crear objetos en bucles calientes.
- La interfaz se refresca a ritmo de juego (p. ej. cada 30 minutos) o por eventos, no cada frame.
- Cuando Gabriel pregunte por el rendimiento, se mide primero (dónde se va el tiempo) y se proponen optimizaciones concretas.

## Convenciones

- **Comentarios en español** (el inglés es un paso final, más adelante). Comentarios que explican el porqué.
- **Textos siempre en i18n**, en `es.json` y `en.json` con las mismas claves. Un parámetro que empieza por `@` es otra clave que también se traduce (`{ food: '@plant.oak' }`).
- **Valores de equilibrio marcados como [PROPUESTA]** en `config/`: se afinan jugando en la fase de pulido.
- **Sprites generados por código** (piezas + pose, luz arriba a la izquierda, contorno selectivo), no imágenes.
- **Botones de prueba** en Ajustes (`config/dev.config.ts`), con su texto en i18n y su caso en `SandworldService.runDevAction`.
- **Pruebas:** la que manda es la **prueba manual en el juego** de Gabriel; cada entrega incluye la lista de pruebas a hacer.
  Los tests automáticos (`*.spec.ts`) acompañan a la lógica, pero no bloquean una entrega: un test puede estar
  mal hasta que la prueba manual confirma el comportamiento. Si fallan, se avisa y se corrigen después de validar.
  Lo que sí es obligatorio es que **compile** (build sin errores).

## Comandos

```bash
ng serve                                   # desarrollo (párralo antes de aplicar un script de entrega)
ng test                                    # tests
ng build --configuration production        # build de producción
firebase deploy --only hosting             # deploy (siempre DESPUÉS del build)
```

## Lo que NO se hace

- Nada de la carpeta del juego importa del resto del portfolio (el juego tiene que poder salir tal cual, p. ej. a Ionic).
- No se enseñan al jugador los números internos de la simulación (cuánto miedo exacto, la vida que le queda a uno).
  Lo que se muestra está en `docs/sandworld/decisiones.md`.
- No se adelanta trabajo de fases futuras sin pedirlo.
