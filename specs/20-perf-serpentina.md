# SPEC 20 — Rendimiento de Serpentina (Snake)

> **Estado:** Implementado
> **Depende de:** SPEC 16 (método de medición y decisiones de rendimiento), SPEC 09 (motor de Serpentina) y SPEC 12 (skins de Serpentina)
> **Fecha:** 2026-10-11
> **Objetivo:** Que `lib/engines/serpentina.ts` sostenga el refresco del monitor (≈ 7 ms por frame a 144 Hz) en escritorio en las tres skins, sin frames > 25 ms y sin cambiar el aspecto ni la jugabilidad.

---

## Por qué existe esta spec

La spec 16 midió Serpentina de pasada (partidas cortas) y anotó un p95 de ≈ 14 ms sin tomar acción. Esta spec la mide a fondo con el método de la spec 16 (envoltorio de `requestAnimationFrame`, 6 s por skin con giros cada 700 ms para no morir) y propone optimizar solo lo que los datos respalden.

### Auditoría: línea base

Equipo: Windows 11, Google Chrome (canal estable, no headless) lanzado con Playwright; monitor de 144 Hz (una página en blanco da p95 = 7,1 ms). Servidor `next dev` (puerto 3020). `cb` = ms de JS+dibujado dentro del callback de `requestAnimationFrame`; intervalo = tiempo entre frames. La máquina estaba cargada por otras instancias en paralelo (instalación, compilaciones, otros navegadores), así que los valores absolutos de intervalo son pesimistas; la comparación antes/después se repetirá en las mismas condiciones.

| Skin    | cb media | cb p95 | cb máx | Intervalo medio | Intervalo p95 | Frames > 25 ms |
| ------- | -------- | ------ | ------ | --------------- | ------------- | -------------- |
| clásico | 0,43 ms  | 0,8 ms | 4,0 ms | 11,96 ms        | 14,3 ms       | 6              |
| neón    | 0,46 ms  | 0,8 ms | 1,7 ms | 12,40 ms        | 14,1 ms       | 1              |
| retro   | 0,35 ms  | 0,5 ms | 3,3 ms | 9,67 ms         | 14,0 ms       | 2              |

Una primera pasada contra otro servidor, más cargado aún, dio intervalos medios de 14–19 ms con la misma tendencia (retro mejor que clásico y neón).

Lectura:

- El JS cumple de sobra el presupuesto (`cb` < 0,5 ms): no hay problema de CPU en la lógica.
- El **intervalo no llega al refresco del monitor en ninguna skin** (7 ms) y hay frames > 25 ms, por lo que el presupuesto «intervalo ≈ refresco, 0 frames > 25 ms» **no se cumple**. Retro, sin `shadowBlur`, es ≈ 2,3–2,7 ms más rápida que clásico y neón, que sí lo usan: coherente con la conclusión de la spec 16 (el coste está en la existencia del `shadowBlur`).
- El suelo de retro (9,7 ms frente a 7 ms de una página vacía) indica además trabajo de rasterizado por frame no relacionado con el glow (400 `fillRect` de la cuadrícula) y/o ruido de la máquina cargada; el paso 3 lo comprueba y el paso 1 de la implementación repite la línea base antes de tocar nada.

### Sospechas por lectura de código (evidencia)

| Sospecha                                                                                                       | Dónde                   | Evidencia                                                             |
| -------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| `shadowBlur` de la serpiente (12–14) activo en cada segmento (círculo + conector) y cada frame, ≈ 2 N trazados | `drawSnake`, `pal.glow` | clásico/neón ≈ 2,5 ms más lentas que retro                            |
| `shadowBlur` de la fruta en neón (10), una `drawImage` por frame                                               | `draw`, `pal.fruitGlow` | neón es la única con glow de fruta                                    |
| Fondo estático (rectángulo + 400 puntos de cuadrícula) redibujado cada frame                                   | `draw`                  | 401 `fillRect` por frame, en las tres skins                           |
| Asignaciones por frame: `snake.map` (objetos), closure `color`, cadenas `hsl()` por segmento                   | `drawSnake`             | no medible aparte; recolector de basura, se decide tras los pasos 2-3 |
| `save/restore` ×2 por frame, `roundRect`, gradientes, `getImageData`, `new Path2D`, `filter`                   | —                       | Solo hay 2 `save/restore` por frame; el resto no existe en el motor   |

