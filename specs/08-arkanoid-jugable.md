# SPEC 08 — ARKANOID jugable con leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-09
> **Objetivo:** Portar `references/started-games/04-arkanoid/` (núcleo + power-ups) a un motor TypeScript, hacerlo jugable en `/jugar/arkanoid` y guardar sus puntajes en el leaderboard de `/salon`.

---

## Por qué existe esta spec

Arkanoid hoy solo existe en `references/started-games/04-arkanoid/` como un `game.js` de ~540 líneas con globals, acceso directo a `document` (`getElementById('game')`), listeners de `window` sin retirar, HUD propio dibujado en el canvas (puntos, nivel, récord, bolas), overlays de PAUSA / GAME OVER / VICTORIA, menú de pausa con volumen, sonido con `Audio`, récord en `localStorage` y un spritesheet cargado por rutas relativas; no se puede montar tal cual en React. En el catálogo solo está la maqueta simulada `bloque-buster`, que esta spec **no convierte**: se crea un juego nuevo `arkanoid` y la maqueta se oculta. Se reutilizan el contrato `GameEngine` (SPEC 05), el guardado y el leaderboard (SPEC 06) y el tamaño de canvas por motor (`EngineEntry`, SPEC 07), que ya existe en `lib/engines/types.ts`.

---

## Alcance

**Dentro:**

- **Motor** `lib/engines/arkanoid.ts`: port a TypeScript estricto, sin globals ni acceso a `document`, con las reglas del original:
  - Canvas 800×600; paleta de 81×14 px a `y = 560` que se mueve a 500 px/s y no sale del canvas.
  - Bola de radio 8 a velocidad constante de 360 px/s; pegada a la paleta hasta lanzarla con `Espacio` (30° desde la vertical, hacia la derecha).
  - Rebote en paleta según el punto de impacto: centro = vertical, borde = 60°. Rebote en paredes y techo; la bola se pierde al salir por abajo.
  - Rejilla de 10 columnas (bloques de 64×24 en `x = 80`, `y = 60`) y de 4 a 10 filas, generada al azar con una de 6 plantillas (`rect`, `pyramid`, `diamond`, `checker`, `stripes`, `frame`) y un color al azar por bloque entre 7 (`gray`, `red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`); la rejilla nunca queda vacía.
  - Los bloques grises aguantan 2 golpes (el segundo se dibuja con el sprite `grayLight`); los demás, 1. Cada golpe suma 10 puntos. Al romperse, el bloque ejecuta su animación de explosión de 4 frames (150 ms).
  - 10 niveles. Al limpiar uno se genera el siguiente (bola nueva pegada a la paleta, efectos limpios, puntos y reserva conservados) con el aviso `NIVEL N` durante 1,5 s. Al limpiar el décimo termina la partida (victoria).
  - Reserva de **3 bolas** (incluye la que está en juego); +1 bola cada 2000 puntos con el aviso `+1 BOLA` (varias si un golpe cruza varios umbrales). Al perder la última bola termina la partida.
  - Power-ups: 25 % de probabilidad de soltar una cápsula al romper un bloque, de tipo uniforme entre `XL`, `X3`, `L`, `SB`; caen a 150 px/s y se recogen con la paleta.
    - `XL`: paleta al doble de ancho (162 px) durante 30–40 s; no se acumula.
    - `X3`: añade tres bolas a −40°, 0° y 40° desde la posición de la primera bola.
    - `L`: láser durante 20 s; `Espacio` dispara dos rayos (enfriamiento de 300 ms, sin repetición de tecla); cada rayo resta 1 golpe al bloque más bajo que toca (+10 puntos) y desaparece.
    - `SB`: la bola más baja atraviesa los bloques durante 15 s, destruyéndolos enteros (+10 × golpes que le quedaban) sin rebotar; un SB nuevo traslada el efecto y reinicia los 15 s.
  - Controles: `←` `→` o `A` `D` mover, `Espacio` lanzar / disparar el láser.
