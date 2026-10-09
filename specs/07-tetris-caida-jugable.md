# SPEC 07 — THETRIS (antes CAÍDA) jugable con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 05, SPEC 06
> **Fecha:** 2026-10-09
> **Objetivo:** Portar `references/started-games/03-tetris/` (núcleo clásico) a un motor TypeScript, convertir la maqueta `caida` en un juego jugable en `/jugar/caida` y guardar sus puntajes en el leaderboard de `/salon`.

---

## Por qué existe esta spec

`caida` es hoy una simulación: el puntaje sube con un `setInterval` aleatorio (SPEC 05) y su pestaña de `/salon` solo tiene puntajes de prueba. El Tetris real vive en `references/started-games/03-tetris/` como un `game.js` de ~740 líneas con globals, acceso directo a `document` (`getElementById` de 5 canvases y ~15 elementos del HUD), un menú de modos, un menú de habilidades, overlay propio, tema claro/oscuro y sonido; no se puede montar tal cual en React. Esta spec reutiliza el contrato `GameEngine` (SPEC 05) y el guardado/leaderboard (SPEC 06), y además necesita **tamaño de canvas por motor**: el Tetris es vertical y hoy `GamePlayer` fija 800×600. Se porta solo el núcleo clásico; modos, habilidades, power-ups y piezas especiales del original quedan para otras specs.

---

## Alcance

**Dentro:**

- **Motor** `lib/engines/tetris.ts`: port a TypeScript estricto, sin globals ni acceso a `document`, con las reglas del núcleo clásico del original:
  - Tablero de 10×20 con bloque de 30 px; 7 piezas (I, O, T, S, Z, J, L) elegidas con `Math.random()` uniforme, como el original (sin bolsa de 7).
  - Rotación horaria (`↑` / `X`) con wall kicks `[0, -1, 1, -2, 2]`; ghost piece al 20 % de opacidad.
  - Caída automática cada `max(100, 1000 - (nivel - 1) * 90)` ms; soft drop `↓` (+1 punto por celda); hard drop `Espacio` (+2 puntos por celda).
  - Puntos por líneas simultáneas `[0, 100, 300, 500, 800] × nivel`; T-spin (regla de 3 esquinas, última acción = rotar) `[400, 800, 1200, 1600]` por 0–3 líneas, × nivel; back-to-back ×1,5 (Tetris o T-spin consecutivos); combo ×N desde el segundo clear seguido; perfect clear +2000 × nivel.
  - Nivel = `floor(líneas / 10) + 1`.
  - Hold (`C` / `Shift`) una vez por pieza; vista previa de la siguiente pieza.
  - Fin de partida cuando la pieza que aparece colisiona de inmediato (o al hacer hold y colisionar).
  - Controles: `←` `→` mover, `↑` / `X` rotar, `↓` bajar, `Espacio` caída, `C` / `Shift` reservar.
- **Contrato de motor** que cumple `GameEngine`: estado en el closure; eventos `onScore/onLives/onLevel` solo cuando el valor cambia; `onGameOver` una sola vez; `pause/resume` (reinicia la marca de tiempo, `dt` máx. 50 ms); `end`; `destroy` retira listeners de `window` y cancela el `requestAnimationFrame`.
- **Registro** en `ENGINES` (`lib/engines/index.ts`) y **entrada en `GAMES`** (`lib/games.ts`): se reutiliza `caida` (mismo `id` `caida`, categoría, cover `cover-tetro` y color); se renombra el título a THETRIS (como el original) y se actualiza `long`; el `id` no cambia porque es la clave de `scores.game_id`.
- **Tamaño de canvas** `480×600`: el contrato aún no lo soporta, así que se amplía `ENGINES` a `{ start, width, height }`; `GamePlayer` usa `width`/`height` del motor y `aspect-ratio` calculado, dejando Asteroids en 800×600.
- **Fila en `games`**: `caida` ya existe (verificado con `select id from public.games`), por lo que **no hay migración**.
- **Interfaz dentro del canvas** (480×600): tablero a la izquierda (300×600) y panel derecho de 180 px con **HOLD**, **NEXT**, **LÍNEAS** y **COMBO**. También el destello de texto de combos (`TETRIS`, `T-SPIN`, `B2B`, `COMBO xN`, `PERFECT CLEAR` con los puntos) durante 1,2 s, porque es información de juego sin equivalente en el HUD React.
- **HUD de la plataforma**: puntaje y nivel reales; se eliminan el HUD HTML, el overlay "GAME OVER / Reiniciar", el selector de modo, el menú de habilidades, el botón de tema y la lista de controles del original.
- **Teclado seguro**: `preventDefault` de `←` `↑` `→` `↓` `Espacio` fuera de `<input>`/`<textarea>`; las teclas `C`/`X`/`Shift` solo se procesan fuera de campos de texto.
- **Colores propios del motor**: los de las 7 piezas del original (paleta `COLORS[1..7]`) sobre fondo transparente; el CRT de la plataforma aporta el fondo.

