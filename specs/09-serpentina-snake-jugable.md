# SPEC 09 — SERPENTINA (Snake) jugable con leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-10-09
> **Objetivo:** Implementar Snake como motor TypeScript con las frutas de `references/source-assets/snake-assets/`, convertir la maqueta `serpentina` en un juego jugable en `/jugar/serpentina` y guardar sus puntajes en el leaderboard de `/salon`.

---

## Por qué existe esta spec

`serpentina` hoy es una maqueta: existe en `lib/games.ts` (cover `cover-snake`, color `green`) y en la tabla `games`, pero `GamePlayer` solo la simula con un `setInterval` aleatorio. A diferencia de Asteroids, Tetris y Arkanoid, **no hay juego de referencia** en `references/started-games/`: solo hay `references/source-assets/snake-assets/` con `fruits.png` (hoja de 3790×442 px con tres estilos de frutas) y `sprites.js` (atlas de la fila central, 22 frutas pixel-art). Las reglas se definen en esta spec y el motor se escribe desde cero. Se reutilizan el contrato `GameEngine` (SPEC 05), el guardado y el leaderboard (SPEC 06) y el tamaño de canvas por motor (`EngineEntry`, SPEC 07), que ya existe en `lib/engines/types.ts`.

---

## Alcance

**Dentro:**

- **Motor** `lib/engines/serpentina.ts`: TypeScript estricto, sin globals ni acceso a `document`, con estas reglas:
  - Canvas **800×800** (cuadrado) con rejilla de **20×20 celdas de 40 px** (400 celdas); origen arriba a la izquierda.
  - Serpiente inicial de 3 segmentos en el centro, apuntando a la derecha. Espera inmóvil hasta la primera tecla de dirección (estado `ready`); en ese estado la tecla opuesta a la dirección inicial (`←`) se ignora.
  - Movimiento por _ticks_ discretos de **140 ms constantes** (sin aceleración).
  - Controles: `←` `↑` `→` `↓` o `A` `W` `D` `S`. Cola de giros de máximo 2 entradas por tick; se descarta cualquier giro que sea la reversa de la dirección anterior encolada o actual.
  - Una sola fruta a la vez, en una celda libre al azar; el tipo se elige al azar entre las 22 del atlas y **no** cambia el puntaje.
  - Comer una fruta suma **10 puntos** y alarga la serpiente en 1 segmento.
  - **Sin niveles:** el nivel es siempre 1.
  - **Bordes toroidales:** al salir por un lado de la rejilla la cabeza entra por el lado opuesto; el muro no mata.
  - **Una vida.** Solo morderse a sí misma (la cabeza entra en una celda ocupada por el cuerpo) termina la partida. Llenar las 400 celdas también termina la partida (victoria) y no genera fruta nueva.
  - Mover hacia la celda que acaba de dejar la cola **no** es choque (la cola avanza en el mismo tick).