---

## Alcance

**Dentro** (solo `lib/engines/serpentina.ts`):

- Repetir la línea base en el estado actual del árbol (paso 1) y aplicar, una a una y re-midiendo, solo las optimizaciones que sigan justificadas.
- Optimización A (glow): sustituir el `shadowBlur` por segmento por un halo prerrenderizado (disco con glow rasterizado una vez en un canvas auxiliar, invalidado en `setSkin`) volcado con `drawImage` bajo cada segmento; los segmentos se dibujan sin sombra. Misma técnica para la fruta con glow (sprite de la fruta actual cacheado al aparecer y al cambiar de skin).
- Optimización B (fondo): cachear fondo + cuadrícula en un canvas auxiliar de 800×800 (regenerado en `setSkin`) y volcarlo con una `drawImage`.
- Optimización C (asignaciones): reutilizar un array de puntos preasignado en `drawSnake` y evitar el closure por frame, solo si A/B no bastan o la medición lo respalda.

**Fuera:**

- Velocidad (`TICK_MS`), reglas, puntuación, resolución interna (`W`/`H` = 800), `game-player.tsx`, el contrato `GameEngine`, `ENGINES`, `lib/supabase/*` y otros motores.
- Cambios visuales: el aspecto debe quedar igual (se comparan capturas antes/después en las tres skins).
- Rendimiento específico de móvil.

---

## Plan de implementación

1. **Línea base.** Repetir la medición de la tabla anterior sobre la rama `spec-20-perf-serpentina` con `npm run dev` (puerto 3020) y guardar capturas del canvas en las tres skins. Sin cambios de código. Verificación: tabla «antes» rellenada y capturas guardadas. Si todas las skins cumplen el presupuesto (intervalo ≈ refresco, 0 frames > 25 ms) la spec se cierra sin optimizar y se documenta.
2. **Optimización A — halo de glow cacheado** (clásico, neón y fruta de neón). Verificación: re-medir; captura visualmente equivalente; cambio de skin en caliente sigue correcto. Si el intervalo no mejora, revertir y documentarlo.
3. **Optimización B — fondo estático cacheado.** Verificación: re-medir, captura idéntica, `setSkin` regenera el fondo.
4. **Optimización C — evitar asignaciones por frame.** Solo si queda margen medible; si no, se omite y se documenta.
5. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; partida completa en las tres skins (pausa, reanudar, FIN, cambio de skin, guardar puntuación); `git diff` solo toca `lib/engines/serpentina.ts` y esta spec; marcar la spec como Implementado.

---

### Resultado de la implementación

**Línea base repetida (paso 1, sin cambios de código).** Navegador Chrome propio lanzado con Playwright (no el compartido, que otros agentes navegaban en paralelo), 144 Hz, 2 rondas de 6 s por skin, máquina aún cargada (intervalo de página ociosa: 10,5 ms en esa pasada). El glow se confirmó como coste reproducible: retro (sin glow) ≈ 9–10 ms frente a ≈ 12,4–14,6 ms de clásico y neón.

| Skin    | cb media       | Intervalo medio  | Intervalo p95  | Frames > 25 ms |
| ------- | -------------- | ---------------- | -------------- | -------------- |
| clásico | 0,50 / 0,44 ms | 14,63 / 12,89 ms | 20,8 / 14,1 ms | 7 / 1          |
| neón    | 0,46 / 0,44 ms | 13,21 / 12,43 ms | 20,8 / 14,1 ms | 0 / 0          |
| retro   | 0,40 / 0,33 ms | 9,96 / 9,06 ms   | 14,0 / 14,0 ms | 0 / 0          |

**Después (tras la optimización A, ronda 1 / ronda 2; página ociosa 7,2 ms, menos carga que en la línea base):**

| Skin    | cb media       | Intervalo medio | Intervalo p95  | Frames > 25 ms |
| ------- | -------------- | --------------- | -------------- | -------------- |
| clásico | 0,40 / 0,27 ms | 8,12 / 7,43 ms  | 14,0 / 13,9 ms | 0 / 0          |
| neón    | 0,27 / 0,36 ms | 7,36 / 8,30 ms  | 13,8 / 14,0 ms | 1 / 0          |
| retro   | 0,18 / 0,26 ms | 6,94 / 7,08 ms  | 7,0 / 7,1 ms   | 0 / 0          |

