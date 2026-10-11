# SPEC 19 — Arkanoid: rendimiento del dibujado (glow de neón con power-ups, rayos y multibola)

> **Estado:** Implementado (sin cambios de código: la medición no justifica ninguna optimización)
> **Depende de:** SPEC 16 (método de medición y decisión «el coste está en la existencia de `shadowBlur`, no en su radio»), SPEC 17 (mismo patrón de sprites cacheados en Asteroids), SPEC 11 (skins de Arkanoid)
> **Fecha:** 2026-10-11
> **Objetivo:** Mantener el intervalo entre frames de Arkanoid en el refresco del monitor con la skin neón también en los casos densos (multibola X3, rayos y varias cápsulas en pantalla), sin cambiar aspecto ni jugabilidad, tocando solo `lib/engines/arkanoid.ts`.

---

## Por qué existe esta spec

La partida «natural» (una bola, sin power-ups) ya cumple el presupuesto en las tres skins (`cb` 0,2-0,3 ms). Pero el caso con efectos no se había medido, y es el que más `shadowBlur` acumula en neón: paleta, cada bola, cada rayo y cada cápsula llaman a `glowing()` en cada frame (glow 10 px).

Sospechas por lectura de código y su estado tras medir:

| Sospecha                                                                                  | Evidencia                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shadowBlur` por entidad y frame (`glowing()`: paleta, bolas, rayos, cápsulas; solo neón) | **No confirmada**: neón denso (16-37 bolas, 25-35 cápsulas, rayos) dio 8,3 ms en una corrida y 6,94-7,18 ms en las otras cuatro (ruido de otras cargas). Clásico/retro no cambian. |
| ~40-100 `fillRect`/`drawImage` de fondo y bloques por frame                               | **Descartada**: `cb` < 1 ms en todos los casos; sin glow el intervalo es el del monitor. No hay fondo estático que cachear (un `fillRect`).                                        |
| `filter()` y arrays de partículas/bolas/cápsulas por frame                                | **Descartada**: el JS entero (update + draw) cuesta 0,2-0,9 ms de media.                                                                                                           |
| `save/restore`, gradientes, `getImageData`, `Path2D`, `filter` de canvas                  | No existen en el motor (los `.filter` hallados son de arrays). `roundRect` solo en cápsulas, ya dentro de `glowing()`.                                                             |

---

## Alcance

**Dentro:**

- En `lib/engines/arkanoid.ts`: cuando `pal.glow > 0` (solo neón), rasterizar con `drawImage` desde un canvas auxiliar la paleta, la bola, el rayo y la cápsula (una por tipo), invalidando la caché en `setSkin`.
- La bola con SB (color cambiante cada frame) conserva el camino actual con `shadowBlur`: no es cacheable y es una sola bola.
- Mismo color, tamaño y glow (comparación visual neón antes/después).

**Fuera:**

- Velocidades, físicas, dificultad, puntuación, resolución interna (800×600), `game-player.tsx`, contrato `GameEngine`, `ENGINES`, `lib/supabase/*` y otros motores.
- Skins clásico y retro (sin glow; cumplen el presupuesto con margen).
- Cachear fondo y bloques, reescribir `filter()` (descartado por la medición).
- Rendimiento específico de móvil.

---

## Modelo de datos

Sin cambios en tipos públicos ni en `Palette`. Estado nuevo privado dentro del closure del motor:

```ts
// Solo con glow (neón): sprites rasterizados una vez por forma
const glowCache = new Map<string, HTMLCanvasElement>(); // clave: "paddle<w>", "ball", "laser", "pu<tipo>"
// se vacía en setSkin
```

El sprite se crea en un canvas de tamaño `forma + 2·margen` (margen = 2 × glow) con el mismo `fillStyle`, `shadowColor` y `shadowBlur` que hoy, y se vuelca en `x - margen, y - margen`. El texto de la cápsula ya se dibuja fuera del glow y no cambia.

---

## Plan de implementación

1. **Línea base de rendimiento (con power-ups).** Ya realizada (tabla abajo). Sin cambios de código.
2. **(Probado y revertido)** **Sprites con glow para paleta, bola, rayo y cápsula (neón).** `drawImage` desde caché cuando `pal.glow > 0`; con glow 0 el camino actual queda intacto. Vaciar la caché en `setSkin`. Volver a medir; si el intervalo no mejora, revertir y documentarlo. Verificación: `tsc`, `lint`.
3. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; `git diff` solo toca esta spec (sin cambios en el motor); marcar la spec como Implementado.

No hay paso para fondo/bloques/asignaciones: la medición no los justifica.

---

### Resultado de la implementación

**Conclusión: no se aplica ninguna optimización.** Se probó el paso 2 (sprites con `drawImage` para paleta, bola, rayo y cápsula en neón) y se **revirtió**: no mejora el intervalo (ya está en el refresco del monitor sin ella) y duplica el `cb` medio (0,3-0,5 → 0,4-0,9 ms) por el volcado de sprites. El código de `lib/engines/arkanoid.ts` queda sin cambios.

**Paso 1 — línea base (Windows 11, Chrome 154, monitor ≈ 144 Hz, intervalo ideal ≈ 6,9 ms, 6 s por caso).** Motor transpilado y ejecutado en página mínima (canvas 800×600, mismo código del motor con un gancho que expone el estado interno solo para la medición; `requestAnimationFrame` envuelto como en la SPEC 16). El caso «denso» fuerza: 10 o más bolas (X3 repetido), láser permanente con disparo continuo y 3 cápsulas nuevas cada 250 ms.

| Skin / caso      | cb media | cb p95 | Intervalo medio | Intervalo p95 | Frames > 25 ms |
| ---------------- | -------- | ------ | --------------- | ------------- | -------------- |
| clásico, natural | 0,24 ms  | 0,4 ms | 7,04 ms         | 7,1 ms        | 2 (arranque)   |
| neón, natural    | 0,34 ms  | 0,7 ms | 6,96 ms         | 7,1 ms        | 0              |
| retro, natural   | 0,20 ms  | 0,4 ms | 6,94 ms         | 7,1 ms        | 0              |
| clásico, denso   | 0,83 ms  | 1,6 ms | 6,95 ms         | 7,1 ms        | 0              |
| neón, denso      | 0,91 ms  | 1,8 ms | 8,32 ms         | 13,9 ms       | 4              |
| retro, denso     | 0,56 ms  | 1,2 ms | 6,94 ms         | 7,1 ms        | 0              |

**Repetición neón denso, antes (sin cambios) frente a la prueba con sprites (revertida), misma sesión, alternadas:**

| Corrida | Antes: cb / intervalo medio / frames > 25 ms | Prueba sprites: cb / intervalo medio / frames > 25 ms |
| ------- | -------------------------------------------- | ----------------------------------------------------- |
| 1       | 0,91 ms / 8,32 ms / 4 (primera medición)     | —                                                     |
| 2       | 0,47 ms / 7,03 ms / 0                        | 0,90 ms / 6,95 ms / 0                                 |
| 3       | 0,31 ms / 6,94 ms / 0                        | 0,76 ms / 6,96 ms / 0                                 |
| 4       | 0,40 ms / 7,18 ms / 0                        | 0,45 ms / 6,94 ms / 0                                 |
| 5       | 0,33 ms / 6,94 ms / 0                        | 0,77 ms / 7,08 ms / 1 (pico aislado de 118 ms)        |

Lectura: con 16-37 bolas, 25-35 cápsulas y rayos en pantalla, neón mantiene 6,9-7,2 ms (144 Hz). El 8,32 ms inicial coincidió con otras instancias de agente cargando la máquina y no se reprodujo. Clásico y retro, con la prueba, quedan en 6,94 ms (igual que antes).

**No verificado:** `npm run dev` en `/jugar/arkanoid` con partida real y power-ups naturales (se midió el motor transpilado en página mínima con entidades forzadas; el gancho de medición no forma parte del repo); GPU distinta de la del equipo de pruebas (con GPU más débil el `shadowBlur` podría pesar más; si aparece, reabrir con el paso 2 ya descrito).

---

## Criterios de aceptación

- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan (ver notas de verificación en el informe de la tarea).
- [x] Neón denso mantiene intervalo medio ≈ refresco del monitor y 0 frames > 25 ms.
- [x] Clásico y retro no empeoran respecto a la línea base.
- [x] Sin cambios de código: el aspecto es idéntico por construcción (no aplica comparar capturas).
- [x] Sin caché de sprites no hay riesgo de restos al cambiar de skin (no aplica).
- [x] Colisiones, puntuación, velocidades y dificultad no cambian; `git diff` solo toca esta spec.
- [x] La spec contiene las tablas antes/después.

---

## Decisiones tomadas y descartadas

- **Sí:** sprites cacheados para las entidades con glow (el coste está en la existencia de `shadowBlur`, no en su radio); **No:** bajar el radio del glow (cambia el aspecto, no reduce el coste).
- **Sí:** cachear solo con `glow > 0`; **No:** tocar clásico/retro.
- **Sí:** la bola SB sigue con `shadowBlur` directo (cambia de color cada frame); **No:** cachear 360 tonos.
- **No:** cachear fondo/bloques ni reescribir `filter()`: el JS cuesta < 1 ms.

---

## Riesgos identificados

| Riesgo                                                                                  | Mitigación                                                                          |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `drawImage` con coordenadas fraccionarias suaviza más que el vector                     | Comparar capturas; si se nota, redondear la posición solo en el volcado o revertir. |
| Caché desincronizada tras `setSkin`                                                     | Vaciar la caché en `setSkin`.                                                       |
| El caso denso es sintético (la medición inyecta cápsulas y bolas), más extremo que real | Se documenta; la mejora en el extremo no empeora el caso natural, que ya cumplía.   |
| Ruido por otras cargas en la máquina                                                    | Comparar antes/después en la misma sesión y repetir.                                |

---

## Qué **no** está en esta spec

- Cambios de velocidad, física, dificultad o puntuación.
- Cambios en `game-player.tsx`, el contrato `GameEngine`, `ENGINES` o `lib/supabase/*`.
- Otros motores y optimización específica para móvil.
- Telemetría o benchmark permanente dentro de la app.