- **Contrato de motor** que cumple `GameEngine`: estado en el closure; eventos `onScore/onLives/onLevel` solo cuando el valor cambia; `onGameOver` una sola vez; `pause/resume` (reinicia la marca de tiempo, `dt` máx. 1/30 s ≈ 33 ms, como el original); `end`; `destroy` retira los listeners de `window` y cancela el `requestAnimationFrame`.
- **Registro** en `ENGINES` (`lib/engines/index.ts`) como `arkanoid: { start: startArkanoid, width: 800, height: 600 }` y **entrada en `GAMES`** (`lib/games.ts`): `id: "arkanoid"`, título ARKANOID, categoría `ARCADE`, cover `cover-bricks`, color `yellow`.
- **Ocultar la maqueta**: se elimina la entrada `bloque-buster` de `GAMES`. Su fila en `games` y sus filas en `scores` **no se tocan**.
- **Tamaño de canvas** `800×600`: el contrato ya lo soporta (`EngineEntry`); solo se declara. Sin cambios en `GamePlayer`.
- **Fila en `games`** con `apply_migration`: `insert into public.games (id, title) values ('arkanoid', 'ARKANOID')`. `arkanoid` **no existe** hoy (verificado con `select id from public.games`); sin la fila el guardado falla por la FK de `scores`.
- **HUD de la plataforma**: `onScore` = puntaje; `onLives` = bolas de reserva (`ballsLeft`); `onLevel` = nivel 1–10. Se eliminan del canvas «Puntos», «Nivel», «Récord» y «Bolas», el récord en `localStorage`, el menú de pausa, los overlays PAUSA / GAME OVER / VICTORIA y la tecla `P`.
- **Información que se queda en el canvas**: banner `NIVEL N` / `+1 BOLA`, cápsulas, rayos, partículas de la bola perdida, temporizadores de efectos activos (`XL 12s`, `L 8s`, `SB 5s`, abajo a la izquierda) y la pista `ESPACIO PARA LANZAR` mientras la bola está pegada a la paleta.
- **Teclado seguro**: `preventDefault` de `←` `→` `Espacio` fuera de `<input>`/`<textarea>`; `A`/`D` solo se procesan fuera de campos de texto. Se vacía el estado de teclas al perder el foco de la ventana (`blur`).
- **Assets** en `public/games/arkanoid/`: `spritesheet-breakout.png` copiado desde `references/`. Las coordenadas del atlas (`SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`) se portan como constantes TypeScript dentro del motor; el motor carga la imagen con `Image` y arranca el loop en `onload`.

**Fuera de alcance (para otras specs):**

- Sonido (`ball-bounce.mp3`, `break-sound.mp3`), volumen y menú de pausa con ajustes.
- Récord local (`localStorage`); lo sustituye el leaderboard de `/salon`.
- Niveles infinitos, niveles diseñados a mano y más de 10 niveles.
- Conversión o limpieza de `bloque-buster` (se oculta, no se migra ni se borra).
- Un `cover-arkanoid` propio (se reutiliza `cover-bricks`).
- Controles táctiles o de ratón, HiDPI, multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

Sin tablas nuevas: se reutiliza `scores` (SPEC 06) con `game_id = 'arkanoid'`. Sí hay una fila nueva en `games`.

```ts
// lib/engines/arkanoid.ts
export const startArkanoid: GameEngine;

// lib/engines/index.ts
export const ENGINES: Record<string, EngineEntry> = {
  ...,
  arkanoid: { start: startArkanoid, width: 800, height: 600 },
};
```

Entrada de catálogo (`lib/games.ts`, tipo `Game` real):

```ts
{ id: "arkanoid", title: "ARKANOID", short: "Rompe el muro, atrapa cápsulas y no pierdas la bola.", long: "...", cat: "ARCADE", cover: "cover-bricks", color: "yellow" }
```

Migración:

```sql
insert into public.games (id, title) values ('arkanoid', 'ARKANOID') on conflict (id) do nothing;
```

Estado interno del motor (dentro del closure de `startArkanoid`):