- **Render estilo slither.io**: segmentos circulares que se solapan (radio 17 px sobre celdas de 40 px), gradiente de color a lo largo del cuerpo (verde neón en la cabeza hacia un verde más oscuro en la cola), brillo con `shadowBlur`, cabeza algo más grande con dos ojos que miran en la dirección de avance, y movimiento **interpolado** entre ticks (la posición se dibuja con la fracción del tick acumulado, no a saltos). La lógica sigue siendo de rejilla; solo el dibujado es suave. Fondo oscuro con puntos tenues en cada centro de celda. Todo vectorial sobre canvas, sin sprites de serpiente.
- **Frutas con spritesheet**: `fruits.png` se copia a `public/games/serpentina/fruits.png` y las 22 coordenadas de `FRUITS` (`sprites.js`, fila `y = 136–295`) se portan como constante TypeScript en el motor. Cada fruta se dibuja escalada para caber en 36 px de alto conservando su proporción, centrada en su celda. El motor carga la imagen con `Image` y arranca el loop en `onload`.
- **Contrato de motor** que cumple `GameEngine`: estado en el closure; eventos `onScore/onLives/onLevel` solo cuando el valor cambia; `onGameOver` una sola vez; `pause/resume` (reinicia la marca de tiempo, `dt` máx. 50 ms); `end`; `destroy` retira listeners de `window` y cancela el `requestAnimationFrame`. El acumulador de ticks y la interpolación usan `dt`, de modo que la pausa los congela.
- **Registro** en `ENGINES` (`lib/engines/index.ts`) como `serpentina: { start: startSerpentina, width: 800, height: 800 }`.
- **Entrada en `GAMES`** (`lib/games.ts`): se **modifica** la entrada `serpentina` existente; mantiene `id`, `title`, `cat: "ARCADE"`, `cover: "cover-snake"` y `color: "green"`, y actualiza `short`/`long` para describir las reglas reales (frutas, bordes que se atraviesan, morderse mata).
- **Limpieza de puntajes**: migración con `apply_migration` que ejecuta `delete from public.scores where game_id = 'serpentina'`, para que el ranking empiece sin las filas aleatorias de la maqueta. La fila `serpentina` de `games` **no** se toca (ya existe; verificado con `select id from public.games`).
- **Tamaño de canvas** `800×800`: el contrato ya lo soporta; solo se declara. Sin cambios en `GamePlayer`: la pantalla CRT sigue siendo 4:3 y el canvas cuadrado se centra con `object-fit: contain`, dejando bandas negras a los lados (como THETRIS, 480×600).
- **HUD de la plataforma**: `onScore` = puntaje; `onLives` = `1` fijo (se emite al iniciar); `onLevel` = `1` fijo (se emite al iniciar). No se dibujan puntaje, nivel ni vidas en el canvas.
- **Información que se queda en el canvas**: la pista `PULSA UNA FLECHA PARA EMPEZAR` mientras el estado es `ready`.
- **Teclado seguro**: `preventDefault` de `←` `↑` `→` `↓` fuera de `<input>`/`<textarea>`; `A` `W` `D` `S` solo se procesan fuera de campos de texto. Se vacía la cola de giros al perder el foco de la ventana (`blur`).

**Fuera de alcance (para otras specs):**

- Sonido y música.
- Fruta bonus temporal, obstáculos, otros modos (muro mortal, 3 vidas), niveles y aceleración, y mapas.
- Récord local en `localStorage`; lo sustituye el leaderboard de `/salon`.
- Movimiento libre con ratón al estilo slither.io (aquí solo se imita la estética).
- Un `cover` propio (se reutiliza `cover-snake`).
- Controles táctiles o de gestos, HiDPI, multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

Sin tablas nuevas: se reutiliza `scores` (SPEC 06) con `game_id = 'serpentina'`. La fila de `games` ya existe.

```ts
// lib/engines/serpentina.ts
export const startSerpentina: GameEngine;

// lib/engines/index.ts
export const ENGINES: Record<string, EngineEntry> = {
  ...,
  serpentina: { start: startSerpentina, width: 800, height: 800 },
};
```

Entrada de catálogo (se modifica la existente, tipo `Game` real):

```ts
{ id: "serpentina", title: "SERPENTINA", short: "...", long: "...", cat: "ARCADE", cover: "cover-snake", color: "green" }
```

Migración:

```sql
delete from public.scores where game_id = 'serpentina';
```

Estado interno del motor (dentro del closure de `startSerpentina`):

```ts
type Cell = { x: number; y: number }; // columna 0–19, fila 0–19
type Dir = "up" | "down" | "left" | "right";
type FruitKey =
  "banana" | "orange" | /* ...22 claves de sprites.js... */ "melon";
type FruitSprite = { x: number; y: number; w: number; h: number }; // recorte en fruits.png
// state: 'ready' | 'playing' | 'over'  (la pausa es del motor: flag interno vía pause()/resume())
// snake: Cell[] (cabeza en [0]); prevSnake: Cell[] para interpolar; fruit: { cell: Cell; key: FruitKey }
```

Convenciones:

