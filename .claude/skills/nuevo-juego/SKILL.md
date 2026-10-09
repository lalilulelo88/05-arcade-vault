---
name: nuevo-juego
description: Genera la spec (specs/NN-slug.md, estado Borrador) para crear un juego jugable con leaderboard e integrarlo en Arcade Vault, a partir de una carpeta de references/started-games/ o de una descripción. No escribe código.
disable-model-invocation: true
argument-hint: "<carpeta de references/started-games/ o descripción del juego>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), mcp__supabase__list_tables, mcp__supabase__execute_sql
---

# /nuevo-juego — Spec de un juego con leaderboard

## Contexto de sesión

Fecha (úsala en el encabezado de la spec, no la adivines):
!`date +%F`

Specs existentes:
!`ls specs/`

Motores registrados:
!`cat lib/engines/index.ts`

Juegos de referencia disponibles:
!`ls references/started-games/`

---

Este skill **solo produce la spec**. No crea motores, no toca `lib/`, `components/` ni la base de datos. La implementación se hace después con `/spec-impl NN-slug`. Responde en español.

## Qué ya existe (no se re-especifica)

Por las specs 05 y 06, estas piezas funcionan para **cualquier** `game.id` y no necesitan cambios por juego:

- `GamePlayer` ejecuta el motor de `ENGINES[game.id]` y conecta HUD, pausa, FIN, modal y reinicio.
- El guardado inserta `{ game_id, name, score }` en `scores`.
- `/salon` genera una pestaña por cada entrada de `GAMES` y consulta `scores` por `game_id`.

Lo que **sí** hay que hacer por juego, y la spec debe cubrir siempre: motor, registro en `ENGINES`, entrada en `GAMES`, **fila en la tabla `games`** (sin ella el guardado falla por la FK) y, si aplica, assets.

## Fases (en orden estricto)

### Fase 1 — Contexto

1. **Lee primero la skill `/spec`**: `~/.claude/skills/spec/SKILL.md` y `~/.claude/skills/spec/template.md`. Es la referencia de cómo se crean los archivos de especificación en este proyecto (estructura, orden de secciones, estados, numeración, slug y reglas duras). Si no puedes leerla, avisa al usuario y no escribas la spec.
2. Lee `CLAUDE.md`, `specs/05-asteroids-juego-jugable.md` y `specs/06-leaderboard-y-tabla-games.md` (patrón, idioma y encabezados exactos), y `template.md` de este skill. Si la plantilla de `/spec` y la de este skill difieren, manda la de este skill en el contenido específico de juegos y la de `/spec` en formato y convenciones generales.
3. Lee `lib/engines/types.ts`, `components/game-player.tsx` y `lib/games.ts` (ids, `Category`, covers `cover-*` en `app/globals.css`). Anota si el contrato ya permite **tamaño de canvas por motor**; hoy `GamePlayer` fija 800×600.
4. Con `execute_sql` (solo lectura) consulta `select id from public.games`. Si el MCP falla, dilo y usa los ids de `lib/games.ts`.
5. Si `$ARGUMENTS` es una carpeta de `references/started-games/`, léela entera (`README.md`, `CLAUDE.md`, `index.html`, `game.js`, `style.css`, `assets/`) e inventaría:
   - globals y accesos a `document`/`getElementById`;
   - HUD, overlays, menús, selector de modo o tema propios (se eliminan o se mueven al HUD de la plataforma);
   - listeners (teclado, clic, `window`) y cómo se reinicia;
   - canvases, tamaños y paneles laterales;
   - assets y sonido;
   - constantes y reglas de juego, puntuación, vidas y niveles.
6. Si es una descripción sin referencia, no inventes reglas: pídelas en la Fase 2 (controles, puntuación, vidas/nivel, condición de fin).
7. Si `$ARGUMENTS` está vacío, pide una descripción en una frase.

### Fase 2 — Preguntas

Usa `AskUserQuestion` en bloques de 3 a 4, con tu recomendación primera. Cubre:

- **Entrada:** ¿juego nuevo o convertir uno simulado existente (p. ej. Tetris → `caida`, Arkanoid → `bloque-buster`)? Si se convierte, se reutilizan `id` y fila de `games`; decide qué hacer con sus puntajes aleatorios previos.
- **Catálogo:** `id` (slug estable, será `game_id`), título, categoría, color, `short`/`long`, cover (reutilizar `cover-*` o crear).
- **Canvas:** resolución del motor y qué se dibuja dentro (tablero, paneles siguiente/hold, etc.). Si el contrato aún no admite tamaño por motor, la spec incluye ampliarlo.
- **HUD:** qué emite `onScore/onLives/onLevel`; qué significa "vidas" si el juego no las tiene; qué se queda en el canvas.
- **Alcance de la referencia:** sonido, temas, modos, habilidades, extras: dentro o fuera.
- **Assets:** irán a `public/games/<id>/`; nunca se importa desde `references/`.

Detente cuando puedas responder sin suponer: ¿qué archivos aparecen o cambian?, ¿cuál es el primer y el último paso?, ¿cómo se verifica? Todo lo que abra otra caja de Pandora (multijugador, táctil, sonido nuevo) se marca como fuera de alcance.

### Fase 3 — Redactar

Sigue las Fases 3 y 4 de `/spec` (ya leídas en la Fase 1):

1. Si la información está completa, escribe la spec entera y guárdala sin pedir confirmación por secciones; si falta algo, vuelve a la Fase 2 en lugar de inventarlo. Si el usuario se saltó las preguntas, anótalo en "Decisiones" ("Definición rápida sin aclaración detallada").
2. Número `NN` = siguiente al mayor de `specs/`, con dos dígitos; archivo `specs/NN-<slug>.md` con slug kebab-case derivado del objetivo. Si el archivo ya existe, pregunta antes de escribir.
3. Rellena `template.md` completo, sin dejar marcadores. Cabecera: `Estado: Borrador`, `Depende de: SPEC 05, SPEC 06` (más las que correspondan; verifica que cada spec citada exista en `specs/`), fecha leída del contexto (nunca de memoria). Nunca la marques `Aprobado`.
4. Los **slots obligatorios** de la plantilla (contrato del motor, registro, `GAMES`, fila en `games`, tamaño de canvas, criterios y riesgos fijos) se conservan siempre; adapta su contenido al juego.
5. Los criterios de aceptación deben ser comprobables y específicos del juego (reglas, puntos, controles de la referencia), no genéricos.
6. Si `specs/.spec-config.yml` no existe, créalo con el contenido por defecto que define `/spec` (`AutoCreateBranch: true`); si existe, no lo toques.
7. Guarda con `Write`. Nunca escribas código en este comando.

### Fase 4 — Cierre

Confirma como en `/spec`: muestra la ruta, recuerda que está en `Borrador`, un resumen de 5 líneas y las decisiones abiertas, si las hay. Indica: revisar la spec, cambiar `Estado` a `Aprobado` y ejecutar `/spec-impl NN-<slug>`. No implementes nada.