**Fuera de alcance (para otras specs):**

- Modos de desafío (`sprint`, `garbage`, `preset`, `invisible`, `inverse`), selector de modo.
- Energía y menú de habilidades (`peek`, `swap`, `slow`, `undo`, `hold` extra) y sus teclas `Q`/`1`–`5`.
- Piezas especiales (pentominós `+`, `U`, `Y`, 1×1, 3×3 hueca), recompensa 1×1 tras Tetris y power-ups (bomba, rayo, tinte, gravedad, congelar), `WILD` y `GARBAGE`.
- Sonido (`AudioContext`/beeps) y tema claro/oscuro del original.
- Tecla `P` de pausa: la pausa es el botón PAUSA de la plataforma.
- Bolsa de 7 piezas, auto-repetición de teclas (DAS/ARR), lock delay.
- Controles táctiles, HiDPI, multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Borrar el puntaje de prueba que ya hay en `scores` para `caida`.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

Sin tablas nuevas: se reutiliza `scores` (SPEC 06) con `game_id = 'caida'`.

```ts
// lib/engines/types.ts
export type EngineEntry = {
  start: GameEngine;
  width: number; // resolución interna del canvas
  height: number;
};

// lib/engines/tetris.ts
export const startTetris: GameEngine;

// lib/engines/index.ts
export const ENGINES: Record<string, EngineEntry> = {
  asteroids: { start: startAsteroids, width: 800, height: 600 },
  caida: { start: startTetris, width: 480, height: 600 },
};
```

Entrada de catálogo (`lib/games.ts`; cambian solo `short` y `long`):

```ts
{ id: "caida", title: "THETRIS", short: "Encaja las piezas antes de que el techo te aplaste.", long: "...", cat: "PUZZLE", cover: "cover-tetro", color: "magenta", best: 184220, plays: "31.8K" }
```

Convenciones:

- `scores.game_id` = `Game.id` = clave de `ENGINES` = `'caida'`.
- `onLives(1)` se emite una vez al iniciar: Tetris no tiene vidas y el HUD muestra `♥` fijo; la partida termina al desbordar el tablero.
- `onLevel` = `floor(líneas / 10) + 1`; `onScore` = puntaje acumulado (incluye soft/hard drop).
- El estado (tablero, pieza actual, cola, hold, combo, b2b, destello) vive dentro del closure de `startTetris`; no hay estado de módulo.
- Tras `onGameOver` el motor deja de actualizar; el reinicio es solo "JUGAR DE NUEVO".
- Layout del canvas 480×600: tablero en `x ∈ [0, 300]`; panel en `x ∈ [300, 480]` con HOLD y NEXT como cajas 4×4 de bloques de 30 px (120×120).
- `GamePlayer` calcula el `aspect-ratio` como `width / height` del motor; con 480×600 el canvas se ve más estrecho que Asteroids y queda centrado en `.crt-screen`.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (según `AGENTS.md`, esta versión de Next tiene cambios incompatibles) y aplicar `/frontend-design` en el ajuste del canvas vertical dentro de `.crt-screen`.