```ts
type Block = {
  x: number;
  y: number;
  color: BlockColor;
  hits: number;
  exploding: boolean;
  explodeLeft: number;
};
type PowerupType = "XL" | "X3" | "L" | "SB";
// state: 'ready' | 'playing' | 'over'  (la pausa es del motor: flag interno vía pause()/resume())
```

Convenciones:

- `scores.game_id` = `Game.id` = clave de `ENGINES` = `'arkanoid'`.
- `onLives` = `ballsLeft` (reserva, incluye la bola en juego); se emite al iniciar y cada vez que cambia (pérdida de bola, bola extra).
- `onLevel` = nivel actual, 1–10; se emite al iniciar y en cada `startLevel`.
- `onGameOver(score)` se emite una sola vez, ya sea por perder la última bola, por limpiar el nivel 10 o por `end()` (botón FIN).
- La animación de explosión de bloques usa un temporizador en ms que se descuenta con `dt` (no `performance.now()`), para que la pausa la congele.
- Coordenadas: origen arriba a la izquierda; velocidades en px/s con `dt` en segundos.
- Tras `onGameOver` el motor deja de actualizar; el reinicio es solo "JUGAR DE NUEVO".

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (según `AGENTS.md`, esta versión de Next tiene cambios incompatibles). No cambia la interfaz de la plataforma, así que no hace falta `/frontend-design`.

