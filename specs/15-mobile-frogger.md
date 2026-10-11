# SPEC 15 — Frogger en móvil (botonera táctil, pantalla y HUD)

> **Estado:** Aprobado
> **Depende de:** SPEC 13 (controles táctiles móviles) y SPEC 14 (skins de Frogger; motor en `specs/game-jam/frogger/01-frogger-core.md`)
> **Fecha:** 2026-10-10
> **Objetivo:** Hacer Frogger jugable en un móvil con `(pointer: coarse)`: cruceta en pantalla que emite las flechas, pantalla a la proporción 640×560 (8:7) y HUD compacto, sin tocar el motor.

---

## Auditoría del estado actual

Frogger ya está en `ENGINES` (640×560) y `GamePlayer` ya pasa `--screen-ratio`/`--screen-k`, `data-game` y monta `<TouchControls>` si `PADS[game.id]` existe. Hoy **no existe entrada `frogger` en `PADS`**, así que en móvil no aparece botonera y el juego es injugable (ni siquiera se puede salir de "PULSA UNA FLECHA PARA EMPEZAR").

| Tecla                 | Acción                  | Tipo de entrada                                                      | Botón propuesto (área, repeat)   |
| --------------------- | ----------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `ArrowUp` (o `KeyW`)  | Saltar arriba (avanzar) | por pulsación (`pending = dir`); la primera pulsación inicia partida | ▲ `Arriba` (move, sin repeat)    |
| `ArrowLeft` (`KeyA`)  | Saltar a la izquierda   | por pulsación                                                        | ◀ `Izquierda` (move, sin repeat) |
| `ArrowDown` (`KeyS`)  | Saltar abajo            | por pulsación                                                        | ▼ `Abajo` (move, sin repeat)     |
| `ArrowRight` (`KeyD`) | Saltar a la derecha     | por pulsación                                                        | ▶ `Derecha` (move, sin repeat)   |

- El motor solo escucha `keydown` en `window` (no hay `keyup` ni lectura de `keys[]`); ignora la entrada si `!running` (pausa) o `state === "over"`. No hay botones de acción. P/Esc los gestiona la plataforma.
- Entrada **por pulsación**, no depende del auto-repeat del SO (un salto por toque), por lo que ningún botón lleva `repeat`.
- El motor comprueba `e.target` de campos de texto; el evento sintético sale de `window`, así que pasa el filtro.

### Fallos del checklist (estado actual)

- Sin entrada en `PADS`: no hay botonera, no hay forma de jugar. (Fallo bloqueante.)
- Sin regla `--pad-h` para `data-game="frogger"`: usaría el valor por defecto de 86 px, que no corresponde a la botonera nueva.
- Sin estilo de cruceta para frogger (la regla de `.tc-move` por defecto es una fila flex).
- Proporción, HUD compacto, `touch-action`/`user-select`, ocultar `.crt-bottom`, pausa/fin (`active`) y selector de skin (ya está en `SKINNED`): ya cubiertos por la spec 13 y no requieren cambios.
- Pantalla pequeña: con la botonera en T (≈ 122 px) a 375×640 el alto disponible es ≈ 208 px, es decir, una pantalla de ≈ 238×208 px (≈ 63 % del ancho). Es el mismo orden que Caída; se acepta (ver Riesgos).

---

## Alcance

**Dentro:**

- Añadir la entrada `frogger` a `PADS` en `components/touch-controls.tsx` reutilizando `arrow(...)` (cuatro botones `area: "move"`, sin `repeat`, `aria-label` en español: Arriba, Izquierda, Abajo, Derecha).
- En `app/globals.css`, dentro del `@media (pointer: coarse)` existente:
  - `.av-player[data-game="frogger"] { --pad-h: 122px; }` (valor a medir en el paso 2).
  - Cruceta en T centrada: grid de 3 columnas × 2 filas con botones de 52×52 px (≥ 48), `▲` arriba al centro y `◀ ▼ ▶` debajo; mismo patrón que Serpentina/Caída con `grid-area` por `data-code`.
  - `.touch-pad[data-game="frogger"] { justify-content: center; }`.
- Estilo de botonera con `/frontend-design`, coherente con el resto de botones `tc-btn` (cian).

**Fuera:**

- Cambios en `lib/engines/frogger.ts`, contrato `GameEngine`, Supabase y otros juegos.
- Gestos (swipe para saltar, toque en la pantalla), pantalla completa, bloqueo de orientación, vibración.
- Botones de acción (no existen) y repetición automática de saltos al mantener.
- Cambios en `game-player.tsx` (no hacen falta: ya pasa `--screen-ratio`, `data-game` y `active`).

---

## Modelo de datos

Sin tablas ni cambios de esquema. Entrada de `PADS`:

```ts
frogger: [
  arrow("Up", "▲", "Arriba"),
  LEFT,
  arrow("Down", "▼", "Abajo"),
  RIGHT,
],
```

CSS (resumen):

