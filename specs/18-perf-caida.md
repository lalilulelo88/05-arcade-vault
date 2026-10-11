# SPEC 18 — Rendimiento de Caída (THETRIS)

> **Estado:** Implementado
> **Depende de:** SPEC 16 (método de medición de rendimiento), SPEC 07 (Caída jugable)
> **Fecha:** 2026-10-11
> **Objetivo:** Medir el coste de frame de `lib/engines/tetris.ts` en escritorio y aplicar solo la optimización que los datos justifiquen, sin cambiar el aspecto ni la jugabilidad.

---

## Por qué existe esta spec

La spec 16 midió Caída como «dentro de presupuesto» sin tocarla. Se repite la medición con el método de la spec 16 (wrapper de `requestAnimationFrame`, 6 s de teclas alternas) y se revisa el motor. Caída no tiene skins.

Sospecha por lectura de código (no verificada): `draw()` ejecuta ~30 `beginPath/moveTo/lineTo/stroke` por frame para la cuadrícula del tablero, que es estática. No hay `shadowBlur`, gradientes, `roundRect` ni `getImageData`; los `save/restore` son uno por destello de combo.

---

## Alcance

**Dentro:**

- En `lib/engines/tetris.ts`: línea base, y, si la medición no empeora, cachear la cuadrícula y el borde del tablero en un canvas auxiliar volcado con `drawImage`.

**Fuera:**

- Velocidades, física, puntuación, resolución interna (480×600), `game-player.tsx`, `ENGINES`, contrato `GameEngine`, `lib/supabase/*`, otros motores.
- Rendimiento específico de móvil.

---

## Plan de implementación

1. **Línea base.** Medir 6 s de partida en escritorio. Sin cambios de código. Verificación: tabla «antes» rellenada.
2. **Caché de la cuadrícula.** Dibujar una sola vez las líneas de cuadrícula y el borde del tablero en un canvas auxiliar (`document.createElement("canvas")`, `BOARD_W+1` × `H`) y volcarlo con `drawImage` al inicio de `draw()`. Si el intervalo o el `cb` medidos no mejoran o empeoran, revertir y documentarlo. Verificación: captura idéntica antes/después y tabla «después».
3. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; `git diff` solo toca `lib/engines/tetris.ts` y esta spec.

---

### Resultado de la implementación

Equipo: Windows 11, Chrome 154 (Playwright) a ~144 Hz, `npm run dev` (Turbopack). 6 s de partida con teclas alternas.

| Medida               | Antes | Después   |
| -------------------- | ----- | --------- |
| `cb` media (ms)      | 0,42  | 0,24      |
| `cb` p95 (ms)        | 0,60  | 0,40-0,50 |
| `cb` máx (ms)        | 4,50  | 1,70-2,70 |
| Intervalo medio (ms) | 3,47* | 9,1-9,8*  |
| Frames > 25 ms       | 0     | 0-1       |

\* El intervalo **no es comparable** entre ambas pasadas: el navegador de Playwright lo compartían otros agentes midiendo a la vez, y la pasada «antes» registró ~256 frames/s (más de un bucle por la carga de página), la «después» ~105 frames/s. El único indicador fiable es `cb` (CPU del callback), que baja de 0,42 a 0,24 ms. `cb` no incluye el rasterizado de GPU.

Conclusión honesta: la línea base ya cumplía el presupuesto (`cb` ≤ 8 ms). El caché de la cuadrícula ahorra ~0,2 ms por frame (beneficio marginal, sin efecto perceptible); se mantiene porque no empeora nada y el aspecto es idéntico (captura comparada). `tsc` y `eslint` sobre el motor sin errores, `npm run build` correcto. `npm run lint` global falla por errores preexistentes en `references/` (fuera de alcance).

---

## Criterios de aceptación

- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [x] La spec contiene la tabla antes/después.
- [x] El aspecto del tablero es idéntico antes y después.
- [x] `git diff` solo toca `lib/engines/tetris.ts` y esta spec.
- [x] Pausa, reanudar, FIN y guardar puntuación siguen funcionando; el contrato `GameEngine` no cambia.

---

## Decisiones tomadas y descartadas

- **Sí:** medir antes de optimizar; **No:** reescribir el renderizado a ciegas.
- **Sí:** cachear solo la cuadrícula (única sospecha); **No:** tocar `drawBlock` ni el panel lateral (rellenos baratos, sin evidencia).
- **Sí:** documentar que el beneficio esperado es pequeño si la línea base ya cumple el presupuesto.

---

## Riesgos identificados

| Riesgo                                                 | Mitigación                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `drawImage` cuesta lo mismo o más que 30 trazos        | Se mide tras el cambio; si no mejora, se revierte y se documenta.  |
| Cuadrícula con líneas de 0,5 px distinta tras la caché | Misma geometría y estilo; comparar capturas antes/después.         |
| La medición varía según equipo/navegador               | Anotar equipo, navegador y refresco; comparar en la misma máquina. |

---

## Qué **no** está en esta spec

- Cambios en otros motores o en jugabilidad.
- Telemetría o benchmark permanente.
