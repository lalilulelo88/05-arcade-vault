# SPEC 20 — Rendimiento de Serpentina (Snake)

> **Estado:** Aprobado
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

_(Se rellena al implementar.)_

**Antes** (ver tabla de auditoría).

**Después:**

| Skin    | cb media | Intervalo medio | Intervalo p95 | Frames > 25 ms |
| ------- | -------- | --------------- | ------------- | -------------- |
| clásico | —        | —               | —             | —              |
| neón    | —        | —               | —             | —              |
| retro   | —        | —               | —             | —              |

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [ ] La spec contiene las tablas antes/después por skin (clásico, neón, retro).
- [ ] El intervalo medio de cada skin queda ≈ al de la línea base de retro o mejor, y no hay frames > 25 ms atribuibles al motor (o la línea base repetida ya cumplía y está documentado).
- [ ] Aspecto idéntico a las capturas previas en las tres skins (glow de serpiente y de fruta, cuadrícula, ojos, texto «PULSA UNA FLECHA»).
- [ ] Pausa, reanudar, FIN, cambio de skin en caliente y reinicio funcionan; velocidad y reglas no cambian.
- [ ] `git diff` solo toca `lib/engines/serpentina.ts` y esta spec.

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