1. **Assets.** Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` a `public/games/arkanoid/spritesheet-breakout.png`. Verificación: `npm run dev` y `http://localhost:3000/games/arkanoid/spritesheet-breakout.png` muestra la imagen.
2. **Motor: núcleo.** Crear `lib/engines/arkanoid.ts` con carga del spritesheet, paleta, bola, bloques, niveles aleatorios, puntos, reserva de bolas, bola extra, banner y eventos del contrato; sin power-ups. Verificación: `npm run build` y `npm run lint`.
3. **Motor: power-ups.** Añadir cápsulas `XL`/`X3`/`L`/`SB`, láser, partículas y temporizadores de efectos al mismo archivo. Verificación: `npm run build` y `npm run lint`.
4. **Registro y catálogo.** Registrar `arkanoid` en `ENGINES`; en `GAMES`, añadir `arkanoid` y quitar `bloque-buster`. Verificación: `/games` muestra la tarjeta ARKANOID y no `BLOQUE BUSTER`; `/juegos/arkanoid` abre.
5. **Base de datos.** `apply_migration` (`add_arkanoid_game`) con la fila en `games`. Verificación: `execute_sql` `select id from games where id = 'arkanoid'`.
6. **Integración.** Verificar que `GamePlayer` ejecuta el motor sin cambios y que el `setInterval` simulado no corre para `arkanoid`. Verificación: `/jugar/arkanoid` es jugable y `/jugar/invasores` (simulado) sigue igual.
7. **Verificación final.** `npm run lint`, `npm run build`, `get_advisors` (security) y partida completa en navegador: jugar, recoger los 4 power-ups, pausar, perder, guardar, ver `/salon`, jugar de nuevo y salir.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `ENGINES.arkanoid` existe con `width: 800` y `height: 600`; `/games` muestra la tarjeta ARKANOID y `/juegos/arkanoid` renderiza sin errores en consola.
- [ ] `/games` y `/salon` ya no muestran BLOQUE BUSTER; `/juegos/bloque-buster` deja de existir y `select count(*) from games where id = 'bloque-buster'` sigue en 1.
- [ ] `/jugar/arkanoid` muestra un canvas 800×600 con el muro, la paleta, la bola pegada a ella, el aviso `NIVEL 1` y la pista `ESPACIO PARA LANZAR`; el HUD marca puntaje 0, 3 vidas y nivel 01.
- [ ] `←` `→` y `A` `D` mueven la paleta sin salir del canvas; `Espacio` lanza la bola hacia arriba-derecha a 30° desde la vertical.
- [ ] La bola rebota en paredes y techo; en la paleta sale vertical si golpea el centro y a unos 60° si golpea el borde; su velocidad se mantiene en 360 px/s.
- [ ] Cada golpe a un bloque suma 10 puntos; un bloque gris necesita 2 golpes (pasa a gris claro tras el primero) y los demás 1; al romperse se anima la explosión.
- [ ] La rejilla tiene 10 columnas y entre 4 y 10 filas; niveles distintos muestran formas distintas.
- [ ] Perder la bola resta 1 al contador de vidas del HUD y deja una bola nueva pegada a la paleta; al perder la última se abre el modal "FIN DEL JUEGO".
- [ ] Al llegar a 2000 puntos el HUD suma 1 vida y el canvas muestra `+1 BOLA`; al cruzar 4000 vuelve a ocurrir.
- [ ] Al limpiar el muro el HUD pasa de nivel 01 a 02, aparece `NIVEL 2` y los puntos y vidas se conservan.
- [ ] Al limpiar el nivel 10 se abre el modal "FIN DEL JUEGO" con el puntaje acumulado, una sola vez.
- [ ] Una cápsula `XL` recogida ensancha la paleta a 162 px y la devuelve a 81 px entre 30 y 40 s después; otra `XL` recogida mientras está activa no la prolonga.
- [ ] Una cápsula `X3` recogida deja 3 bolas más en juego; perder una no resta vidas mientras quede alguna.
- [ ] Con `L` activa, `Espacio` dispara dos rayos, no más de uno cada 300 ms; cada rayo que da en un bloque suma 10 puntos y se detiene; a los 20 s deja de disparar.
- [ ] Con `SB` activa, la bola atraviesa los bloques sin rebotar y suma 10 × golpes restantes por bloque; a los 15 s vuelve a rebotar.
- [ ] Los temporizadores `XL`/`L`/`SB` aparecen abajo a la izquierda del canvas mientras el efecto está activo.
- [ ] El modal "FIN DEL JUEGO" se abre una sola vez por partida (por vidas, por victoria y por FIN) con el puntaje real; pulsar FIN con la bola pegada a la paleta también lo abre.
- [ ] PAUSA congela bola, cápsulas, rayos, explosiones y temporizadores; REANUDAR continúa sin saltos (la bola no atraviesa la paleta ni los bloques).
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con muro nuevo, puntaje 0, 3 vidas y nivel 1, sin listeners ni loops de la partida anterior (la bola no va al doble de velocidad ni el puntaje se duplica); salir de la página retira los listeners de `window`.
- [ ] Las teclas `←` `→` `Espacio` no desplazan la página y escribir espacios y letras (incluidas `A` y `D`) en el campo de iniciales del modal funciona.
- [ ] Soltar `←` / `→` fuera de la ventana (cambio de foco) no deja la paleta moviéndose sola al volver.
- [ ] `games` contiene la fila `arkanoid`.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'arkanoid'`, las iniciales y el puntaje del HUD.
- [ ] La pestaña ARKANOID de `/salon` muestra la fila guardada.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción 4:3.
- [ ] Asteroids y THETRIS siguen funcionando igual y los demás juegos simulados (p. ej. `/jugar/invasores`) no cambian.
- [ ] No quedan imports ni código en `app/`, `components/` ni `lib/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** port a módulo TypeScript con el contrato `GameEngine`; **No:** `<iframe>` ni pegar `game.js` en un `useEffect`.
- **Sí:** HUD de la plataforma alimentado por eventos; se eliminan HUD, menú de pausa y overlays del original.
- **Sí:** reutilizar el guardado y el leaderboard de SPEC 06 sin cambios.
- **Sí:** juego nuevo `arkanoid`. Decisión del usuario; **No:** convertir `bloque-buster`, aunque habría evitado migración y reutilizado `id` y fila.
- **Sí:** ocultar `bloque-buster` quitándolo de `GAMES`. Decisión del usuario, para no tener dos juegos de bloques en el catálogo. **No:** borrar su fila en `games` ni sus `scores`: la FK y el histórico quedan intactos y se puede reactivar con una línea.
- **Sí:** vidas = bolas de reserva y nivel real 1–10. Decisión del usuario; el HUD sigue sin cambios y muestra el dato más útil del juego. Con muchas bolas extra el HUD repetirá `♥` en varias filas; se acepta.
- **Sí:** núcleo + los 4 power-ups (`XL`, `X3`, `L`, `SB`). Decisión del usuario; son parte de la identidad del juego y están en la referencia.
- **No:** sonido, volumen y menú de pausa. Pedirían assets de audio, política de autoplay y persistencia de ajustes; van en otra spec.
- **Sí:** spritesheet copiado a `public/games/arkanoid/`, fiel al original. Decisión del usuario; **No:** rectángulos neón (menos fiel). El motor no arranca hasta que la imagen carga.
- **Sí:** cover `cover-bricks` y color `yellow`, para no crear CSS nuevo y distinguirlo de otros juegos cian.
- **Sí:** muerte de la última bola → `onGameOver` inmediato; **No:** esperar a que terminen las partículas de la explosión (el modal las taparía de todos modos).
- **Sí:** temporizador de explosión por `dt`; **No:** `performance.now()` del original, porque la pausa dejaría correr la animación.
- **Sí:** `dt` máx. 1/30 s como el original (cumple el tope de 50 ms de la plataforma).
- **Sí:** pista `ESPACIO PARA LANZAR` en el canvas; es una adición mínima porque sin el overlay del original el jugador no sabe cómo lanzar. **No:** más textos nuevos.
- **Sí:** la pausa es solo la de la plataforma; la tecla `P` se elimina para no tener dos caminos de pausa.
- **No:** récord local en `localStorage`; el leaderboard lo sustituye.
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo                                                              | Mitigación                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Doble montaje de StrictMode duplica loops y entrada                 | `destroy()` en el cleanup del `useEffect`; criterio de aceptación.                                                    |
| Falta la fila en `games` y el guardado falla por la FK              | Paso 5 del plan y criterio de aceptación.                                                                             |
| `dt` grande al reanudar o cambiar de pestaña                        | Reiniciar la marca de tiempo en `resume()`; tope de 1/30 s (la bola no debe atravesar paleta ni bloques).             |
| `preventDefault` bloquea el input de iniciales                      | Ignorar eventos cuyo `target` sea `input`/`textarea`.                                                                 |
| `onGameOver` se emite dos veces (fin natural y botón FIN)           | Bandera interna en el motor.                                                                                          |
| `destroy()` antes de que cargue el spritesheet arranca un loop      | Bandera `destroyed` comprobada en `onload`; `end()` emite `onGameOver` aunque la imagen no haya cargado.              |
| La imagen no carga (404) y el juego queda en negro                  | El motor registra `console.error` y no arranca; `end()`/FIN sigue funcionando. Se verifica en el paso 1.              |
| Estado de teclas atascado (`keyup` fuera de la ventana)             | Vaciar `keys` en `blur`.                                                                                              |
| La explosión del último bloque retrasa el cambio de nivel           | Conservar el comportamiento del original: el nivel avanza cuando la lista de bloques queda vacía tras la animación.   |
| Múltiples bolas (`X3`) con colisiones por frame                     | Conservar la lógica del original (un bloque por frame y bola; filtrado de bolas perdidas).                            |
| Diferencias de jugabilidad respecto al original                     | Conservar constantes y fórmulas; comparar con `references/started-games/04-arkanoid/index.html`.                      |
| Ocultar `bloque-buster` quita su pestaña de `/salon` y su página    | Aceptado por decisión del usuario; filas en `games`/`scores` intactas, reversible re-añadiendo la entrada a `GAMES`.  |
| El original mezcla lógica y DOM (`canvas`, `Audio`, `localStorage`) | Reemplazar cada llamada por eventos del contrato o eliminarla; ningún acceso a `document`/`localStorage` en el motor. |

---

## Qué **no** está en esta spec

- Sonido, volumen y menú de pausa con ajustes.
- Récord local en `localStorage`.
- Niveles infinitos, niveles diseñados y más de 10 niveles.
- Conversión, migración o borrado de `bloque-buster` (solo se oculta).
- Cover propio de Arkanoid.
- Controles táctiles o de ratón, HiDPI y multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