- `scores.game_id` = `Game.id` = clave de `ENGINES` = `'serpentina'`.
- `onLives` = `1` constante: el juego no tiene vidas; el HUD muestra un solo `♥`. Se acepta.
- `onLevel` = `1` constante: el juego no tiene niveles; el HUD muestra siempre `01`. Se acepta.
- `onGameOver(score)` se emite una sola vez, ya sea por choque, por tablero lleno o por `end()` (botón FIN, incluso en estado `ready`).
- Coordenadas: origen arriba a la izquierda; tiempos en ms acumulados con `dt`, nunca con `performance.now()` fuera del cálculo de `dt`.
- Tras `onGameOver` el motor deja de actualizar; el reinicio es solo "JUGAR DE NUEVO".

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (según `AGENTS.md`, esta versión de Next tiene cambios incompatibles). No cambia la interfaz de la plataforma, así que no hace falta `/frontend-design`.

1. **Assets.** Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/serpentina/fruits.png`. Verificación: `npm run dev` y `http://localhost:3000/games/serpentina/fruits.png` muestra la imagen.
2. **Motor: núcleo.** Crear `lib/engines/serpentina.ts` con carga del spritesheet, rejilla, serpiente, ticks por acumulador, cola de giros, fruta, puntaje, bordes toroidales, fin de partida y eventos del contrato; dibujado provisional con círculos planos. Verificación: `npm run build` y `npm run lint`.
3. **Motor: render slither.** Añadir interpolación entre ticks, gradiente, brillo, cabeza con ojos, fondo de puntos y pista de inicio. Verificación: `npm run build` y `npm run lint`.
4. **Registro y catálogo.** Registrar `serpentina` en `ENGINES` y actualizar `short`/`long` de la entrada en `GAMES`. Verificación: `/games` muestra SERPENTINA; `/juegos/serpentina` abre.
5. **Base de datos.** `apply_migration` (`clear_serpentina_scores`) con el `delete` de puntajes. Verificación: `execute_sql` `select count(*) from scores where game_id = 'serpentina'` devuelve 0 y `select id from games where id = 'serpentina'` devuelve la fila.
6. **Integración.** Verificar que `GamePlayer` ejecuta el motor sin cambios y que el `setInterval` simulado no corre para `serpentina`. Verificación: `/jugar/serpentina` es jugable y `/jugar/invasores` (simulado) sigue igual.
7. **Verificación final.** `npm run lint`, `npm run build`, `get_advisors` (security) y partida completa en navegador: jugar, comer varias frutas, cruzar los bordes, pausar, morderse, guardar, ver `/salon`, jugar de nuevo y salir.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `ENGINES.serpentina` existe con `width: 800` y `height: 800`; `/games` muestra la tarjeta SERPENTINA y `/juegos/serpentina` renderiza sin errores en consola.
- [ ] `/jugar/serpentina` muestra un canvas 800×800 (cuadrado, centrado en la pantalla 4:3) con la serpiente de 3 segmentos en el centro apuntando a la derecha, una fruta del spritesheet y la pista `PULSA UNA FLECHA PARA EMPEZAR`; el HUD marca puntaje 0, 1 vida y nivel 01.
- [ ] La serpiente no se mueve hasta pulsar una dirección válida; `←` en estado `ready` no hace nada.
- [ ] `←` `↑` `→` `↓` y `A` `W` `D` `S` giran la serpiente; pulsar la dirección contraria a la actual no la hace girar ni la mata.
- [ ] Dos giros rápidos dentro del mismo tick se aplican en ticks consecutivos y en orden (p. ej. `↑` y luego `←` hacen una U sin morder el cuerpo).
- [ ] La serpiente avanza una celda cada 140 ms durante toda la partida, sin acelerar; el movimiento se ve suave (interpolado), no a saltos.
- [ ] Comer una fruta suma exactamente 10 puntos, alarga la serpiente en 1 segmento y aparece otra fruta en una celda libre (nunca sobre el cuerpo).
- [ ] La fruta nueva puede ser de un tipo distinto de las 22 del atlas, dibujada completa y sin deformar.
- [ ] Tras comer varias frutas el HUD sigue en nivel 01 y la velocidad no cambia.
- [ ] Salir por cualquier borde (izquierda, derecha, arriba o abajo) hace entrar la cabeza por el borde opuesto, en la misma fila o columna, sin terminar la partida; el cuerpo que cruza el borde se dibuja sin líneas ni saltos a través del tablero.
- [ ] Morder el propio cuerpo abre el modal "FIN DEL JUEGO"; entrar en la celda que deja la cola en ese mismo tick no lo abre.
- [ ] Llenar las 400 celdas abre el modal "FIN DEL JUEGO" una sola vez, sin intentar generar una fruta.
- [ ] El modal "FIN DEL JUEGO" se abre una sola vez por partida (por choque, por tablero lleno y por FIN) con el puntaje real; pulsar FIN en estado `ready` también lo abre con puntaje 0.
- [ ] La serpiente se dibuja con segmentos circulares que se solapan, gradiente de cabeza a cola y ojos en la cabeza orientados según la dirección.
- [ ] PAUSA congela la serpiente y la interpolación; REANUDAR continúa sin saltos (no avanza varias celdas de golpe).
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con serpiente de 3 segmentos, puntaje 0 y nivel 1, sin listeners ni loops de la partida anterior (la serpiente no va al doble de velocidad ni el puntaje se duplica); salir de la página retira los listeners de `window`.
- [ ] Las flechas no desplazan la página y escribir espacios y letras (incluidas `A`, `W`, `D`, `S`) en el campo de iniciales del modal funciona.
- [ ] Soltar una tecla fuera de la ventana (cambio de foco) no deja giros pendientes al volver.
- [ ] `select count(*) from scores where game_id = 'serpentina'` es 0 tras la migración y `games` sigue conteniendo la fila `serpentina`.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'serpentina'`, las iniciales y el puntaje del HUD.
- [ ] La pestaña SERPENTINA de `/salon` muestra la fila guardada y ninguna fila de la maqueta anterior.
- [ ] A 375 px de ancho no hay scroll horizontal y el canvas conserva su proporción 1:1 (sin deformarse dentro de la pantalla 4:3).
- [ ] Asteroids, THETRIS y ARKANOID siguen funcionando igual y los demás juegos simulados (p. ej. `/jugar/invasores`) no cambian.
- [ ] No quedan imports ni código en `app/`, `components/` ni `lib/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** motor TypeScript con el contrato `GameEngine`; **No:** `<iframe>` ni lógica en un `useEffect`.
- **Sí:** HUD de la plataforma alimentado por eventos; ningún HUD ni overlay propio dibujado en el canvas salvo la pista de inicio.
- **Sí:** reutilizar el guardado y el leaderboard de SPEC 06 sin cambios.
- **Sí:** convertir `serpentina` (decisión del usuario); reutiliza `id`, cover y fila en `games`. **No:** crear un `snake` nuevo, que habría duplicado el catálogo.
- **Sí:** borrar los `scores` de `serpentina` en una migración (decisión del usuario), porque son aleatorios de la maqueta y falsearían el ranking real. **No:** conservarlos.
- **Sí:** canvas 800×800 con rejilla 20×20 de 40 px (decisión del usuario, segunda ronda): tablero cuadrado que no favorece un eje y mantiene el tamaño de celda y de fruta. **No:** 800×600 con 20×15, ni rejillas 25×25 (sprites más pequeños) o 16×16 (tablero apretado). Como la pantalla CRT es 4:3, el canvas queda con bandas laterales y se ve a ~75 % del alto; se acepta.
- **Sí:** bordes toroidales, 1 vida y morderse mata (decisión del usuario, segunda ronda). **No:** muro mortal ni 3 vidas. Consecuencia: sin muro, la única forma de perder es morderse o llenar el tablero.
- **Sí:** 10 puntos por fruta, sin niveles y tick constante de 140 ms (decisión del usuario, segunda ronda). **No:** niveles, aceleración ni puntos crecientes. La dificultad crece solo con la longitud de la serpiente.
- **Sí:** estética estilo slither.io (decisión del usuario): círculos solapados, gradiente, brillo, ojos e interpolación visual sobre lógica de rejilla. **No:** movimiento libre con ratón (cambiaría la jugabilidad y los controles; otra spec) y **no** sprites de serpiente (no existen en los assets).
- **Sí:** fila mediana pixel-art del atlas (decisión del usuario), la única con coordenadas ya detectadas en `sprites.js`. **No:** filas flat/realista (requieren detectar coordenadas nuevas y desentonan con el estilo retro).
- **Sí:** una fruta a la vez, tipo al azar sin efecto en el puntaje (decisión del usuario). **No:** fruta bonus temporal.
- **Sí:** solo teclado (flechas y WASD) con cola de giros de 2 entradas; evita el clásico fallo de morderse al girar dos veces rápido. **No:** gestos táctiles.
- **Sí:** `onLives` = 1 y `onLevel` = 1 fijos para no tocar `GamePlayer`, cuyo HUD siempre muestra vidas y nivel. **No:** ocultar esos campos (cambio de UI fuera de alcance).
- **Sí:** `dt` máx. 50 ms con acumulador de ticks y `onGameOver` inmediato al chocar; **No:** animación de muerte (el modal la taparía).
- **Sí:** el contenido de `references/` es solo referencia; el PNG se copia a `public/games/serpentina/` y no se importa desde `references/`.