1. **Contrato.** Añadir `EngineEntry` a `lib/engines/types.ts`, cambiar `ENGINES` a `{ start, width, height }` con Asteroids en 800×600 y adaptar `GamePlayer` (`startEngine = ENGINES[game.id]?.start`, `width`/`height` del canvas y `aspect-ratio`). Verificación: `npm run build`; `/jugar/asteroids` se ve y juega igual.
2. **Motor.** Crear `lib/engines/tetris.ts` portando el núcleo de `references/started-games/03-tetris/game.js` (sin lo marcado fuera de alcance), con dibujo de tablero, ghost, panel HOLD/NEXT/LÍNEAS/COMBO y destello. Verificación: `npm run build` y `npm run lint`.
3. **Registro y catálogo.** Registrar `caida` en `ENGINES` y actualizar `short`/`long` de `caida` en `GAMES`. Verificación: `/games` muestra la tarjeta; `/juegos/caida` abre.
4. **Base de datos.** Confirmar que `caida` existe en `games`; no se aplica migración. Verificación: `execute_sql` `select id from games where id = 'caida'`.
5. **Integración.** Verificar que `GamePlayer` ejecuta el motor, que `onLives(1)` fija el HUD y que el `setInterval` simulado ya no corre para `caida`. Verificación: `/jugar/caida` es jugable y `/jugar/invasores` (simulado) sigue igual.
6. **Verificación final.** `npm run lint`, `npm run build`, `get_advisors` (security) y partida completa en navegador: jugar, pausar, perder, guardar, ver `/salon`, jugar de nuevo y salir.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `ENGINES.caida` existe con `width: 480` y `height: 600`; `/games` muestra la tarjeta THETRIS y `/juegos/caida` renderiza sin errores en consola.
- [ ] `/jugar/caida` muestra un canvas 480×600 con el tablero vacío de 10×20, la primera pieza cayendo, el panel HOLD vacío, NEXT con una pieza, y el HUD en puntaje 0, 1 vida y nivel 01.
- [ ] `←` `→` mueven la pieza una celda sin salir del tablero; `↑` y `X` la rotan en sentido horario, con wall kick contra las paredes.
- [ ] `↓` baja una celda y suma 1 punto por celda; `Espacio` hace caída instantánea, bloquea la pieza y suma 2 puntos por celda recorrida.
- [ ] El ghost muestra dónde aterrizará la pieza actual.
- [ ] `C` o `Shift` guarda la pieza en HOLD y saca la siguiente (o intercambia con la reservada); no se puede usar dos veces en la misma pieza (la caja HOLD se atenúa).
- [ ] Completar 1, 2, 3 y 4 líneas a la vez suma 100, 300, 500 y 800 × nivel (con combo = 0), y se eliminan las filas.
- [ ] Un T-spin con 3 de 4 esquinas ocupadas suma los puntos de T-spin y muestra el destello `T-SPIN`.
- [ ] Dos clears seguidos aplican combo ×N y el panel COMBO muestra `xN`; un bloqueo sin líneas lo reinicia a `-`.
- [ ] Dos Tetris (o T-spin con línea) consecutivos aplican ×1,5 y muestran `B2B`.
- [ ] Vaciar el tablero con un clear suma +2000 × nivel y muestra `PERFECT CLEAR`.
- [ ] Cada 10 líneas el HUD sube de nivel (01 → 02) y la caída se acelera 90 ms por nivel hasta un mínimo de 100 ms; el panel LÍNEAS muestra el total.
- [ ] Al apilar hasta que la pieza nueva colisiona al aparecer, se abre el modal "FIN DEL JUEGO" con el puntaje real, una sola vez por partida; pulsar FIN abre el mismo modal con el puntaje actual.
- [ ] PAUSA congela la pieza, el destello y el puntaje; REANUDAR continúa sin saltos (no cae varias filas de golpe).
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con tablero vacío, puntaje 0 y nivel 1, sin listeners ni loops de la partida anterior (la pieza no cae al doble de velocidad ni el puntaje se duplica); salir de la página retira los listeners de `window`.
- [ ] Las teclas `←` `↑` `→` `↓` `Espacio` no desplazan la página y escribir espacios y letras (incluidas `C` y `X`) en el campo de iniciales del modal funciona.
- [ ] `games` contiene la fila `caida` (sin cambios).
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'caida'`, las iniciales y el puntaje del HUD.
- [ ] La pestaña THETRIS de `/salon` muestra la fila guardada.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción 4:5.
- [ ] Asteroids sigue funcionando igual en 800×600 y los demás juegos simulados (p. ej. `/jugar/invasores`) no cambian.
- [ ] No quedan imports ni código en `app/`, `components/` ni `lib/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** port a módulo TypeScript con el contrato `GameEngine`; **No:** `<iframe>` ni pegar `game.js` en un `useEffect`.
- **Sí:** HUD de la plataforma alimentado por eventos; se eliminan HUD y overlays del original.
- **Sí:** reutilizar el guardado y el leaderboard de SPEC 06 sin cambios.
- **Sí:** convertir `caida` en lugar de crear `tetris`. Decisión del usuario; reutiliza `id`, fila de `games`, cover y evita dos Tetris en el catálogo.
- **No:** juego nuevo `tetris` con `caida` como maqueta aparte. Duplicaría el género en el catálogo.
- **Sí:** núcleo clásico solamente. Decisión del usuario; el original trae 6 modos, 5 habilidades, 5 power-ups y 4 piezas especiales, que juntos harían una spec demasiado grande.
- **No:** modos, habilidades, power-ups, piezas especiales, sonido y tema. Cada bloque va en su propia spec si se aborda.
- **Sí:** canvas 480×600 con tablero y paneles HOLD/NEXT/LÍNEAS/COMBO dentro. Decisión del usuario; hold y next se dibujan en el canvas, así el contrato de eventos no cambia.
- **Sí:** ampliar `ENGINES` a `{ start, width, height }`. Es el cambio mínimo para tamaño por motor; la alternativa de un tablero 300×600 con paneles en React exigiría eventos nuevos en el contrato.
- **No:** canvas de 800×600 con el tablero centrado. Desperdicia espacio y obliga a escalar a la baja en móviles.
- **Sí:** `onLives(1)` fijo y nivel real. Decisión del usuario; el HUD sigue sin cambios y Tetris no tiene vidas.
- **Sí:** selección de piezas con `Math.random()` uniforme, fiel al original. **No:** bolsa de 7; cambiaría la sensación de juego.
- **Sí:** la pausa es solo la de la plataforma; la tecla `P` del original se elimina para no tener dos caminos de pausa.
- **No:** borrar el puntaje de prueba que ya hay en `scores` para `caida` (1 fila). No es parte del juego; se puede borrar desde SQL cuando se quiera.
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo                                                    | Mitigación                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Doble montaje de StrictMode duplica loops y entrada       | `destroy()` en el cleanup del `useEffect`; criterio de aceptación.                              |
| Falta la fila en `games` y el guardado falla por la FK    | `caida` ya existe; paso 4 del plan y criterio de aceptación.                                    |
| `dt` grande al reanudar o cambiar de pestaña              | Reiniciar la marca de tiempo en `resume()`; tope de 50 ms (varias filas de golpe sería un bug). |
| `preventDefault` bloquea el input de iniciales            | Ignorar eventos cuyo `target` sea `input`/`textarea`.                                           |
| `onGameOver` se emite dos veces (fin natural y botón FIN) | Bandera interna en el motor.                                                                    |
| Diferencias de jugabilidad respecto al original           | Conservar constantes y fórmulas; comparar con `references/started-games/03-tetris/index.html`.  |
| Ampliar `ENGINES` rompe a Asteroids o a `GamePlayer`      | Paso 1 aislado con verificación en `/jugar/asteroids` antes de escribir el motor.               |
| Canvas vertical 4:5 desentona en `.crt-screen`            | Aplicar `/frontend-design`; centrar el canvas con `aspect-ratio` y verificar a 375 px.          |
| El original mezcla lógica y DOM (`updateHUD`, `overlay`)  | Reemplazar cada llamada por eventos del contrato o dibujo en canvas; ningún acceso a `document` |
| Soft drop `↓` y repetición de teclas del navegador        | Se procesa cada `keydown` (incluido el repetido) como en el original; DAS/ARR queda fuera.      |
| Puntaje de prueba previo de `caida` queda en el Salón     | Aceptado; una fila, borrable por SQL.                                                           |

---

## Qué **no** está en esta spec

- Modos de desafío, energía y habilidades del original.
- Piezas especiales, recompensas y power-ups.
- Sonido y tema claro/oscuro.
- Bolsa de 7, DAS/ARR y lock delay.
- Controles táctiles, HiDPI y multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Limpieza de puntajes de prueba existentes.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
