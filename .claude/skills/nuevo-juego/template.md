# SPEC NN — <TÍTULO> jugable con leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** <YYYY-MM-DD>
> **Objetivo:** Portar `<references/started-games/...>` (o implementar <juego>) a un motor TypeScript, hacerlo jugable en `/jugar/<id>` y guardar sus puntajes en el leaderboard de `/salon`.

---

## Por qué existe esta spec

<Estado actual del juego: simulado / solo en references. Qué impide montarlo tal cual (globals, HUD propio, `document`, listeners). Mencionar que reutiliza el contrato `GameEngine` (SPEC 05) y el guardado/leaderboard (SPEC 06).>

---

## Alcance

**Dentro:**

- **Motor** `lib/engines/<id>.ts`: port a TypeScript estricto, sin globals ni acceso a `document`, con las reglas del original:
  - <reglas, puntuación, vidas, niveles>
  - Controles: <teclas>
- **Contrato de motor** que cumple `GameEngine`: estado en el closure; eventos `onScore/onLives/onLevel` solo cuando el valor cambia; `onGameOver` una sola vez; `pause/resume` (reinicia la marca de tiempo, `dt` máx. 50 ms); `end`; `destroy` retira listeners de `window` y cancela el `requestAnimationFrame`.
- **Registro** en `ENGINES` (`lib/engines/index.ts`) y **entrada en `GAMES`** (`lib/games.ts`): `id`, título, categoría, descripciones, cover, color.
- **Tamaño de canvas** `<W>×<H>`: <si el contrato ya lo soporta, solo declarar; si no, ampliar `ENGINES` a `{ start, width, height }` y hacer que `GamePlayer` use `width/height` y `aspect-ratio`, dejando Asteroids en 800×600>.
- **Fila en `games`** con `apply_migration`: `insert into public.games (id, title) values ('<id>', '<TÍTULO>')` <omitir si el id ya existe>. Sin ella el guardado falla por la FK de `scores`.
- **HUD de la plataforma**: se elimina el HUD/overlay/menús del original; <qué se conserva en el canvas>.
- **Teclado seguro**: `preventDefault` de las teclas de juego solo fuera de `<input>`/`<textarea>`.
- **Assets** en `public/games/<id>/` <si aplica>.

**Fuera de alcance (para otras specs):**

- <sonido / temas / modos / habilidades del original>
- Controles táctiles, HiDPI, multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

Sin tablas nuevas: se reutiliza `scores` (SPEC 06) con `game_id = '<id>'`.

```ts
// lib/engines/<id>.ts
export const start<Nombre>: GameEngine;

// lib/engines/index.ts
export const ENGINES = { ..., "<id>": start<Nombre> };
```

Entrada de catálogo:

```ts
{ id: "<id>", title: "<TÍTULO>", short: "...", long: "...", cat: "<CATEGORÍA>", cover: "<cover-*>", color: "<color>", best: 0, plays: "0" }
```

Convenciones:

- `scores.game_id` = `Game.id` = clave de `ENGINES`.
- <Qué significa `onLives` / `onLevel` en este juego.>
- Tras `onGameOver` el motor deja de actualizar; el reinicio es solo "JUGAR DE NUEVO".

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (según `AGENTS.md`, esta versión de Next tiene cambios incompatibles) y aplicar `/frontend-design` si cambia la interfaz.

1. **Contrato.** <Ampliar tamaño por motor, o "sin cambios".> Verificación: `npm run build`.
2. **Motor.** Crear `lib/engines/<id>.ts` portando `<ruta>/game.js`. Verificación: `npm run build` y `npm run lint`.
3. **Registro y catálogo.** `ENGINES` + entrada en `GAMES`. Verificación: aparece en `/games`; `/juegos/<id>` abre.
4. **Base de datos.** `apply_migration` con la fila en `games`. Verificación: `execute_sql` `select id from games where id = '<id>'`.
5. **Integración.** <Cambios en `GamePlayer` si los hay.> Verificación: `/jugar/<id>` jugable.
6. **Verificación final.** `npm run lint`, `npm run build`, `get_advisors` (security) y partida completa en navegador: jugar, pausar, perder, guardar, ver `/salon`, jugar de nuevo y salir.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `ENGINES["<id>"]` existe y `/games` muestra la tarjeta; `/juegos/<id>` renderiza sin errores en consola.
- [ ] `/jugar/<id>` muestra el canvas `<W>×<H>` y el HUD en estado inicial (puntaje 0, vidas, nivel 1).
- [ ] <Criterios específicos: controles, reglas, puntos por evento, fin de partida>.
- [ ] El modal "FIN DEL JUEGO" se abre una sola vez por partida (por vidas/condición de fin y por FIN) con el puntaje real.
- [ ] PAUSA congela el juego; REANUDAR continúa sin saltos.
- [ ] "JUGAR DE NUEVO" empieza de cero sin listeners ni loops de la partida anterior; salir de la página retira los listeners de `window`.
- [ ] Las teclas de juego no desplazan la página y escribir en el campo de iniciales funciona.
- [ ] `games` contiene la fila `<id>`.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = '<id>'`, las iniciales y el puntaje del HUD.
- [ ] La pestaña `<TÍTULO>` de `/salon` muestra la fila guardada.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción.
- [ ] Los demás juegos (incluido Asteroids) siguen funcionando igual.
- [ ] No quedan imports ni código en `app/`, `components/` ni `lib/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** port a módulo TypeScript con el contrato `GameEngine`; **No:** `<iframe>` ni pegar `game.js` en un `useEffect`.
- **Sí:** HUD de la plataforma alimentado por eventos; se eliminan HUD y overlays del original.
- **Sí:** reutilizar el guardado y el leaderboard de SPEC 06 sin cambios.
- **Sí/No:** <decisiones del usuario de la Fase 2, una por línea, con su motivo>.
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo                                                    | Mitigación                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Doble montaje de StrictMode duplica loops y entrada       | `destroy()` en el cleanup del `useEffect`; criterio de aceptación. |
| Falta la fila en `games` y el guardado falla por la FK    | Paso 4 del plan y criterio de aceptación.                          |
| `dt` grande al reanudar o cambiar de pestaña              | Reiniciar la marca de tiempo en `resume()`; tope de 50 ms.         |
| `preventDefault` bloquea el input de iniciales            | Ignorar eventos cuyo `target` sea `input`/`textarea`.              |
| `onGameOver` se emite dos veces (fin natural y botón FIN) | Bandera interna en el motor.                                       |
| Diferencias de jugabilidad respecto al original           | Conservar constantes y fórmulas; comparar con `<ruta>/index.html`. |
| <Riesgos propios del juego>                               | <mitigación>                                                       |

---

## Qué **no** está en esta spec

- <Lista de lo excluido arriba.>

Cada uno, si se aborda, va en su propia spec.