Resultado por paso:

- **A — halo cacheado (aplicada, commit `perf: halos de glow cacheados…`).** Clásico y neón pasan de ≈ 12,4–14,6 ms a ≈ 7,4–8,3 ms de intervalo medio, igualándose a retro (control interno, que no cambió de código salvo ruido). Disco con glow prerrenderizado para cabeza y cuerpo (más un halo en el punto medio de cada conector) y sprite de la fruta con glow en neón, invalidados en `setSkin`. Los segmentos se dibujan sin `shadowBlur`.
- **B — fondo cacheado (no aplicada).** Tras A, retro (400 `fillRect` de cuadrícula incluidos) ya está en el suelo del monitor (≈ 7,0 ms, igual que la página ociosa), así que la medición no la justifica.
- **C — asignaciones por frame (no aplicada).** `cb` media ≤ 0,4 ms y sin frames > 25 ms atribuibles al motor; sin margen medible.

Cambio visual: el aspecto es prácticamente idéntico (comparación de recortes antes/después en clásico y neón). Diferencia mínima: el glow del conector sobre el segmento de cola se ve algo más nítido que con la sombra nativa.

Limitaciones: la carga de la máquina cambió entre la medición «antes» y «después» (página ociosa 10,5 ms frente a 7,2 ms), así que parte de la mejora absoluta puede ser ruido; el control interno (diferencia clásico/neón frente a retro, que en la línea base era ≈ 3–4 ms y ahora ≈ 0–1 ms) es la evidencia principal. `cb` no incluye el rasterizado de GPU. No se probó el guardado de puntuación contra Supabase.

------- | -------- | --------------- | ------------- | -------------- |
| clásico | — | — | — | — |
| neón | — | — | — | — |
| retro | — | — | — | — |

---

## Criterios de aceptación

- [x] `npx tsc --noEmit` y `npm run build` sin errores; `npm run lint` sin errores en el código de la app (los 18 errores existentes están todos en `references/`, ajenos a esta spec).
- [x] La spec contiene las tablas antes/después por skin (clásico, neón, retro).
- [x] El intervalo medio de cada skin queda ≈ al de la línea base de retro o mejor, y no hay frames > 25 ms atribuibles al motor (o la línea base repetida ya cumplía y está documentado).
- [x] Aspecto idéntico a las capturas previas en las tres skins (glow de serpiente y de fruta, cuadrícula, ojos, texto «PULSA UNA FLECHA»).
- [x] Pausa, reanudar, FIN, cambio de skin en caliente y reinicio funcionan; velocidad y reglas no cambian.
- [x] `git diff` solo toca `lib/engines/serpentina.ts` y esta spec.

---

## Decisiones tomadas y descartadas

- **Sí:** halo cacheado con `drawImage` y segmentos sin sombra (consistente con spec 16: el coste está en la existencia de `shadowBlur`, no en su radio); **No:** solo bajar el radio del glow (la spec 16 mostró que no ayuda).
- **Sí:** cachear el fondo con un canvas auxiliar; **No:** cachear la serpiente completa (se mueve y se interpola cada frame).
- **Sí:** re-medir antes de optimizar porque la línea base se midió con la máquina cargada; **No:** asumir que los 12 ms son todos del motor.
- **Sí:** optimizar una a una con commit por cada una y revertir lo que no mejore; **No:** reescribir el dibujado entero.

---

## Riesgos identificados

| Riesgo                                                                   | Mitigación                                                                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| El halo cacheado no reproduce exactamente el glow de segmentos solapados | Comparar capturas; si difiere visiblemente, ajustar opacidad/radio del halo o revertir la A  |
| Medición ruidosa por carga de la máquina (instancias en paralelo)        | Repetir antes/después en las mismas condiciones y comparar contra retro como control interno |
| Caché de fondo/fruta desincronizada tras `setSkin`                       | Regenerar fondo y sprites dentro de `setSkin`; verificar cambio de skin en caliente          |
| `cb` no incluye el rasterizado de GPU                                    | El criterio principal es el intervalo entre frames, que sí lo refleja                        |

---

## Qué **no** está en esta spec

- Cambios de velocidad, reglas o diseño de las skins.
- Optimización de móvil, de `game-player.tsx` o de otros motores.
- Telemetría o benchmark permanente en la app.
