---
name: spec-impl-game
description: Implementa una spec aprobada de un juego igual que /spec-impl y, al terminar, lanza en secuencia (nunca en paralelo) los agentes skin-designer y luego mobile-porter sobre ese juego.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, SendMessage, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git switch:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(git add:*), Bash(git commit:*), Bash(cat:*), Bash(ls:*), Bash(npx tsc:*), Bash(npm run:*)
---

# /spec-impl-game — Implementa un juego + skins + móvil

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Configuración de ramas:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (por defecto, sin archivo de config)"`

---

Argumento recibido: `$ARGUMENTS`. Responde siempre en español.

## Fases 1–4 — Idénticas a `/spec-impl`

Lee `~/.agents/skills/spec-impl/SKILL.md` (`C:\Users\akats\.agents\skills\spec-impl\SKILL.md`) y sigue **sus Fases 1 a 4 al pie de la letra** con `$ARGUMENTS`: identificar la spec, validar que esté `Aprobado`, crear/cambiar a la rama `spec-NN-slug`, y la implementación paso a paso con pausas para revisar el diff. Sus reglas (bloqueo si no está aprobada, árbol limpio, no commitear sin que el usuario lo pida, no improvisar ante ambigüedades) aplican íntegras. Si no puedes leer ese archivo, avisa y detente.

Si la spec no es de un juego (no crea ni toca una entrada en `GAMES`/`ENGINES`), termina tras la Fase 4 y no lances ningún agente.

## Fase 5 — Cierre de la implementación

1. Verifica los criterios de aceptación uno a uno y ejecuta `npx tsc --noEmit`, `npm run lint` y `npm run build`. Si algo falla, corrige antes de seguir.
2. Pasa la spec a `Implementado`.
3. Los agentes crean su propia rama desde la actual, así que el árbol debe estar **limpio**: pide al usuario que haga commit de lo pendiente (o hazlo solo si lo pide). No continúes con cambios sin commitear.
4. Obtén el `game.id` de la spec (entrada en `GAMES` / `ENGINES`) y confírmalo con el usuario.

## Fase 6 — `skin-designer`

Lanza `Agent` con `subagent_type: "skin-designer"` indicando **solo ese `game.id`**, y espera su resultado completo.

1. El agente se detiene en `Borrador`: muestra al usuario su auditoría y la ruta de la spec `specs/NN-skins-<game-id>.md`, y pregunta si la aprueba.
2. Si aprueba, reanuda **el mismo agente** con `SendMessage` (confirmación explícita) para que la pase a `Aprobado` y la implemente. Si pide cambios, retransmítelos igual.
3. Al terminar, muestra rama, commits y verificaciones (incluye lo que falló u omitió).

## Fase 7 — `mobile-porter`

**Solo cuando la Fase 6 haya terminado por completo.** Nunca lances ambos agentes en el mismo mensaje ni en paralelo: el segundo parte desde la rama y el árbol que dejó el primero.

Mismo flujo: `Agent` con `subagent_type: "mobile-porter"` y el mismo `game.id`, retransmite la auditoría y la spec `specs/NN-mobile-<game-id>.md` en `Borrador`, espera la confirmación del usuario y reanuda con `SendMessage` para que implemente.

Si el usuario rechaza una fase, anótalo y pregunta si continúa con la siguiente o se detiene.

## Resumen final

Lista las ramas (`spec-NN-slug`, `spec-NN-skins-<id>`, `spec-NN-mobile-<id>`), las specs y los resultados de verificación de cada etapa. No hagas push, PR ni merge salvo que el usuario lo pida.
