# SPEC 05 — Asteroids jugable en la plataforma

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04 (solo como contexto; no usa Supabase)
> **Fecha:** 2026-10-06
> **Objetivo:** Portar el juego `references/started-games/02-asteroids/` a un motor TypeScript y hacerlo jugable en `/jugar/asteroids`, alimentando el HUD y el guardado de puntaje de la plataforma con datos reales.

---

## Por qué existe esta spec

Hoy `components/game-player.tsx` es una maqueta: el puntaje sube con un `setInterval` aleatorio y el "juego" es una arena decorativa. Asteroids es el primer juego real que se integra, así que esta spec también fija el patrón (contrato de motor + registro por id) que seguirán Tetris y Arkanoid, ya presentes en `references/started-games/`. El juego original es un único `game.js` con globals, HUD dibujado en el canvas y teclado directo sobre `window`; no se puede montar tal cual en React sin fugas de listeners ni HUD duplicado.

---

## Alcance

**Dentro:**

- **Contrato de motor** en `lib/engines/types.ts` y **registro por id** en `lib/engines/index.ts`.
- **Motor Asteroids** en `lib/engines/asteroids.ts`: port de `game.js` a TypeScript estricto, sin globals ni acceso a `document`, con las mismas reglas de juego:
  - Nave con rotación, propulsión e inercia; envolvimiento toroidal en 800×600.
  - Asteroides de tamaños 3 → 2 → 1 que se parten al ser destruidos; puntos 20 / 50 / 100.
  - 3 vidas, invencibilidad de 3 s al reaparecer (parpadeo), partículas de explosión.
  - Power-up de **disparo triple** (`3x`, 5 s), con aparición aleatoria y garantizada tras 5 destrucciones.
  - Niveles: al limpiar los asteroides, siguiente nivel con `3 + nivel` asteroides.
  - Controles: `←` `→` rotar, `↑` propulsar, `Espacio` disparar.
- **HUD de la plataforma**: el motor emite eventos (puntaje, vidas, nivel, fin) y `GamePlayer` los muestra en su HUD existente. El HUD y el overlay "GAME OVER / ESPACIO PARA REINICIAR" del canvas se eliminan. Se conserva en el canvas el indicador `3x {segundos}s` del power-up, porque es información de juego y no existe en el HUD React.
- **Integración en `GamePlayer`**: si el id tiene motor registrado, se renderiza un `<canvas>` en `.crt-screen` y se usan eventos reales; si no, se mantiene la simulación actual (los demás juegos no cambian).
- **PAUSA / REANUDAR / FIN / JUGAR DE NUEVO** controlan el motor real. Al terminar la partida (sin vidas o botón FIN) se abre el modal "FIN DEL JUEGO" existente con el puntaje real.
- **Guardado de puntaje** con el flujo actual (`localStorage`, clave `av_scores`, `{ game, score, name, at }`).
- **Entrada nueva `asteroids`** en `lib/games.ts` (categoría `SHOOTER`), con título, descripciones y cover propios.
- **Teclado seguro**: `preventDefault` en `←` `↑` `→` `Espacio` mientras el motor está activo (evita scroll de la página), sin interferir con `<input>`/`<textarea>`; listeners de `window` registrados al iniciar y retirados en `destroy()`.
- **Canvas responsivo**: resolución interna fija 800×600, escalado por CSS manteniendo proporción 4:3.

**Fuera de alcance (para otras specs):**

- Persistir puntajes en Supabase, ranking real o reemplazo de `seededScores` (el Salón de la Fama sigue con datos sembrados).
- Controles táctiles / móvil. El juego es solo teclado.
- Portar Tetris o Arkanoid (solo se deja el contrato listo).
- Cambios de reglas o mecánicas respecto al original (OVNIs, sonido, nuevos power-ups).
- Retirar o modificar la entrada `rocas` existente.
- Soporte HiDPI/retina del canvas y música/efectos de sonido.
- Autoguardado para usuarios con sesión (se mantiene el guardado manual del modal).
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

No hay persistencia nueva: se reutiliza `av_scores` sin cambios de formato. Estructuras nuevas:

```ts
// lib/engines/types.ts
export type EngineEvents = {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // se emite una sola vez por partida
};

export type EngineHandle = {
  pause: () => void;
  resume: () => void;
  end: () => void; // termina la partida (botón FIN): emite onGameOver con el puntaje actual
  destroy: () => void; // detiene el loop y retira listeners
};

export type GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
) => EngineHandle;

// lib/engines/index.ts
export const ENGINES: Record<string, GameEngine> = {
  asteroids: startAsteroids,
};

// lib/engines/asteroids.ts
export const startAsteroids: GameEngine;
```

Entrada de catálogo (`lib/games.ts`):

