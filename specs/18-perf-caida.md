# SPEC 18 — Rendimiento de Caída (THETRIS)

> **Estado:** Aprobado
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

_(pendiente)_

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [ ] La spec contiene la tabla antes/después.
- [ ] El aspecto del tablero es idéntico antes y después.
- [ ] `git diff` solo toca `lib/engines/tetris.ts` y esta spec.
- [ ] Pausa, reanudar, FIN y guardar puntuación siguen funcionando; el contrato `GameEngine` no cambia.

---

## Decisiones tomadas y descartadas

- **Sí:** medir antes de optimizar; **No:** reescribir el renderizado a ciegas.
- **Sí:** cachear solo la cuadrícula (única sospecha); **No:** tocar `drawBlock` ni el panel lateral (rellenos baratos, sin evidencia).
- **Sí:** documentar que el beneficio esperado es pequeño si la línea base ya cumple el presupuesto.

---

## Riesgos identificados

| Riesgo                                                          | Mitigación                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `drawImage` cuesta lo mismo o más que 30 trazos                 | Se mide tras el cambio; si no mejora, se revierte y se documenta.           |
| Cuadrícula con líneas de 0,5 px distinta tras la caché          | Misma geometría y estilo; comparar capturas antes/después.                  |
| La medición varía según equipo/navegador                        | Anotar equipo, navegador y refresco; comparar en la misma máquina.          |

---

## Qué **no** está en esta spec

- Cambios en otros motores o en jugabilidad.
- Telemetría o benchmark permanente.
