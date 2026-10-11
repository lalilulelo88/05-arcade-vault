# SPEC 16 — Frogger: velocidad a la mitad, tortugas fijas y rendimiento

> **Estado:** Implementado
> **Depende de:** SPEC 14 (skins de Frogger; motor en `specs/game-jam/frogger/01-frogger-core.md`)
> **Fecha:** 2026-10-11
> **Objetivo:** Reducir a la mitad la velocidad de todos los sprites de Frogger, dejar las tortugas siempre visibles y eliminar los tirones en escritorio midiendo antes de optimizar `lib/engines/frogger.ts`, y medir (sin tocar) los otros cuatro motores.

---

## Por qué existe esta spec

Tres cambios sobre el mismo motor:

- **Velocidad.** Hoy los carriles van de 1 a 4 px/frame a 60 fps (≈ 60–240 px/s sobre un canvas de 640 px) y suben un 15 % por nivel. Resulta demasiado rápido.
- **«Cocodrilos».** En el motor actual no hay cocodrilos (solo existen en las specs de `game-jam/ranaria`). Lo que desaparece son las **tortugas**, que se sumergen 1,5 s de cada 4,5 s. Se confirmó con el usuario que ese es el comportamiento a quitar.
- **Rendimiento.** El usuario nota tirones solo en **escritorio**, sin skin concreta. Sospechas por lectura de código (no verificadas): `shadowBlur` en cada entidad y cada frame (`glow` = 8 en neón), `ctx.save()/restore()` por entidad, `roundRect` por vehículo/tronco y redibujado completo del fondo estático (zonas, líneas discontinuas, bocas) en cada frame. Por eso el primer paso es medir.

---

## Alcance

**Dentro:**

- En `lib/engines/frogger.ts`:
  - Constante `SPEED_SCALE = 0.5` aplicada una sola vez en `buildLanes` (`speed: d.speed * factor * SPEED_SCALE`). Conserva la proporción entre carriles y el +15 % por nivel; el arrastre de la rana sobre troncos/tortugas usa `lane.speed`, así que se escala solo.
  - Tortugas siempre visibles: eliminar `TURTLE_VISIBLE_MS`, `TURTLE_SUBMERGED_MS`, `TURTLE_CYCLE_MS`, `Entity.submerged`, `Entity.phase`, `clock`, el cálculo de inmersión en `update`, la condición `!e.submerged` en `getSupport` y la rama de dibujado «hundida» (`turtleSunk` en `Palette` y en las tres paletas). Las tortugas pasan a ser soporte permanente.
  - Medir el coste de frame en escritorio por skin (clásico, neón, retro) con el Profiler de Chrome DevTools antes y después, y aplicar solo las optimizaciones que la medición justifique. Candidatas, por orden de impacto esperado:
    1. Cachear el fondo estático (zonas, olas retro, líneas de carril, marco de las bocas) en un `OffscreenCanvas`/canvas auxiliar y volcarlo con `drawImage` cada frame (se regenera al cambiar de skin con `setSkin`).
    2. Reducir el coste de `shadowBlur` en neón (aplicarlo por lote por color o reducir `glow`) sin perder el aspecto.
    3. Evitar trabajo por frame repetido (`roundRect` → paths reutilizados, `save/restore` agrupados).
- Medir (solo medir y documentar) el coste de frame de `asteroids`, `tetris`, `arkanoid` y `serpentina` con las mismas condiciones, y anotar el resultado en esta spec. Si alguno supera el presupuesto, queda registrado como candidato a su propia spec.
- Actualizar `specs/game-jam/frogger/01-frogger-core.md` solo si menciona la inmersión de tortugas o velocidades de forma que contradiga lo nuevo (una línea de nota remitiendo a esta spec).

**Fuera (para otras specs):**

- Cualquier cambio en los motores `asteroids`, `tetris`, `arkanoid` y `serpentina`, aunque la medición revele problemas.
- Añadir cocodrilos u otras entidades nuevas.
- Rendimiento específico de móvil, cambios de resolución interna (640×560), cambios en `game-player.tsx`, `touch-controls.tsx`, CSS o Supabase.
- Rebalanceo de la dificultad más allá del multiplicador (tiempo de ronda, vidas, puntos, +15 % por nivel).
- Sistema de benchmark permanente o telemetría en la app.