```ts
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Pulveriza asteroides en el vacío del espacio.",
  long: "...",            // nave, disparo, fragmentación y power-up de disparo triple; sin OVNIs
  cat: "SHOOTER",
  cover: "cover-rocas",   // reutiliza el cover existente; sin CSS nuevo
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Convenciones:

- El estado del juego (nave, balas, asteroides, partículas, power-ups, puntaje, vidas, nivel) vive dentro del closure de `startAsteroids`; no hay estado de módulo.
- Constantes de juego del original se conservan con los mismos valores (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`, `dt` máximo 50 ms).
- Los eventos se emiten solo cuando el valor cambia, para no forzar renders de React en cada frame.
- `GamePlayer` crea el motor en un `useEffect` y devuelve `destroy` como cleanup (compatible con el doble montaje de StrictMode). "JUGAR DE NUEVO" destruye y crea un motor nuevo.
- `pause()` detiene actualización y dibujo del loop; `resume()` reinicia la marca de tiempo para no generar un `dt` grande.
- Tras `onGameOver` el motor deja de actualizar el juego; no se reinicia con `Espacio`.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components y de `useEffect`/refs si existe. Según `AGENTS.md`, esta versión de Next tiene cambios incompatibles. Aplicar la skill `/frontend-design` si algún cambio toca la interfaz (el canvas dentro de `.crt-screen`).