---

## Riesgos identificados

| Riesgo                                                                         | Mitigación                                                                                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Doble montaje de StrictMode duplica loops y entrada                            | `destroy()` en el cleanup del `useEffect`; criterio de aceptación.                                                   |
| El `delete` de `scores` es irreversible                                        | Decisión explícita del usuario; se limita a `game_id = 'serpentina'` y se verifica con `count(*)` antes y después.   |
| `dt` grande al reanudar o cambiar de pestaña                                   | Reiniciar la marca de tiempo en `resume()`; tope de 50 ms; como máximo un tick por frame.                            |
| `preventDefault` bloquea el input de iniciales                                 | Ignorar eventos cuyo `target` sea `input`/`textarea`.                                                                |
| `onGameOver` se emite dos veces (choque y botón FIN)                           | Bandera interna en el motor.                                                                                         |
| `destroy()` antes de que cargue el spritesheet arranca un loop                 | Bandera `destroyed` comprobada en `onload`; `end()` emite `onGameOver` aunque la imagen no haya cargado.             |
| La imagen no carga (404) y el juego queda en negro                             | `console.error` y no arrancar; `end()`/FIN sigue funcionando. Se verifica en el paso 1.                              |
| Giros rápidos permiten reversa y muerte instantánea                            | Cola de máximo 2 giros validados contra la última dirección encolada.                                                |
| Hoja de 3790 px pesada para escalar a 36 px                                    | Aceptado: se carga una vez; si se nota, otra spec generaría un atlas recortado.                                      |
| Coordenadas de `sprites.js` con recortes imprecisos (marcas de píxel vecinas)  | Comprobar visualmente las 22 frutas en el paso 2; ajustar `x/w` en la constante TS si alguna se corta.               |
| Fruta sin celdas libres con el tablero casi lleno                              | Elegir entre celdas libres calculadas; si no hay ninguna, terminar la partida por victoria.                          |
| La interpolación dibuja un segmento cruzando todo el tablero al pasar un borde | Si la distancia entre celda previa y actual supera 1 celda en un eje, ese segmento se dibuja sin interpolar (salto). |
| Al morderse, el tick fatal se dibuja con el cuerpo solapado                    | No se dibuja el tick fatal: al detectar mordida se emite `onGameOver` y el motor deja de actualizar.                 |

---

## Qué **no** está en esta spec

- Sonido y música.
- Fruta bonus, obstáculos, modos de juego y mapas.
- Récord local en `localStorage`.
- Movimiento libre con ratón al estilo slither.io.
- Cover propio de Serpentina.
- Controles táctiles o de gestos, HiDPI y multijugador.
- Anti-trampas, auth y `user_id` en `scores`.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