---

## Modelo de datos

No introduce estructuras nuevas; **elimina** campos. Cambios en `lib/engines/frogger.ts`:

```ts
// Nuevo
const SPEED_SCALE = 0.5; // multiplicador global sobre las velocidades base de ROAD/RIVER

// Eliminados
// TURTLE_VISIBLE_MS, TURTLE_SUBMERGED_MS, TURTLE_CYCLE_MS (export)
// Entity.submerged, Entity.phase, Palette.turtleSunk, estado `clock`

type Entity = {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
};
```

Convenciones: `speed` sigue en px/frame a 60 fps; `SPEED_SCALE` se aplica solo en `buildLanes`. Presupuesto de rendimiento: ≤ 8 ms de trabajo de JS+render por frame (50 % de 16,6 ms) en la media de 5 s de partida, en escritorio.

---

## Plan de implementación

Antes del paso 1: leer la guía relevante de `node_modules/next/dist/docs/` si se toca algo de cliente (según `AGENTS.md`); aquí solo se edita un motor de canvas.

1. **Línea base de rendimiento.** Con `npm run dev` y el Profiler de Chrome (pestaña Performance, 5 s de partida) medir ms por frame y frames largos de Frogger en las tres skins; anotar los números en la sección «Resultado de la implementación». Sin cambios de código. Verificación: tabla de 3 filas rellenada.
2. **Velocidad.** Añadir `SPEED_SCALE = 0.5` en `buildLanes`. Verificación: `npx tsc --noEmit`, `npm run lint`; en el nivel 1 el carril más rápido (fila 12, antes 4 px/frame) recorre el canvas de 640 px en ≈ 5,3 s en lugar de ≈ 2,7 s.
3. **Tortugas fijas.** Quitar el ciclo de inmersión y todo lo asociado (ver Alcance). Verificación: `tsc`/`lint` sin referencias huérfanas (`grep submerged|TURTLE_|turtleSunk|phase` sin resultados en `lib/`), las tortugas no desaparecen en una partida de 2 minutos con las tres skins.
4. **Optimización medida.** Aplicar, una por una y con commit por cada una, solo las candidatas que el paso 1 justifique, volviendo a medir tras cada una. Si la línea base ya cumple el presupuesto en las tres skins, este paso se omite y se documenta. Verificación: tabla «después» ≤ 8 ms/frame de media en las tres skins; cambio de skin en caliente (`setSkin`) sigue redibujando bien el fondo.
5. **Medición de los otros cuatro motores.** Mismo procedimiento que el paso 1 para `asteroids`, `tetris`, `arkanoid` y `serpentina`, sin editar sus archivos; anotar el resultado y, si alguno falla el presupuesto, el nombre de la spec candidata. Verificación: `git diff` no toca `lib/engines/` salvo `frogger.ts`.
6. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; partida completa en las tres skins (pausa, fin, guardar puntuación); marcar la spec como Implementado.

---

### Resultado de la implementación

**Paso 1 — línea base** (Playwright/Chromium headless, escritorio, 6 s de partida por skin; `cb` = ms de JS+dibujado dentro del callback de `requestAnimationFrame`, `intervalo` = tiempo entre frames):

| Skin    | cb media | cb p95 | cb máx | Intervalo medio   | Intervalo p95 | Frames > 25 ms |
| ------- | -------- | ------ | ------ | ----------------- | ------------- | -------------- |
| clásico | 0,37 ms  | 0,6 ms | 1,3 ms | 7,0 ms (≈143 fps) | 7,1 ms        | 0              |
| neón    | 0,31 ms  | 0,5 ms | 0,8 ms | 12,1 ms (≈82 fps) | 14,0 ms       | 1              |
| retro   | 0,32 ms  | 0,5 ms | 2,8 ms | 6,9 ms (≈144 fps) | 7,2 ms        | 0              |