1. **Contrato y registro.** Crear `lib/engines/types.ts` y `lib/engines/index.ts` (registro vacío o con el motor aún no implementado). Verificación: `npm run build` compila.
2. **Motor Asteroids.** Crear `lib/engines/asteroids.ts` portando `references/started-games/02-asteroids/game.js`: clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle` dentro del closure; entrada por teclado con registro/retiro de listeners; loop con `requestAnimationFrame`; emisión de eventos; sin HUD de texto ni overlay (solo el indicador `3x`). Registrarlo en `ENGINES`. Verificación: `npm run build` y `npm run lint` pasan.
3. **Catálogo.** Agregar la entrada `asteroids` a `lib/games.ts`. Verificación: aparece en `/games` y `/juegos/asteroids` abre su detalle.
4. **Integración en `GamePlayer`.** Si `ENGINES[game.id]` existe: renderizar `<canvas width={800} height={600}>` escalado por CSS en `.crt-screen`; crear el motor en `useEffect`; conectar `onScore/onLives/onLevel/onGameOver` al estado; PAUSA/REANUDAR → `pause/resume`; FIN → `end`; "JUGAR DE NUEVO" → nuevo motor; mostrar vidas reales en lugar del `LIVES` fijo; no ejecutar el `setInterval` simulado. Si no hay motor, el componente se comporta como hoy. Verificación: `/jugar/asteroids` es jugable; `/jugar/caida` sigue con la simulación.
5. **Teclado y escalado.** `preventDefault` de `←` `↑` `→` `Espacio` solo con el motor activo y fuera de `<input>`/`<textarea>`; ajustar CSS del canvas (ancho 100%, `aspect-ratio: 4 / 3`). Verificación: la página no hace scroll al jugar y a 375 px no hay scroll horizontal.
6. **Pulido y verificación.** `npm run lint`, `npm run build` y partida completa en navegador (con Playwright MCP o a mano): jugar, pausar, perder las 3 vidas, guardar puntaje, volver a jugar y salir.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `lib/engines/types.ts`, `lib/engines/index.ts` y `lib/engines/asteroids.ts` existen; `ENGINES.asteroids` está registrado.
- [ ] `/games` muestra la tarjeta "ASTEROIDS" y `/juegos/asteroids` renderiza su detalle sin errores en la consola.
- [ ] En `/jugar/asteroids` aparece un canvas con la nave en el centro, 4 asteroides grandes y el puntaje en 0 en el HUD de la plataforma.
- [ ] `←` `→` rotan la nave, `↑` la propulsa (con inercia) y `Espacio` dispara; la nave, las balas y los asteroides reaparecen por el borte opuesto.
- [ ] Destruir un asteroide grande suma 20, uno mediano 50 y uno pequeño 100 al puntaje del HUD; un grande se parte en dos medianos y un mediano en dos pequeños.
- [ ] Al chocar con la nave se pierde una vida (el HUD pasa de 3 a 2 vidas), la nave reaparece tras 2 s con invencibilidad parpadeante de 3 s.
- [ ] El power-up `3x` aparece, al recogerlo se disparan 3 balas en abanico durante 5 s y el canvas muestra el contador `3x` con los segundos restantes.
- [ ] Al destruir todos los asteroides el HUD pasa a nivel 2 y aparecen 5 asteroides grandes.
- [ ] Al perder la tercera vida se abre el modal "FIN DEL JUEGO" con el puntaje real; el modal se abre una sola vez por partida.
- [ ] Pulsar FIN abre el mismo modal con el puntaje actual y el motor deja de avanzar.
- [ ] PAUSA congela nave, asteroides y puntaje; REANUDAR continúa sin saltos (no hay movimiento brusco por tiempo acumulado).
- [ ] "GUARDAR PUNTUACIÓN" escribe `{ game: "asteroids", score, name, at }` en `localStorage["av_scores"]`; el puntaje guardado coincide con el del HUD.
- [ ] "JUGAR DE NUEVO" empieza una partida nueva con puntaje 0, 3 vidas y nivel 1; no queda ningún listener ni loop de la partida anterior (el puntaje no se duplica ni la nave se mueve el doble de rápido).
- [ ] Salir de `/jugar/asteroids` (SALIR o navegación) detiene el loop y retira los listeners de `window`; volver a entrar no duplica la entrada de teclado.
- [ ] Con el juego activo, `←` `↑` `→` `Espacio` no desplazan la página; escribir espacios en el campo de iniciales del modal funciona.
- [ ] A 375 px de ancho el canvas se escala manteniendo 4:3 y no hay scroll horizontal.
- [ ] `/jugar/caida` (y los demás juegos sin motor) siguen mostrando la simulación actual sin cambios.
- [ ] La entrada `rocas` sigue existiendo y sin cambios.
- [ ] No quedan imports ni código en `app/`, `components/` ni `lib/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** port a módulo TypeScript con canvas React. Permite leer puntaje, pausar y limpiar listeners, y es la base para los demás juegos. Decisión del usuario.
- **No:** `<iframe>` a HTML estático ni pegar `game.js` en un `useEffect`. El primero impide conectar puntaje/pausa a la plataforma; el segundo deja globals y fugas.
- **Sí:** HUD de la plataforma alimentado por eventos del motor; se elimina el HUD y el overlay del canvas. Decisión del usuario; evita duplicar información y reutiliza el modal de guardado.
- **Sí:** conservar en el canvas el indicador `3x` del power-up. Es información de juego sin equivalente en el HUD React.
- **No:** reinicio con `Espacio` tras el game over. La partida se reinicia desde el modal ("JUGAR DE NUEVO"); mantener ambos crearía dos caminos de reinicio.
- **Sí:** entrada nueva `asteroids` y `rocas` queda intacta. Decisión del usuario; `rocas` sigue como maqueta y se deja para otra spec decidir si se retira.
- **Sí:** el cover de `asteroids` reutiliza `cover-rocas`. El juego es el mismo concepto visual y evita CSS nuevo; un cover propio puede venir después.
- **Sí:** guardado de puntaje en `localStorage` con el flujo actual. Supabase y ranking real son otra spec (ver SPEC 04, que solo dejó la base).
- **Sí:** contrato genérico `GameEngine` + registro por id desde ya. Decisión del usuario; Tetris y Arkanoid se integran añadiendo un motor y una línea en `ENGINES`.
- **No:** controles táctiles. El original es solo teclado; añadirlos es UI nueva y va en su propia spec.
- **Sí:** `preventDefault` de teclas de juego solo con el motor activo y fuera de campos de texto, para no romper el input de iniciales.
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo                                                              | Mitigación                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Next 16 / React 19 difieren de lo conocido (StrictMode, efectos)    | Leer la guía en `node_modules/next/dist/docs/` antes de escribir.                                               |
| Doble montaje de StrictMode crea dos loops y duplica la entrada     | `destroy()` en el cleanup del `useEffect`; criterio de aceptación que verifica que no hay listeners duplicados. |
| Re-renders de React en cada frame si se emiten eventos sin filtrar  | Emitir solo cuando cambia el valor; el dibujo se hace en el canvas, fuera de React.                             |
| `preventDefault` bloquea `Espacio` en el modal de iniciales         | Ignorar eventos cuyo `target` sea `input`/`textarea` y destruir/pausar el motor al abrir el modal.              |
| `dt` grande al reanudar tras PAUSA o cambiar de pestaña             | Reiniciar la marca de tiempo en `resume()` y conservar el tope de 50 ms del original.                           |
| `onGameOver` se emite dos veces (vidas a 0 y botón FIN)             | Bandera interna en el motor; criterio de aceptación de modal único por partida.                                 |
| Port a TS introduce diferencias de jugabilidad respecto al original | Conservar constantes y fórmulas tal cual; comparar manualmente con `references/.../index.html`.                 |
| Canvas escalado por CSS pierde nitidez en pantallas HiDPI           | Aceptado; HiDPI queda fuera de alcance.                                                                         |

---

## Qué **no** está en esta spec

- Persistencia de puntajes en Supabase, ranking real o realtime.
- Controles táctiles y soporte móvil.
- Tetris, Arkanoid u otros motores (solo el contrato).
- Cambios de mecánicas, OVNIs, sonido o nuevos power-ups.
- Retirar la entrada `rocas` de la maqueta.
- HiDPI del canvas.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
