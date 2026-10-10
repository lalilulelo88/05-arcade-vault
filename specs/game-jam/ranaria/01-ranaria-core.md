# SPEC — RANARIA (Frogger) jugable con leaderboard

> **Estado:** Borrador
> **Depende de:** 05-asteroids-juego-jugable, 06-leaderboard-y-tabla-games, 07-tetris-caida-jugable
> **Fecha:** 2026-10-10
> **Objetivo:** Convertir la maqueta `ranaria` en un Frogger jugable (cruzar carretera y río hasta los nenúfares) como motor de canvas con puntajes en el leaderboard de `/salon`.

## Scope

**In:**

- Motor `lib/engines/ranaria.ts` (TypeScript estricto, contrato `GameEngine`, estado en el closure, sin `document`).
- Canvas **624x624**, rejilla **13x13 de 48 px**, origen arriba a la izquierda. Filas (0 = arriba):
  - 0: meta con 5 nenúfares (columnas 1, 3, 6, 9, 11 como huecos; el resto es seto mortal).
  - 1-5: río (5 carriles de troncos y tortugas, direcciones alternas).
  - 6: franja segura central.
  - 7-11: carretera (5 carriles de coches/camiones, direcciones alternas).
  - 12: salida segura (la rana nace en columna 6).
- Control: `←` `↑` `→` `↓` o `A` `W` `D` `S`. Un salto de una celda por pulsación (se ignora la repetición de tecla mantenida). Entrada ignorada mientras el salto anterior se anima (80 ms).
- Obstáculos: objetos rectangulares de ancho en celdas, velocidad en celdas/s y separación fija por carril, que se envuelven al salir del lienzo. Datos de carriles en una constante `LANES` (nivel 1, ver spec 02 para escalado).
- Río: la rana debe estar sobre un tronco o tortuga; mientras está encima se mueve con él. Si la posición x sale del tablero (< 0 o > 13 celdas) muere.
- Muerte por: colisión con vehículo, agua, salir del tablero montada, seto de la meta, nenúfar ya ocupado, tiempo agotado.
- Tiempo: 30 s por rana (acumulado con `dt`), barra dibujada en el canvas.
- Puntaje: +10 por cada fila nueva más lejana alcanzada en la vida actual, +50 por nenúfar, +10 por cada segundo entero restante al llegar. Llenar los 5 nenúfares: +1000 y nivel + 1 (los nenúfares se vacían). En esta spec el nivel solo cambia el contador; el escalado de dificultad es la spec 02.
- Vidas: 3. Al morir se descuenta, se muestra una pausa de 600 ms con la rana "aplastada" y reaparece. A 0 vidas: `onLives(0)` y luego `onGameOver(score)`.
- Eventos: `onScore/onLives/onLevel` solo si cambia el valor (se emiten al iniciar con 0, 3, 1). `onGameOver` una sola vez (muerte final o `end()`).
- Render vectorial (rectángulos y círculos) con colores por tipo; sin sprites. Pista `PULSA UNA FLECHA PARA EMPEZAR` en estado `ready`.
- Registro en `ENGINES` (`lib/engines/index.ts`): `ranaria: { start: startRanaria, width: 624, height: 624 }`.
- Actualizar la entrada existente `ranaria` en `lib/games.ts`: mantiene `id`, `title`, `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`; se reescriben `short`/`long`.
- Migración que borra los puntajes aleatorios de la maqueta.
- Teclado seguro: `preventDefault` de flechas fuera de `<input>/<textarea>`; WASD ignoradas en campos de texto; se limpia la entrada en `blur`.

**Fuera de alcance:**

- Escalado de dificultad, tortugas que se sumergen y cocodrilos (spec 02).
- Sonido y animaciones elaboradas (spec 03).
- Controles táctiles/mobile.
- Supabase Auth/RLS y `user_id` en `scores`.
- Realtime en el leaderboard.
- Cover propio (se reutiliza `cover-rana`), multijugador, HiDPI, tests automatizados (no hay framework).
- Nuevas rutas o componentes: se reutiliza `GamePlayer` en `/jugar/ranaria`.

## Data model

Sin tablas nuevas: se reutiliza `scores` (`game_id`, `name`, `score`) con `game_id = 'ranaria'`. La fila de `games` ya existe; se actualizan los textos y se limpian los puntajes:

```sql
update public.games
set short = 'Cruza la carretera y el río sin hacerte papilla.',
    long  = 'Salta entre coches y camiones, sube a troncos y tortugas y llega a los cinco nenúfares antes de que se acabe el tiempo. Tienes tres vidas: un coche, el agua o el reloj te cuestan una.'
where id = 'ranaria';

delete from public.scores where game_id = 'ranaria';
```

(El `UPDATE` es equivalente al INSERT de siete campos `id, title, short, long, cat, cover, color`: la fila ya existe con `title='RANARIA'`, `cat='ARCADE'`, `cover='cover-rana'`, `color='green'`.) `short` mide menos de 60 caracteres.

```ts
// lib/engines/ranaria.ts
export const startRanaria: GameEngine;

// lib/engines/index.ts
ranaria: { start: startRanaria, width: 624, height: 624 },

// interno al closure
type Kind = "car" | "truck" | "log" | "turtle";
type Lane = { row: number; kind: Kind; dir: 1 | -1; speed: number; width: number; gap: number; count: number };
type Obstacle = { x: number; lane: number }; // x en celdas (float)
// state: 'ready' | 'playing' | 'dying' | 'over'; frog: { col: number; x: number; row: number }
```