Lectura: el JS de Frogger es trivial (< 1 ms) en las tres skins, así que el presupuesto de 8 ms de JS+dibujado ya se cumple. La diferencia está en el **rasterizado**: neón no sostiene los ≈144 Hz del monitor de pruebas (12 ms por frame frente a 7 ms), coherente con el `shadowBlur` por entidad. Clásico y retro no tienen problema. Limitación: `cb` no incluye el rasterizado de GPU; el intervalo sí lo refleja. Por tanto el paso 4 se centra en neón (reducir el coste de `shadowBlur`) y el caché de fondo solo se aplica si mejora el intervalo medido.

**Paso 4 — optimización.** Quitar el glow de los detalles (ruedas, ventanas, vetas, ojos) apenas mejoró neón (12,1 → 11,7 ms) y bajar `glow` de 8 a 4 no lo cambió (12,4 ms), mientras que `glow: 0` bajaba a 7,0 ms: el coste está en la existencia del `shadowBlur`, no en su radio. Solución aplicada: con glow, cada carril se rasteriza una vez en un canvas auxiliar (sprite con margen de 16 px, se invalida en `setSkin`) y se vuelca con `drawImage`; el aspecto neón se mantiene (verificado con captura). No se cacheó el fondo estático porque clásico y retro ya iban a 7 ms (límite del monitor de pruebas).

| Skin    | cb media | Intervalo medio    | Intervalo p95 | Frames > 25 ms |
| ------- | -------- | ------------------ | ------------- | -------------- |
| clásico | 0,43 ms  | 7,0 ms (≈143 fps)  | 7,2 ms        | 0              |
| neón    | 0,34 ms  | 7,0 ms (≈144 fps)  | 7,2 ms        | 0              |
| retro   | 0,41 ms  | 7,0 ms (≈144 fps)  | 7,2 ms        | 0              |

**Paso 5 — otros motores** (mismo método, 6 s de entradas de teclado alternas tras Espacio/Enter/↑; partidas cortas, sin tocar sus archivos):

| Juego/skin          | cb media | Intervalo medio | Intervalo p95 | Frames > 25 ms |
| ------------------- | -------- | --------------- | ------------- | -------------- |
| asteroids clásico   | 0,11 ms  | 6,95 ms         | 7,2 ms        | 0              |
| asteroids neón      | 0,12 ms  | 6,97 ms         | 7,2 ms        | 0              |
| asteroids retro     | 0,11 ms  | 6,96 ms         | 7,2 ms        | 0              |
| caída (única skin)  | 0,15 ms  | 6,96 ms         | 7,2 ms        | 0              |
| arkanoid clásico    | 0,20 ms  | 6,96 ms         | 7,2 ms        | 0              |
| arkanoid neón       | 0,19 ms  | 6,97 ms         | 7,1 ms        | 0              |
| arkanoid retro      | 0,21 ms  | 6,95 ms         | 7,1 ms        | 0              |
| serpentina clásico  | 0,28 ms  | 7,74 ms         | 13,9 ms       | 0              |
| serpentina neón     | 0,29 ms  | 7,32 ms         | 13,8 ms       | 0              |
| serpentina retro    | 0,25 ms  | 7,01 ms         | 7,1 ms        | 0              |

Ningún motor supera el presupuesto; no hay specs candidatas. Serpentina muestra algún frame de ≈14 ms en el p95 (sin frames > 25 ms), probablemente por el reinicio tras game over durante la prueba automática; conviene repetir con una partida larga si se percibe lentitud en ese juego. Limitación: pruebas con partidas cortas y headless, sin jugar a fondo (asteroids/arkanoid con muchas entidades podrían costar más).

**Paso 6 — verificación.** `tsc`, `eslint` y `npm run build` sin errores; sin coincidencias de `submerged|TURTLE_|turtleSunk|phase` en `lib/`; `git diff main..HEAD` solo toca `lib/engines/frogger.ts`, esta spec y la nota en el core de Frogger. Velocidad: la fila 12 pasa de 4 a 2 px/frame (120 px/s), es decir ≈ 5,3 s para cruzar 640 px. Pendiente de validar a mano por el usuario: la sensación de velocidad al 50 %.

---

## Criterios de aceptación