```css
.av-player[data-game="frogger"] {
  --pad-h: 122px;
}
.touch-pad[data-game="frogger"] {
  justify-content: center;
}
.touch-pad[data-game="frogger"] .tc-move {
  display: grid;
  grid-template-columns: repeat(3, 52px);
  grid-auto-rows: 52px;
  gap: 4px;
  grid-template-areas: ". u ." "l d r";
}
/* .tc-btn min-width/min-height: 0 y grid-area por data-code, como serpentina */
```

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (según `AGENTS.md`) y usar `/frontend-design` para el estilo.

1. **Entrada en `PADS`.** Añadir `frogger` a `components/touch-controls.tsx`. Verificación: `npx tsc --noEmit` y `npm run lint`.
2. **CSS táctil.** En `app/globals.css`, reglas `[data-game="frogger"]` dentro del `@media (pointer: coarse)`: `--pad-h`, cruceta en T de 52 px centrada. Medir la altura real de la botonera (botones 2×52 + gap 4 + `margin-top` 14 + holgura) y ajustar `--pad-h`. Verificación: emulación táctil a 375×640: pantalla + HUD + botonera sin scroll vertical ni horizontal; canvas sin bandas ni deformación (8:7).
3. **Prueba funcional en emulación.** Cada botón hace saltar a la rana en su dirección; la primera pulsación inicia la partida; en pausa y en "FIN DEL JUEGO" los botones no hacen nada; el selector de skin sigue funcionando; en escritorio (`pointer: fine`) no hay botonera ni cambios. Multitoque: tocar dos botones seguidos rápido no deja teclas pegadas (los botones emiten `keyup` al soltar).
4. **Prueba en dispositivo real.** `http://<ip-local>:3000/jugar/frogger`: jugar una partida completa, comprobar sin doble toque con zoom ni menú contextual, tamaño cómodo de los botones y que la pantalla se lee con las tres skins. Ajustar `--pad-h`/tamaños si hace falta.
5. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; `git diff` solo toca `components/touch-controls.tsx`, `app/globals.css` y esta spec; marcar la spec como Implementado.

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [ ] No se modifica `lib/engines/*`, `lib/supabase/*` ni `components/game-player.tsx`.
- [ ] En `(pointer: coarse)`, `/jugar/frogger` muestra una cruceta ▲ / ◀ ▼ ▶ centrada bajo la pantalla; en escritorio no se ve ni ocupa espacio.
- [ ] Cada botón hace un salto en su dirección; la primera pulsación inicia la partida.
- [ ] Los botones no hacen nada en pausa ni en fin de partida.
- [ ] Cada botón mide ≥ 48×48 px y tiene `aria-label` en español.
- [ ] A 375×640 no hay scroll horizontal ni vertical; el canvas mantiene 8:7 sin bandas.
- [ ] Tocar o arrastrar en pantalla y botonera no hace scroll, zoom por doble toque ni abre menú contextual.
- [ ] HUD táctil en dos filas con PAUSA, FIN, SALIR y selector de skin tocables; `.crt-bottom` oculto.
- [ ] Sin desajuste de hidratación; escritorio con teclado (flechas/WASD) igual que antes.

---

## Decisiones tomadas y descartadas

- **Sí:** cruceta en T (▲ arriba, ◀ ▼ ▶ debajo) de 52 px, centrada; **No:** fila de 4 botones (pantalla algo mayor pero ▲ es el botón más usado y quedaría mal distinguido) ni cruceta 3×3 como Serpentina (178 px de alto, pantalla muy pequeña).
- **Sí:** un salto por toque, sin `repeat`; **No:** auto-repeat sintético: el motor es por pulsación y repetir saltos mientras se mantiene hace perder la rana con facilidad.
- **Sí:** no tocar `game-player.tsx`; ya cubre todo lo necesario desde la spec 13.
- **Sí:** reutilizar `arrow`/`LEFT`/`RIGHT`; **No:** helpers ni tipos nuevos.

---

## Riesgos identificados

| Riesgo                                                                           | Mitigación                                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Pantalla de ≈ 238 px de ancho en móviles de 640 px de alto: carriles pequeños    | Mismo orden que Caída; en móviles más altos crece. Si resulta ilegible en el paso 4, pasar a fila de 4 botones (`--pad-h` ≈ 86). |
| `--pad-h` mal medido deja botonera cortada o hueco sobrante                      | Medir en el paso 2 con DevTools a 375×640 y en dispositivo real.                                                                 |
| Saltos accidentales por botones muy juntos (gap 4 px)                            | Botones de 52 px; si hay toques erróneos, subir el gap a 6 px y `--pad-h` en consecuencia.                                       |
| Evento `keydown` con `PAGE_KEYS` llama a `preventDefault` en un evento sintético | Inofensivo (el evento sintético no tiene acción por defecto); verificar en el paso 3.                                            |

---

## Qué **no** está en esta spec

- Cambios en el motor, gestos de swipe, pantalla completa, bloqueo de orientación, vibración y controles reasignables.
- Rediseño móvil del resto del sitio.

Cada uno, si se aborda, va en su propia spec.