Contrato de plataforma equivalente a la plantilla `<Name>GameProps`: `onScore`, `onLives`, `onLevel`, `onGameOver` llegan por `EngineEvents`; la pausa llega por `pause()/resume()` del `EngineHandle` (el motor no escucha P/Esc).

## Implementation plan

Antes del paso 1: leer la guía de Client Components en `node_modules/next/dist/docs/` (AGENTS.md).

1. **Motor: núcleo.** Crear `lib/engines/ranaria.ts` con loop `requestAnimationFrame` y `dt` máx. 50 ms, rejilla, `LANES`, movimiento y envoltura de obstáculos, salto con entrada. Verificación: `npm run build` y `npm run lint`.
2. **Colisiones y río.** Muerte por vehículo, agua, borde y transporte por troncos. Verificación: en `/jugar/ranaria` la rana se mueve con el tronco y muere en el agua.
3. **Meta, puntaje, tiempo y vidas.** Nenúfares, fila más lejana, bonus de tiempo, 3 vidas, nivel + 1 al llenar los 5, orden `onLives(0)` -> `onGameOver`. Verificación: puntajes del HUD coinciden con la tabla de Scope.
4. **Render.** Fondo por zonas, obstáculos por tipo, rana, barra de tiempo, nenúfares ocupados y pista inicial. Verificación visual.
5. **Registro y catálogo.** Registrar en `ENGINES` y actualizar `short`/`long` en `GAMES`. Verificación: `/games` muestra RANARIA; `/juegos/ranaria` abre.
6. **Base de datos.** Aplicar el SQL con `apply_migration` (`ranaria_playable`). Verificación: `select count(*) from scores where game_id='ranaria'` = 0 y la fila de `games` tiene el nuevo texto.
7. **Integración.** Comprobar que `GamePlayer` ejecuta el motor sin cambios, que guarda con "GUARDAR PUNTUACIÓN" y que aparece en `/salon`. Verificación: partida completa; los demás juegos no cambian.
8. **Verificación final.** `npm run lint`, `npm run build`, `npx tsc --noEmit`, `get_advisors` (security).

## Acceptance criteria

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `ENGINES.ranaria` existe con 624x624; `/games` muestra RANARIA y `/juegos/ranaria` renderiza sin errores de consola.
- [ ] `/jugar/ranaria` muestra la rejilla con rana en la salida, carretera, río, meta y la pista de inicio; HUD con puntaje 0, 3 vidas, nivel 01.
- [ ] Un salto = una celda; mantener la tecla no encadena saltos; las flechas no desplazan la página.
- [ ] Un vehículo que toca a la rana le cuesta una vida; el agua también; sobre un tronco la rana se desplaza con él.
- [ ] Salir del tablero montado en un tronco mata a la rana.
- [ ] Saltar al seto o a un nenúfar ocupado mata; saltar a un hueco libre ocupa el nenúfar, suma 50 + 10 por segundo restante y reaparece una rana nueva.
- [ ] Avanzar a una fila nunca alcanzada suma 10 una sola vez por vida.
- [ ] Al agotar los 30 s muere la rana.
- [ ] Llenar los 5 nenúfares suma 1000, sube el nivel a 02 y vacía los nenúfares.
- [ ] Con 0 vidas se emite `onLives(0)` antes de `onGameOver(score)`; el modal se abre una sola vez (también con el botón FIN, incluso en `ready`).
- [ ] PAUSA congela obstáculos, reloj y animación; REANUDAR no produce saltos.
- [ ] "JUGAR DE NUEVO" reinicia sin duplicar loops ni listeners; salir de la página retira los listeners de `window`.
- [ ] Escribir letras (incluidas A, W, D, S) en el campo de iniciales del modal funciona.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'ranaria'`; la pestaña RANARIA de `/salon` la muestra y no hay filas de la maqueta.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción 1:1.
- [ ] Asteroids, THETRIS, ARKANOID, SERPENTINA y los juegos simulados siguen igual.

## Decisions

- **Sí: convertir `ranaria` (decisión del usuario)** — Razón: ya existe en catálogo y `games`; mismo precedente que SPEC 09. **No:** crear `frogger`, duplicaría el catálogo.
- **Sí: motor en `lib/engines` + `ENGINES` + `GamePlayer`** — Razón: es la arquitectura real; guardar con `name` en `scores`. **No:** `components/games/RanariaGame.tsx`, `app/games/<id>/play` ni `player_name`/`user_id`: no existen en el repo y duplicarían el reproductor.
- **Sí: HUD doble** — Razón: puntaje, vidas y nivel salen por eventos al HUD React de la plataforma; en el canvas solo se dibujan lo que el HUD no cubre (barra de tiempo, nenúfares ocupados, pista inicial). **No:** duplicar puntaje/vidas en el canvas.
- **Sí: pausa solo via `pause()/resume()`** — Razón: la gestiona el botón de la plataforma. **No:** P/Esc dentro del canvas.
- **Sí: 3 vidas** — Razón: mecánica original de Frogger (cada cruce fallido cuesta una rana). **No:** 1 vida, volvería el juego demasiado punitivo.
- **Sí: rejilla 13x13 cuadrada de 48 px** — Razón: salto discreto, colisiones simples y canvas cuadrado como SERPENTINA. **No:** movimiento libre.
- **Sí: render vectorial sin sprites** — Razón: no hay assets de Frogger y mantiene la spec sin dependencias. **No:** spritesheet.
- **Sí: borrar `scores` de `ranaria`** — Razón: son aleatorios de la maqueta y falsearían el ranking. **No:** conservarlos.
- **Sí: dificultad fija en esta spec** — Razón: separar el escalado en la spec 02. **No:** mezclar niveles aquí.