- [x] `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores.
- [x] Todas las velocidades base de `ROAD` y `RIVER` se multiplican por `SPEED_SCALE = 0.5`; el escalado de +15 % por nivel sigue intacto.
- [x] En el nivel 1, una entidad de la fila 12 tarda ≥ 5 s en cruzar los 640 px del canvas.
- [x] Las tortugas no se sumergen nunca: en una partida de 2 minutos siguen visibles y la rana nunca cae por una tortuga «hundida».
- [x] `grep` de `submerged`, `TURTLE_CYCLE_MS`, `TURTLE_VISIBLE_MS`, `TURTLE_SUBMERGED_MS`, `turtleSunk` y `phase` en `lib/` no devuelve resultados.
- [x] La rana sigue siendo arrastrada por troncos y tortugas a su velocidad y puede ocupar una boca, perder vidas y terminar la partida igual que antes.
- [x] La spec contiene la tabla de ms/frame de Frogger antes y después en clásico, neón y retro.
- [x] La media de ms/frame de Frogger en escritorio es ≤ 8 ms en las tres skins (o la línea base ya lo cumplía y está documentado).
- [x] La spec contiene la tabla de ms/frame de `asteroids`, `tetris`, `arkanoid` y `serpentina`.
- [x] `git diff` solo toca `lib/engines/frogger.ts`, esta spec y, si procede, una nota en `specs/game-jam/frogger/01-frogger-core.md`.
- [x] Pausa, reanudar, FIN, cambio de skin en caliente y guardar puntuación siguen funcionando; el contrato `GameEngine` y `ENGINES` no cambian.

---

## Decisiones tomadas y descartadas

- **Sí:** interpretar «cocodrilos» como las tortugas que se sumergen, confirmado con el usuario; **No:** añadir cocodrilos (entidad nueva, otra spec).
- **Sí:** `SPEED_SCALE = 0.5` único en `buildLanes` (decisión del usuario: −50 %); **No:** editar las 11 velocidades de `ROAD`/`RIVER` una por una ni tocar el +15 % por nivel: un solo punto de ajuste, fácil de afinar luego.
- **Sí:** quitar el código de inmersión por completo; **No:** dejar un flag desactivado (código muerto sin uso previsto).
- **Sí:** medir antes de optimizar y optimizar solo lo que los datos justifiquen; **No:** reescribir el renderizado a ciegas (las sospechas del código no están verificadas).
- **Sí:** medir los otros cuatro motores sin tocarlos; **No:** optimizarlos aquí (cinco motores × tres skins no cabe en una spec revisable); cada uno, si falla, tendrá la suya.
- **Sí:** presupuesto de 8 ms/frame en escritorio; **No:** objetivos de móvil (el usuario reportó el problema solo en escritorio).

---

## Riesgos identificados

| Riesgo                                                                                      | Mitigación                                                                                                 |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| La velocidad al 50 % deja el juego demasiado fácil                                          | `SPEED_SCALE` es una sola constante; se afina sin tocar nada más. El +15 % por nivel compensa al avanzar.  |
| Sin tortugas sumergidas, los carriles de tortugas (filas 2 y 5) pasan a ser seguros siempre | Aceptado por decisión del usuario; el riesgo del río queda en troncos, huecos y el límite de tiempo.       |
| El tirón no viene del dibujado (p. ej. GC, React o el monitor a 144 Hz con otro `dt`)       | El paso 1 mide antes de actuar; si el canvas no es el cuello de botella, se documenta y se abre otra spec. |
| Caché del fondo desincronizada con la skin o con las bocas ocupadas (`goals`)               | Regenerar al llamar `setSkin`; las bocas ocupadas y la rana se dibujan fuera de la caché, cada frame.      |
| La medición varía según el equipo y el navegador                                            | Anotar equipo, navegador y refresco del monitor en la tabla; comparar antes/después en la misma máquina.   |

---

## Qué **no** está en esta spec

- Cambios en los motores `asteroids`, `tetris`, `arkanoid` y `serpentina`.
- Cocodrilos u otras entidades nuevas.
- Optimización específica para móvil, cambios de resolución interna o de `game-player.tsx`.
- Rebalanceo de dificultad más allá de `SPEED_SCALE`.
- Telemetría o benchmark permanente dentro de la app.

Cada uno, si se aborda, va en su propia spec.
