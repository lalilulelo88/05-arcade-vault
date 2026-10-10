# SPEC 13 — Controles táctiles para jugar en móvil

> **Estado:** Implementado
> **Depende de:** SPEC 05 (contrato `GameEngine`, Asteroids), SPEC 07 (Caída y `EngineEntry` con `width`/`height`), SPEC 08 (Arkanoid), SPEC 09 (Serpentina)
> **Fecha:** 2026-10-10
> **Objetivo:** Hacer jugables en un móvil con pantalla táctil los cuatro juegos con motor (Asteroids, Caída, Arkanoid y Serpentina) mediante botones en pantalla que emiten eventos de teclado, una pantalla de juego a la proporción del motor y un HUD compacto.

---

## Auditoría del estado actual

Referencia: captura de un Samsung real (375 px de ancho aprox.) en `/jugar/asteroids`.

- El HUD (`.player-hud`) ocupa ~40 % del alto visible: stats en dos filas, selector de skin y tres botones en otra fila.
- La pantalla `.crt-screen` fuerza `aspect-ratio: 4 / 3` con padding de 24 px del `.crt`: el canvas se ve a ~380×200 px. Caída (480×600) y Serpentina (800×800) quedan aún más pequeños, con bandas negras por `object-fit: contain`.
- El pie `.crt-bottom` ("SEÑAL OK · ASTEROIDS · CRT-83 · 60 HZ · CARGA · 1MB") se parte en varias líneas.
- **No hay ninguna forma de controlar los juegos sin teclado.** Los cuatro motores leen solo `keydown`/`keyup` en `window`:

| Juego      | Teclas que usa el motor                                                                                  | Tipo de entrada                           |
| ---------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| asteroids  | `ArrowLeft`/`ArrowRight` (girar), `ArrowUp` (empuje), `Space` (disparo, por `justPressed`)               | mantenida (`keys[code]`)                  |
| caida      | `ArrowLeft`/`ArrowRight` (mover), `ArrowDown` (bajada suave), `ArrowUp` (rotar), `Space` (caída), `KeyC` | por pulsación; el auto-repeat lo da el SO |
| arkanoid   | `ArrowLeft`/`ArrowRight` (mover, mantenida), `Space` (lanzar bola / láser, ignora `e.repeat`)            | mantenida + pulsación                     |
| serpentina | `ArrowUp/Down/Left/Right` (o WASD)                                                                       | por pulsación                             |

Como los cuatro escuchan `window`, un botón en pantalla que emita `KeyboardEvent` sintéticos sobre `window` los controla **sin tocar ningún motor**.

---

## Alcance

**Dentro:**

- **Componente `components/touch-controls.tsx`** (Client Component) que recibe `gameId` y dibuja una botonera estilo gamepad bajo la pantalla del CRT: cruceta/botones de movimiento a la izquierda y botones de acción a la derecha. Cada botón usa Pointer Events (`pointerdown`/`pointerup`/`pointercancel`/`pointerleave` + `setPointerCapture`) para permitir **multitoque** (p. ej. mantener `←` y pulsar DISPARAR a la vez).
- **Emisión de teclas:** `pointerdown` → `window.dispatchEvent(new KeyboardEvent("keydown", { code, key, bubbles: true }))`; `pointerup`/cancelación → `keyup`. Los botones marcados `repeat` (movimiento de Caída) reemiten `keydown` con `repeat: true` cada ~90 ms tras 220 ms de retardo, imitando el auto-repeat del teclado.
- **Mapeo por juego** (tabla en el Modelo de datos):
  - SERPENTINA: cruceta ↑ ← ↓ →.
  - CAÍDA: cruceta en T con ▲ (caída directa, `Space`), ◀ ▶ y ▼ (bajada suave); a la derecha GUARDAR (`KeyC`, amarillo) a la izquierda de ROTAR (`ArrowUp`, magenta). No hay botón CAER aparte.
  - ARKANOID: ← → + DISPARAR (`Space`; también lanza la bola).
  - ASTEROIDS: ← → (girar) + EMPUJE (`ArrowUp`) + DISPARAR (`Space`).
