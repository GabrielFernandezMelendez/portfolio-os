---
name: sandworld-entrega
description: Cómo entregar a Gabriel un bloque de cambios de Sandworld (script de Git Bash, commit, push y deploy). Úsala al terminar cualquier bloque de código del juego.
---

# Entrega de un bloque de Sandworld

Gabriel aplica los cambios en Windows con Git Bash, desde la raíz de `portfolio-os`. Nunca le pases diffs sueltos.

## 1. Antes de entregar
- El build de producción compila sin errores (obligatorio).
- Pasa los tests y, si alguno falla, díselo y explica por qué (no bloquea: manda la prueba manual).
- Si el bloque es visual, el mockup ya está aprobado.
- Revisa que no añade trabajo caro por frame (ver "Rendimiento" en CLAUDE.md).

## 2. El script
- Un solo archivo `sandworld-<bloque>-<tema>.sh` (p. ej. `sandworld-f5c-comportamiento.sh`), que se guarda en la
  raíz de `portfolio-os`.
- Empieza con `set -e` y comprueba que se ejecuta desde la raíz (`test -d src/app/games/sandworld`).
- Crea las carpetas nuevas con `mkdir -p`.
- Cada archivo cambiado va **completo** con un heredoc entre comillas (`cat > ruta <<'SANDWORLD_EOF'`), así no se
  interpreta nada. Si un archivo se elimina, `rm -f` con un comentario.
- Termina con `echo "<qué se ha aplicado>: N archivos"`.
- Se genera contra lo que Gabriel tiene en el repo (rama `feat/sandworld`), solo con lo que cambia.
- Compruébalo tú antes: aplicado sobre una copia del repo, el resultado tiene que ser idéntico a tu versión
  (sin diferencias, ni de saltos de línea al final). El hash es para tu comprobación; a Gabriel no hace falta dárselo.

## 3. Lo que le das a Gabriel
1. El script `.sh` (como archivo) y dónde guardarlo.
2. Los comandos, en este orden y con `ng serve` parado:
   ```bash
   bash sandworld-<...>.sh
   rm sandworld-<...>.sh
   git add src/app/games/sandworld
   git commit -m "feat(sandworld): ..."
   git push
   ```
   El commit en español, con una lista de lo que cambia.
3. El deploy, siempre después del build:
   ```bash
   ng build --configuration production
   firebase deploy --only hosting
   ```
4. La lista de pruebas para hacer en el juego (qué hacer y qué debería pasar).

## 4. Después
- Si Gabriel hace push, comprueba en el repo que la carpeta del juego coincide con tu versión.
- Si pega la salida del deploy, comprueba que dice `Deploy complete!`.
- Los avisos `LF will be replaced by CRLF` son normales en Windows.
- Errores de `ng serve` a mitad de un script suelen ser de compilar a medio aplicar: se comprueban con un build.
