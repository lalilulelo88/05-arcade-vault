# SPEC 17 — Asteroids: rendimiento del dibujado (glow de neón con muchas entidades)

> **Estado:** Aprobado
> **Depende de:** SPEC 16 (método de medición y decisión «el coste está en la existencia de `shadowBlur`, no en su radio»), SPEC 05 (motor de Asteroids), SPEC 10 (skins de Asteroids)
> **Fecha:** 2026-10-11
> **Objetivo:** Mantener el intervalo entre frames de Asteroids en el refresco del monitor también cuando hay muchas entidades en pantalla con la skin neón, sin cambiar el aspecto ni la jugabilidad, tocando solo `lib/engines/asteroids.ts`.

---

## Por qué existe esta spec

La línea base «natural» (partida corta, pocas entidades) **ya cumple** el presupuesto en las tres skins. La spec se justifica por el caso denso: un asteroide grande se parte en 2 medianos y estos en 4 pequeños, así que en el nivel 1 pueden coincidir hasta 28 asteroides (más en niveles altos, `3 + level` iniciales). En neón cada asteroide, bala, power-up y la nave llaman a `shadowBlur` en cada frame, y la SPEC 16 demostró que ese coste (rasterizado) crece con el número de entidades con glow aunque el JS siga siendo trivial.

Sospechas por lectura de código, y su estado tras medir:

| Sospecha                                                                                                      | Evidencia                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shadowBlur` por entidad y frame (`glow()` en `Bullet`, `Asteroid`, `PowerUp`, `Ship`; neón 6–10 px)          | **Confirmada**: con 14 asteroides neón el intervalo sube a 8,5 ms; con 30, a 16,8 ms. Clásico/retro no cambian (7,0 ms).                              |
| `ctx.save()/restore()` por entidad                                                                            | No medida como cuello de botella (`cb` < 1,3 ms de media en todos los casos). Solo se toca si tras la optimización 1 sigue habiendo margen que ganar. |
| Fondo estático redibujado                                                                                     | **Descartada**: el fondo es un único `fillRect`, no hay nada que cachear.                                                                             |
| Asignaciones por frame (`filter`, `concat`, `bullets.push(...)`, template string de color en `Particle.draw`) | Menor; el JS ocupa < 1,3 ms de media (`cb`). No justifica cambios por sí sola.                                                                        |
| `roundRect`, gradientes, `getImageData`, `Path2D`, `filter` de canvas                                         | No existen en el motor (los `.filter` hallados son de arrays).                                                                                        |

---

## Alcance

**Dentro:**

- En `lib/engines/asteroids.ts`, solo si la medición del paso 1 lo confirma: rasterizar con `drawImage` desde un canvas auxiliar las entidades que hoy usan `shadowBlur` (solo cuando `pal.glow.<entidad> > 0`, es decir, neón), invalidando la caché en `setSkin`.
- Mantener el aspecto: mismo color, grosor y glow (comparación de capturas neón antes/después).

**Fuera:**

- Velocidades, físicas, dificultad, puntuación, resolución interna (800×600), `game-player.tsx`, contrato `GameEngine`, `ENGINES`, `lib/supabase/*` y otros motores.
- Skins clásico y retro (no usan glow; cumplen el presupuesto con margen).
- Rendimiento específico de móvil.
- Cachear el fondo (no hay nada estático que cachear).

---

## Modelo de datos

Sin cambios en tipos públicos ni en `Palette`. Estado nuevo privado dentro del closure del motor (sin estado de módulo):

```ts
// Solo con glow (neón): sprites rasterizados una vez por forma
let spriteCache = new Map<object, HTMLCanvasElement>(); // clave: Asteroid / "ship" / "bullet" / "powerUp"
// se vacía en setSkin
```

El sprite de un asteroide se crea en el primer `draw()` (cada asteroide tiene su polígono `verts` irregular) en un canvas de tamaño `2·(radius + margen)` con margen = `glow + lineWidth`, sin rotación; el `draw()` aplica `translate/rotate` y `drawImage` centrado. Nave, bala y power-up se rasterizan una sola vez (la nave sin llama; la llama sigue dibujándose aparte, sin glow, como hoy; el power-up sin el pulso, que se aplica con `scale` al volcar).

---

## Plan de implementación

1. **Línea base de rendimiento.** Ya realizada para esta spec (tablas abajo). Sin cambios de código. Verificación: tabla rellenada.
2. **Sprites con glow para asteroides, balas, nave y power-up (neón).** Cuando `pal.glow.<entidad> > 0`, dibujar con `drawImage` desde la caché; con glow 0 el camino actual queda intacto. Vaciar la caché en `setSkin`. Volver a medir en las tres skins con el caso denso; si el intervalo no mejora, revertir y documentarlo. Verificación: `tsc`, `lint`; captura neón idéntica a la de antes; cambio de skin en caliente sin restos del glow.
3. **(Condicional) Agrupar `save/restore` y evitar asignaciones por frame.** Solo si tras el paso 2 neón sigue por encima del presupuesto en el caso denso. Un commit y medición aparte.
4. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; `git diff` solo toca `lib/engines/asteroids.ts` y esta spec; partida completa en las tres skins (disparo, power-up 3x, muerte, nivel nuevo, pausa, fin); marcar la spec como Implementado.

---

### Resultado de la implementación

**Entorno de medición:** Windows 11, Chrome 154 (Playwright), monitor ≈ 144 Hz (intervalo ideal ≈ 6,9 ms), 6 s por skin con entradas alternas (girar, empuje, disparo) inyectadas como eventos de teclado. Otras instancias de agente corrían en paralelo en la misma máquina, así que hay ruido. Limitación: `npm run dev` no estaba disponible en el worktree (sin `node_modules`), por lo que el motor `lib/engines/asteroids.ts` se transpiló con TypeScript y se ejecutó en una página mínima (canvas 800×600, mismo código del motor, `requestAnimationFrame` envuelto como en la SPEC 16). `cb` no incluye el rasterizado de GPU; el intervalo sí lo refleja.

**Paso 1 — línea base, partida natural (4 asteroides iniciales):**

| Skin    | cb media | cb p95 | cb máx  | Intervalo medio | Intervalo p95 | Frames > 25 ms |
| ------- | -------- | ------ | ------- | --------------- | ------------- | -------------- |
| clásico | 0,71 ms  | 2,2 ms | 15,1 ms | 6,98 ms         | 7,1 ms        | 0              |
| neón    | 0,54 ms  | 1,3 ms | 6,9 ms  | 6,96 ms         | 7,1 ms        | 0              |
| retro   | 0,40 ms  | 1,1 ms | 4,6 ms  | 6,98 ms         | 7,1 ms        | 0              |

(El máximo de `cb` de clásico es el calentamiento del primer frame tras cargar.) Cumple el presupuesto en las tres skins.

**Paso 1 — caso denso (mismo motor con más asteroides iniciales para simular un pico de fragmentación):**

| Skin    | Asteroides | cb media | Intervalo medio    | Intervalo p95 | Frames > 25 ms |
| ------- | ---------- | -------- | ------------------ | ------------- | -------------- |
| clásico | 14         | 0,87 ms  | 6,96 ms            | 7,1 ms        | 0              |
| neón    | 14         | 0,77 ms  | 8,49 ms (≈118 fps) | 13,9 ms       | 1              |
| clásico | 30         | 0,99 ms  | 6,96 ms            | 7,0 ms        | 0              |
| neón    | 30         | 0,99 ms  | 16,79 ms (≈60 fps) | 20,9 ms       | 1              |
| retro   | 30         | 1,20 ms  | 6,96 ms            | 7,0 ms        | 0              |

Lectura: el JS es trivial (≈ 1 ms) en todos los casos; el deterioro es solo de neón y crece con el número de entidades con `shadowBlur`, igual que en Frogger (SPEC 16).

**Después (por rellenar al implementar):**

| Skin / caso   | cb media | Intervalo medio | Intervalo p95 | Frames > 25 ms |
| ------------- | -------- | --------------- | ------------- | -------------- |
| neón, natural | —        | —               | —             | —              |
| neón, 14      | —        | —               | —             | —              |
| neón, 30      | —        | —               | —             | —              |
| clásico, 30   | —        | —               | —             | —              |
| retro, 30     | —        | —               | —             | —              |

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [ ] Neón con 30 asteroides mantiene un intervalo medio ≈ refresco del monitor (≤ 8 ms en el equipo de pruebas) y 0 frames > 25 ms.
- [ ] Clásico y retro no empeoran respecto a la línea base.
- [ ] Capturas neón antes/después visualmente equivalentes (color, grosor y glow de nave, asteroides, balas y power-up).
- [ ] Cambio de skin en caliente (`setSkin`) redibuja correctamente, sin sprites de la skin anterior.
- [ ] La colisión, la puntuación, las velocidades y la dificultad no cambian; `git diff` solo toca `lib/engines/asteroids.ts` y esta spec.
- [ ] La spec contiene las tablas antes/después por skin.

---

## Decisiones tomadas y descartadas

- **Sí:** sprites cacheados por entidad con glow (el coste está en la existencia de `shadowBlur`, no en su radio, según SPEC 16); **No:** bajar el radio del glow o quitarlo en neón (cambia el aspecto y no reduce el coste).
- **Sí:** cachear solo cuando `glow > 0`; **No:** tocar el camino de clásico/retro, que ya cumple.
- **Sí:** sprite por asteroide, creado al primer dibujo (cada polígono es único); **No:** reducir la variedad de formas para compartir sprites (cambia la jugabilidad visual).
- **No:** cachear el fondo (un `fillRect`) ni reescribir `filter/concat` por adelantado: el JS cuesta ≈ 1 ms.
- **Sí:** el paso 3 es condicional a una nueva medición.

---

## Riesgos identificados

| Riesgo                                                                                | Mitigación                                                                                               |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| El sprite rotado con `drawImage` se ve ligeramente más borroso que el trazo vectorial | Comparar capturas; si se nota, rasterizar a mayor escala o descartar la optimización y documentarlo.     |
| Memoria: un canvas por asteroide (hasta decenas, ≤ 110×110 px)                        | Se liberan al morir el asteroide (la caché es una `Map` limpiada al destruirlo o un campo en el objeto). |
| Caché desincronizada tras `setSkin`                                                   | Vaciar la caché en `setSkin`; verificar con cambio de skin en caliente.                                  |
| La medición varía por otras cargas en la máquina o por el refresco del monitor        | Anotar equipo y refresco; comparar antes/después en la misma máquina y condiciones.                      |
| El caso denso es sintético (más asteroides iniciales), no una partida real            | Los picos reales de fragmentación (hasta 28 en nivel 1) están en ese rango; documentado.                 |

---

## Qué **no** está en esta spec

- Cambios de velocidad, física, dificultad o puntuación.
- Cambios en `game-player.tsx`, el contrato `GameEngine`, `ENGINES` o `lib/supabase/*`.
- Otros motores y optimización específica para móvil.
- Telemetría o benchmark permanente dentro de la app.

Cada uno, si se aborda, va en su propia spec.