- **Visibilidad solo en táctil:** el componente se renderiza siempre en el DOM para los juegos con motor, pero un `@media (pointer: coarse)` en `app/globals.css` lo muestra; en escritorio `display: none`. Sin detección por JS (sin riesgo de hidratación).
- **Pantalla a la proporción del motor** (solo `(pointer: coarse)`): `GamePlayer` pasa `--screen-ratio: ${width} / ${height}` como variable CSS inline al `.crt-screen`; en táctil el `aspect-ratio` pasa de `4 / 3` a esa variable, con el ancho limitado por el alto disponible (`100svh − 310px − --pad-h`, donde `--pad-h` es la altura de la botonera de cada juego, fijada por `data-game` en `.av-player`; para ello `GamePlayer` pasa también `--screen-k = width / height`). El `.crt` reduce su padding a 10 px, el canvas ocupa todo el ancho disponible y el área de juego lleva un borde neón cian para distinguirla del marco negro.
- **HUD compacto en táctil** (`@media (pointer: coarse)`): una fila con JUGADOR/PUNTUACIÓN/VIDAS/NIVEL (etiquetas y valores más pequeños) y una segunda fila con skins (si aplica), PAUSA, FIN y SALIR; se oculta `.crt-bottom`.
- **Bloqueo de scroll/zoom en el área de juego:** `touch-action: none` y `user-select: none` en `.crt-screen` y en la botonera (también `-webkit-touch-callout: none` y `contextmenu` prevenido en los botones), para evitar zoom por doble toque, scroll y menú de pulsación larga.
- **Pausa y fin:** los botones de la botonera no hacen nada mientras la partida está en pausa o terminada (los motores ya ignoran el input en esos estados); al pausar, `GamePlayer` libera cualquier tecla sintética mantenida (emite `keyup` pendientes) para no dejar la nave girando o la paleta moviéndose.
- Tamaño táctil mínimo de **48×48 px** por botón, con `aria-label` en español en cada uno.

**Fuera de alcance (para otras specs):**

- Gestos nativos en los motores (swipe en Serpentina, arrastrar la paleta en Arkanoid, joystick analógico).
- Pantalla completa, bloqueo de orientación (`screen.orientation.lock`) y modo horizontal dedicado.
- Auto-pausa por `visibilitychange`.
- Vibración háptica, sonido, controles configurables o reasignables.
- Hacer jugables los juegos simulados (sin motor): no hay nada que controlar.
- Cambios en los motores (`lib/engines/*`), en el contrato `GameEngine`, en la base de datos o en `scores`.
- Rediseño del resto del sitio en móvil (home, biblioteca, salón, about).
- Tests automatizados (el proyecto no tiene framework); detección de dispositivo por User-Agent.

---

## Modelo de datos

Sin tablas ni cambios de esquema. Tipos y constantes nuevas en `components/touch-controls.tsx`:

```ts
type PadButton = {
  code: string; // KeyboardEvent.code que reconoce el motor
  key: string; // KeyboardEvent.key
  label: string; // texto visible (flechas o acción)
  aria: string; // aria-label en español
  repeat?: boolean; // reemite keydown mientras se mantiene (Caída)
  area: "move" | "action"; // columna izquierda o derecha
};

const PADS: Record<string, PadButton[]> = {
  serpentina: [/* ArrowUp, ArrowLeft, ArrowDown, ArrowRight (area: move) */],
  caida: [
    /* ArrowLeft, ArrowRight, ArrowDown (move, repeat) */
    /* Space "▲" caída directa (move); ArrowUp "ROTAR", KeyC "GUARDAR" (action) */
  ],
  arkanoid: [/* ArrowLeft, ArrowRight (move) ; Space "DISPARAR" (action) */],
  asteroids: [
    /* ArrowLeft, ArrowRight (move) ; ArrowUp "EMPUJE", Space "DISPARAR" (action) */
  ],
};
```

- `GamePlayer` renderiza `<TouchControls gameId={game.id} />` solo si `PADS[game.id]` existe (equivale a tener motor), justo después de `.crt`.
- Estado interno del componente: un `Set<string>` de `pointerId → code` en un `useRef` (sin estado React por pulsación) y los temporizadores de repetición; todo se limpia en `useEffect` cleanup (emite `keyup` de lo que siga pulsado).
- Variable CSS `--screen-ratio` (string `"W / H"`) puesta como `style` en `.crt-screen`; sin uso fuera de táctil.
- Sin `localStorage` ni persistencia nuevos.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (según `AGENTS.md`). Para el estilo de la botonera y el HUD compacto usar `/frontend-design` (instrucción del proyecto).

1. **Botonera sin estilo.** Crear `components/touch-controls.tsx` con `PADS`, Pointer Events con captura, emisión de `keydown`/`keyup` sintéticos, repetición para `repeat` y limpieza en cleanup. Verificación: `npx tsc --noEmit` y `npm run lint`.
2. **Integración.** En `components/game-player.tsx`, renderizar `<TouchControls>` bajo `.crt` para los juegos con motor y pasar `--screen-ratio`; liberar teclas al pausar y al terminar. Verificación: en emulación táctil de Chrome DevTools, cada botón mueve/dispara en su juego; el teclado sigue funcionando en escritorio.
3. **CSS táctil.** En `app/globals.css`, bajo `@media (pointer: coarse)`: mostrar la botonera y darle estilo gamepad (botones ≥ 48 px, cruceta, acciones), `aspect-ratio: var(--screen-ratio)` con `max-height`, `.crt` con padding reducido, `.crt-bottom` oculto, `touch-action: none`/`user-select: none`. Verificación: a 375 px la pantalla ocupa el ancho, la botonera cabe sin scroll horizontal y en escritorio nada cambia.
4. **HUD compacto.** Reordenar `.player-hud` en táctil a dos filas (stats / acciones) con tipografía reducida. Verificación: a 375 px el HUD ocupa ≲ 20 % del alto visible y todos los botones (PAUSA, FIN, SALIR, skins) son tocables.
5. **Prueba en dispositivo real.** Abrir `http://<ip-local>:3000/jugar/<id>` desde el móvil (como en la captura) y jugar una partida de cada juego: multitoque (mover + disparar), pausa con tecla mantenida, guardar puntuación con el teclado en pantalla. Ajustar tamaños/posiciones si hace falta.
6. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`, recorrido en escritorio (sin botonera, sin regresiones) y en emulación táctil de los cuatro juegos, más los simulados (p. ej. `/jugar/invasores`) sin cambios.

---

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] No se modifica ningún archivo de `lib/engines/` ni de `lib/supabase/`; `git diff` solo toca `components/touch-controls.tsx`, `components/game-player.tsx` y `app/globals.css` (más esta spec).
- [ ] En un dispositivo con `(pointer: coarse)`, `/jugar/serpentina`, `/jugar/caida`, `/jugar/arkanoid` y `/jugar/asteroids` muestran la botonera con el mapeo de la tabla; en escritorio (`pointer: fine`) no se ve ni ocupa espacio.
- [ ] SERPENTINA: cada flecha de la cruceta gira la serpiente y la primera pulsación válida inicia la partida.
- [ ] CAÍDA: ← y → mueven la pieza una vez al tocar y repiten al mantener; ↓ baja suave, ROTAR rota, ▲ hace la caída directa y GUARDAR usa la reserva.
- [ ] ARKANOID: mantener ← o → mueve la paleta de forma continua; DISPARAR lanza la bola en estado de espera y dispara el láser cuando corresponde.
- [ ] ASTEROIDS: ← y → giran mientras se mantienen, EMPUJE acelera mientras se mantiene y DISPARAR dispara una vez por toque.
- [ ] Multitoque: se puede mantener un botón de movimiento y pulsar uno de acción a la vez (Asteroids y Arkanoid).
- [ ] Soltar el dedo fuera del botón o interrumpir el toque (`pointercancel`) emite el `keyup` correspondiente; no quedan teclas "pegadas".
- [ ] Al pulsar PAUSA o terminar la partida mientras se mantiene un botón, el juego no queda con la nave girando ni la paleta moviéndose al reanudar o reiniciar.
- [ ] Los botones de la botonera no hacen nada en pausa ni en "FIN DEL JUEGO".
- [ ] A 375 px de ancho no hay scroll horizontal; la pantalla ocupa el ancho disponible y mantiene la proporción del motor (4:3, 4:5 y 1:1 según el juego) sin deformar el canvas.
- [ ] Con la botonera visible, pantalla de juego y controles caben juntos en el alto de un móvil típico (≥ 640 px de alto) sin tener que hacer scroll para jugar.
- [ ] Cada botón mide ≥ 48×48 px y tiene `aria-label` en español.
- [ ] El HUD táctil ocupa dos filas, sin desbordes, y PAUSA, FIN, SALIR y el selector de skin (en los juegos que lo tienen) son tocables; `.crt-bottom` no se ve.
- [ ] Tocar o arrastrar sobre la pantalla y la botonera no hace scroll, zoom por doble toque ni abre el menú contextual.
- [ ] El input de iniciales del modal "FIN DEL JUEGO" sigue funcionando con el teclado en pantalla.
- [ ] Sin desajuste de hidratación en consola; en escritorio los cuatro juegos siguen jugándose con teclado como antes.
- [ ] Los juegos simulados (p. ej. `/jugar/invasores`) no cambian.

---

## Decisiones tomadas y descartadas

- **Sí:** botones en pantalla que emiten `KeyboardEvent` sintéticos en `window` (decisión del usuario, opción 1); **No:** gestos nativos dentro de cada motor, que tocarían los cuatro motores y el contrato `GameEngine`.
- **Sí:** los 4 juegos con motor (decisión del usuario); **No:** los simulados, que no tienen controles.
- **Sí:** mostrar la botonera solo con `(pointer: coarse)` (decisión del usuario); **No:** mostrarla siempre ni detectar por User-Agent. Consecuencia: un portátil con pantalla táctil y ratón/teclado puede no mostrarla; se acepta.
- **Sí:** pantalla a la proporción del motor y a todo el ancho en táctil (decisión del usuario); **No:** mantener 4:3 (el juego se vería diminuto, como en la captura).
- **Sí:** HUD en dos filas compactas y ocultar el pie del CRT en táctil (decisión del usuario); **No:** dejar el HUD como está.
- **Sí:** mapeo estilo gamepad (movimiento izquierda, acciones derecha) confirmado por el usuario; **No:** botones flotantes sobre el canvas, que taparían el juego.
- **Sí:** Pointer Events con `setPointerCapture` para multitoque y cancelación limpia; **No:** `touchstart`/`touchend` (más casos límite) ni `click` (sin mantener).
- **Sí:** bloqueo de scroll/zoom con `touch-action: none` en el área de juego (decisión del usuario); **No:** `user-scalable=no` global en el viewport (perjudica la accesibilidad del resto del sitio).
- **Sí:** repetición de teclas sintética solo para Caída (el motor depende del auto-repeat del SO); **No:** repetición en Serpentina (un giro por toque) ni en Arkanoid/Asteroids (leen la tecla mantenida).
- **Sí (ajuste tras probar en el móvil):** botoneras compactas (cruceta de Serpentina de 52 px, Caída en dos filas) y alto de pantalla que descuenta `--pad-h`, para que pantalla y botonera quepan sin scroll; **No:** la fórmula inicial `100svh − 300px`, que dejaba la botonera cortada.
- **Sí (ajuste tras probar en el móvil):** en Caída la caída directa va en ▲ de la cruceta y GUARDAR (amarillo) a la izquierda de ROTAR; **No:** un botón CAER aparte. Consecuencia: ▲ ya no rota; solo rota ROTAR.
- **Sí:** borde neón cian en `.crt-screen` solo en táctil, porque el área de juego no se distinguía del marco negro del CRT.
- **Sí:** `allowedDevOrigins: ["192.168.*.*"]` en `next.config.ts`, solo afecta a `next dev`; sin ello Next devuelve 403 a los scripts pedidos desde la IP local y el canvas queda negro.
- **Descartado por ahora:** pantalla completa y bloqueo de orientación (soporte irregular en iOS), y auto-pausa por `visibilitychange` (decisión del usuario al no seleccionarlos).

---

## Riesgos identificados

| Riesgo                                                                                      | Mitigación                                                                                                                             |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Los motores comprueban `e.target` (`HTMLInputElement`) y el evento sintético no lo cumple   | El evento se emite sobre `window`, así que `e.target` es `window` y pasa el filtro; verificar en el paso 2.                            |
| Asteroids solo registra `justPressed` si `keys[code]` era falso                             | Cada toque emite `keyup` previo al soltar; probar toques rápidos consecutivos de DISPARAR.                                             |
| Teclas "pegadas" si el toque termina fuera del botón, el navegador cancela o se pierde foco | `setPointerCapture`, manejo de `pointercancel`/`lostpointercapture` y cleanup que emite `keyup` pendientes (también en pausa/fin).     |
| El auto-repeat sintético de Caída duplica movimientos o no se detiene                       | Un solo temporizador por botón, limpiado en `pointerup`/cancelación/desmontaje; probar con toques largos y cortos.                     |
| Pantalla + HUD + botonera no caben en móviles bajos                                         | `max-height` de la pantalla con `svh` y HUD compacto; verificar a 375×640 y en el dispositivo real (paso 5).                           |
| `aspect-ratio` con variable CSS inline y `object-fit: contain` desalinean el canvas         | El `ratio` coincide con `entry.width/height`, así que `contain` no deja bandas; comprobar los cuatro juegos en el paso 3.              |
| Safari iOS ignora `touch-action: none` en algunos casos (zoom por doble toque)              | Mantener `touch-action: manipulation` como mínimo y prevenir `contextmenu`; validar en iOS si hay dispositivo, si no, queda como nota. |
| Pulsación larga selecciona texto o abre menú del navegador                                  | `user-select: none`, `-webkit-touch-callout: none` y `onContextMenu` con `preventDefault` en los botones.                              |
| El teclado en pantalla del modal tapa el formulario de guardado                             | Fuera de alcance de maquetación; se verifica en el paso 5 y, si molesta, se aborda en otra spec.                                       |

---

## Qué **no** está en esta spec

- Gestos nativos (swipe, arrastre de paleta, joystick analógico).
- Pantalla completa, bloqueo de orientación y modo horizontal dedicado.
- Auto-pausa por `visibilitychange`.
- Vibración, sonido y controles reasignables.
- Juegos simulados jugables.
- Rediseño móvil del resto del sitio.
- Cambios en motores, contrato `GameEngine`, Supabase o tests automatizados.

Cada uno, si se aborda, va en su propia spec.
