# SPEC 11 — Skins de ARKANOID (clasico, neon, retro)

> **Estado:** Implementado
> **Depende de:** SPEC 08 (motor Arkanoid), SPEC 10 (contrato de skins: `SkinId`, `skin?`, `setSkin?`, `SKINNED`, selector en `GamePlayer`)
> **Fecha:** 2026-10-10
> **Objetivo:** Añadir tres skins al motor `arkanoid` (`clasico` por defecto, `neon` y `retro`), legibles en modo oscuro con contraste WCAG verificado, reutilizando el patrón de Asteroids (spec 10).

---

## Auditoría del estado actual

`lib/engines/arkanoid.ts` usa spritesheet (`public/games/arkanoid/spritesheet-breakout.png`) para paleta, bola, 7 colores de bloque (+ gris de 2 golpes) y 4 frames de explosión por color. Colores hardcodeados fuera del sprite: 16 sitios, 14 valores distintos.

| Elemento                    | Valor actual                                   | Ratio vs `#2b2b2b`     |
| --------------------------- | ---------------------------------------------- | ---------------------- |
| Fondo canvas                | `#2b2b2b` (L=0.024)                            | —                      |
| Cápsulas XL / X3 / L / SB   | `#e53935` / `#1e88e5` / `#fdd835` / `#43a047`  | 3.3 / 3.8 / 10.1 / 4.3 |
| Texto de cápsula            | `#000` sobre la cápsula                        | 5.0 / 5.7 / 15.1 / 6.4 |
| HUD de efectos (`XL 12s`)   | color de la cápsula sobre el fondo             | 3.3 / — / 10.1 / 4.3   |
| Láser                       | `#ff3b30`                                      | 4.0                    |
| Banner                      | `#ffd60a`                                      | 10.0                   |
| Texto "ESPACIO PARA LANZAR" | `#fff`                                         | 14.2                   |
| Partículas                  | `#fff #ffd60a #ff9f0a #ff453a` (se desvanecen) | ≥ 4.0 al inicio        |
| Bola SB (atraviesa)         | `hsl(h,100%,60%)` cambiante                    | ~8–10                  |

| skin    | ¿existe?                     | colores hardcodeados            | problemas de contraste                                                                                                                                                                  |
| ------- | ---------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| clasico | Sí (implícito, sin selector) | 14 valores / 16 sitios + sprite | Fondo `#2b2b2b` algo más claro que el umbral `#1a1a1a` (sigue siendo oscuro). HUD de `XL` (3.3) y `SB` (4.3) bajo 4.5 sobre ese fondo. Se acepta: es el look original (ver Decisiones). |
| neon    | No                           | 0                               | —                                                                                                                                                                                       |
| retro   | No                           | 0                               | —                                                                                                                                                                                       |

**Spritesheet:** recolorear el PNG o crear sprites alternativos queda descartado (assets nuevos, dependencia de edición binaria). `neon` y `retro` **no usan el sprite**: dibujan paleta, bola, bloques, explosión y cápsulas de forma vectorial con la paleta del skin. Solo `clasico` sigue usando el spritesheet, sin cambios.

No existe `SkinId` en esta rama: la spec 10 lo introduce (`lib/engines/types.ts`). Esta spec lo reutiliza; si SPEC 10 aún no está integrada, su paso 1 es prerrequisito.

---

## Alcance

**Dentro:**

- Reutilizar `SkinId`, el parámetro `skin?` de `GameEngine` y `setSkin?` de `EngineHandle` (spec 10). Sin cambios en el contrato.
- En `lib/engines/arkanoid.ts`: `startArkanoid` acepta `skin`, define `PALETTES: Record<SkinId, Palette>`, `let pal` en el closure y expone `setSkin`. Todo color hardcodeado de `draw()`, `POWERUP_COLORS` y los colores de partícula (`explodeBall`) sale de `pal`. `clasico` reproduce exactamente el aspecto actual.
- `draw()` bifurca por `pal.sprites`: `true` (clasico) = ruta actual; `false` (neon/retro) = dibujo vectorial (`fillRect`/`strokeRect`/`arc`).
- `neon`: glow `shadowBlur` moderado solo en paleta, bola, láser y cápsulas (no en los ~100 bloques ni en partículas); `shadowBlur = 0` tras cada dibujo.
- `retro`: sin glow, coordenadas enteras, bola cuadrada, cápsulas rectangulares (sin `roundRect`), trazos de 2 px, bola SB con parpadeo de dos tonos en vez de arcoíris.
- Se añade `"arkanoid"` al conjunto `SKINNED` de `components/game-player.tsx`. El resto del selector (botones `CLÁSICO`, `NEÓN`, `RETRO`, `av_skin_arkanoid`, lectura en `useEffect`, `setSkin` sin reiniciar) ya existe por spec 10.
- Actualizar `references/game-with-themes.md` al implementar.

**Fuera de alcance:**

- Otros juegos (asteroids, caida, serpentina y los simulados).
- Skins de la UI del sitio (`app/globals.css`, HUD de la plataforma, modales).
- Controles táctiles.
- Supabase Auth/RLS y cualquier cambio de esquema; el skin no se guarda en `scores`.
- Editar o sustituir el spritesheet; sonido; skins extra; tests automatizados.
- Redibujar el frame congelado si el skin cambia en pausa (se ve al reanudar).

---

## Modelo de datos

Sin tablas nuevas. Tipos del motor:

```ts
// lib/engines/arkanoid.ts
type Palette = {
  sprites: boolean; // true = spritesheet (clasico); false = vectorial
  bg: string;
  paddle: string;
  ball: string;
  ballPierce: string[]; // SB: clasico/neon ciclo hsl o lista; retro 2 tonos
  blocks: Record<BlockColor, string>; // solo vectorial
  grayHit1: string; // gris tras 1 golpe (borde sin relleno)
  laser: string;
  powerup: Record<PowerupType, string>;
  powerupText: string; // texto sobre la cápsula
  particles: string[];
  banner: string;
  hint: string; // "ESPACIO PARA LANZAR"
  glow: number; // shadowBlur en px, 0 = sin glow
  pixel: boolean; // enteros, bola cuadrada, cápsulas rectas
};
const PALETTES: Record<SkinId, Palette>;
```

`POWERUP_COLORS` pasa a `pal.powerup`. `localStorage`: `av_skin_arkanoid` = `SkinId`; valor inválido o error → `clasico`.

### Paletas y contraste

Ratio WCAG = (L1+0.05)/(L2+0.05). Umbrales: HUD/texto ≥ 4.5, entidades ≥ 3. Calculadas con script (relative luminance sRGB).

**clasico** (fondo `#2b2b2b`; sprites + colores actuales, sin cambios)

| Elemento              | Hex                               | Ratio vs fondo                             |
| --------------------- | --------------------------------- | ------------------------------------------ |
| Paleta, bola, bloques | sprite original                   | n/a (sprite)                               |
| Cápsulas XL/X3/L/SB   | `#e53935 #1e88e5 #fdd835 #43a047` | 3.3 / 3.8 / 10.1 / 4.3 (≥ 3 OK)            |
| Texto de cápsula      | `#000`                            | 5.0 / 5.7 / 15.1 / 6.4                     |
| HUD de efectos        | color de cápsula                  | 3.3 / 10.1 / 4.3 (XL y SB < 4.5, heredado) |
| Banner / ayuda        | `#ffd60a` / `#fff`                | 10.0 / 14.2                                |
| Láser                 | `#ff3b30`                         | 4.0                                        |

**neon** (fondo `#05050a`, L=0.0016; armoniza con `.crt` `#050507`). Sin sprites.

| Elemento                         | Hex                               | Ratio                        | Glow |
| -------------------------------- | --------------------------------- | ---------------------------- | ---- |
| Paleta                           | `#00f5ff`                         | 15.0                         | 10   |
| Bola                             | `#ffffff`                         | 20.3                         | 8    |
| Bola SB                          | hsl 60% cambiante                 | ≥ 8                          | 8    |
| Láser                            | `#00f5ff`                         | 15.0                         | 6    |
| Bloque red                       | `#ff8a00`                         | 8.6                          | 0    |
| Bloque yellow                    | `#f5ff00`                         | 18.6                         | 0    |
| Bloque cyan                      | `#4d6dff`                         | 4.8                          | 0    |
| Bloque magenta                   | `#b266ff`                         | 6.0                          | 0    |
| Bloque hotpink                   | `#ff006e`                         | 5.3                          | 0    |
| Bloque green                     | `#00ff88`                         | 15.2                         | 0    |
| Bloque gray (2 golpes / 1 golpe) | `#7a7a99` relleno / solo borde    | 4.9                          | 0    |
| Cápsulas XL/X3/L/SB              | `#ff8a00 #00f5ff #ff006e #00ff88` | 8.6 / 15.0 / 5.3 / 15.2      | 8    |
| Texto de cápsula                 | `#05050a`                         | igual que la cápsula (≥ 5.3) | 0    |
| HUD de efectos (sin glow)        | color de cápsula                  | ≥ 5.3 (≥ 4.5 OK)             | 0    |
| Banner / ayuda                   | `#f5ff00` / `#e6e9ff`             | 18.6 / 16.9                  | 0    |
| Partículas                       | `#fff #f5ff00 #ff8a00 #ff006e`    | ≥ 5.3 (fade)                 | 0    |

Los bloques llevan un borde interior 1 px más claro (`globalAlpha` 0.4 blanco) y separación de 1 px entre ellos; el tono de bloque es decorativo, solo el gris (2 golpes) cambia la mecánica y se distingue por forma (relleno vs. solo borde tras el primer golpe), no por tono. Paleta (cyan) se separa de los bloques porque el bloque `cyan` usa `#4d6dff` (azul, L 0.17 vs 0.73) y la paleta tiene glow y está siempre en la fila inferior.

**retro** (fósforo verde + ámbar, fondo `#061406`, L=0.0055). Sin sprites ni glow.

| Elemento                         | Hex                                                 | Ratio        |
| -------------------------------- | --------------------------------------------------- | ------------ |
| Paleta                           | `#33ff66`                                           | 14.1         |
| Bola                             | `#ffb000`                                           | 10.3         |
| Bola SB (parpadeo cada 100 ms)   | `#ffb000` / `#d8ffd8`                               | 10.3 / 17.3  |
| Láser                            | `#ffb000`                                           | 10.3         |
| Bloques (red, yellow, green)     | `#2ea84f`                                           | 6.2          |
| Bloques (cyan, magenta, hotpink) | `#7fbf7f`                                           | 8.7          |
| Bloque gray (2 golpes / 1 golpe) | `#d8ffd8` relleno / solo borde                      | 17.3         |
| Cápsulas (las 4)                 | `#ffb000`, se distinguen por su etiqueta XL/X3/L/SB | 10.3         |
| Texto de cápsula                 | `#061406`                                           | 10.3         |
| HUD de efectos / banner          | `#ffb000`                                           | 10.3         |
| Ayuda                            | `#d8ffd8`                                           | 17.3         |
| Partículas                       | `#d8ffd8 #ffb000 #33ff66 #2ea84f`                   | ≥ 6.2 (fade) |

Retro usa solo dos verdes para bloques + amarillo-ámbar para lo que se mueve o interactúa (bola, cápsulas, láser, banner) + verde brillante para el jugador. Distinción entre bloque y bola/cápsula por luminancia/tono ámbar y forma, no solo por tono.

Las ratios deben recalcularse con herramienta al implementar (paso 6).

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (`AGENTS.md`). Prerrequisito: spec 10 integrada (`SkinId`, `skin?`, `setSkin?`, `SKINNED`, selector).

1. **Paletas y firma.** En `arkanoid.ts`: tipo `Palette`, `PALETTES` (con `clasico` = valores actuales), `let pal = PALETTES[skin ?? "clasico"]`, tercer parámetro `skin?`, `setSkin` en el handle; sustituir `POWERUP_COLORS`, colores de partícula, láser, banner y texto por `pal.*`. Verificación: `npx tsc --noEmit`; con `clasico` el juego es idéntico.
2. **Dibujo vectorial (neon y retro).** Rama `!pal.sprites` en `draw()`: fondo, bloques (`fillRect` con separación 1 px, borde, gris relleno/borde según `hits`), explosión (bloque en `#fff` con alpha decreciente en 4 pasos), paleta, bola (círculo o cuadrado si `pixel`), bola SB. Verificación: partida en `neon` y `retro` sin dependencia visual del sprite.
3. **Neon.** `shadowColor`/`shadowBlur` con `ctx.save()/restore()` solo en paleta, bola, láser y cápsulas; texto y bloques sin glow. Verificación: sin caída perceptible de FPS con rejilla de 100 bloques.
4. **Retro.** Enteros (`Math.round`), sin `roundRect`, bola cuadrada, trazo 2 px, SB parpadeante. Verificación: partida con `retro`, sin glow y bordes angulosos.
5. **Selector.** Añadir `"arkanoid"` a `SKINNED` en `components/game-player.tsx`. Verificación: selector visible en `/jugar/arkanoid` y `/jugar/asteroids`, ausente en `/jugar/caida`, `/jugar/serpentina` e `/jugar/invasores`; persiste tras recargar; al cambiar de skin con partida en curso (incluso con la bola en vuelo) no se reinicia. Atención: el motor carga el sprite al arrancar; `clasico` debe seguir funcionando tras alternar skins.
6. **Verificación de contraste y marco.** Recalcular las ratios de las tablas y comprobar visualmente cada skin dentro del marco `.crt` (`#050507`). Verificación: todas cumplen los umbrales.
7. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; partida completa por skin (cápsulas XL/X3/L/SB, láser, bola caída, cambio de nivel, game over, guardar puntuación, jugar de nuevo) y cambio de skin en medio de la partida.
8. **Registro.** Marcar `✔` en `clasico`, `neon` y `retro` de `arkanoid` en `references/game-with-themes.md`.

---

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] `clasico` es el skin por defecto (sin valor en `localStorage`) y se ve igual que antes (spritesheet incluido).
- [ ] `neon` y `retro` no dependen del spritesheet y tienen fondo ≤ `#1a1a1a`; cada par de las tablas cumple ≥ 4.5:1 (texto/HUD) y ≥ 3:1 (entidades).
- [ ] En `neon` el glow no oculta bordes ni texto de cápsulas/HUD; no hay `shadowBlur` activo sobre bloques, fondo ni partículas.
- [ ] En `retro` no hay glow, la bola es cuadrada y las cápsulas rectangulares.
- [ ] Bloque gris de 2 golpes distinguible del de 1 golpe sin depender del tono (relleno vs. borde) en los tres skins; paleta, bola, láser y cápsulas distinguibles de los bloques.
- [ ] El selector muestra `CLÁSICO`, `NEÓN`, `RETRO` en `/jugar/arkanoid` y sigue sin aparecer en juegos sin skins.
- [ ] Cambiar de skin durante la partida no la reinicia ni altera puntaje, bolas, nivel ni efectos activos.
- [ ] El skin persiste en `av_skin_arkanoid`; si `localStorage` falla o el valor es inválido, se usa `clasico` sin error.
- [ ] Sin desajuste de hidratación en consola.
- [ ] Carga del sprite, pausa, FIN, "JUGAR DE NUEVO" y `destroy()` siguen cumpliendo el contrato; sin estado de módulo nuevo.
- [ ] THETRIS, SERPENTINA, ASTEROIDS (salvo la lista `SKINNED`) y los juegos simulados no cambian.
- [ ] `references/game-with-themes.md` marca `arkanoid` con `✔` en los tres skins.

---

## Decisiones tomadas y descartadas

- **Sí:** `neon`/`retro` dibujan vectorial y no usan el spritesheet; **No:** recolorear el PNG ni añadir sprites alternativos (assets nuevos, sin ganancia visual).
- **Sí:** `clasico` conserva `#2b2b2b` y los colores originales aunque el fondo supere `#1a1a1a` y el HUD `XL`/`SB` quede en 3.3/4.3; **No:** retocar el look original. Alternativa a decidir en la revisión: oscurecer solo el HUD de `clasico` (p. ej. `#ff6b66`, 4.6+) sin tocar sprites.
- **Sí:** glow solo en elementos móviles/jugador; **No:** glow en los bloques (hasta 100 `shadowBlur` por frame).
- **Sí:** en `retro` cápsulas todas ámbar, diferenciadas por su etiqueta; **No:** 4 colores (rompe la paleta limitada).
- **Sí:** el color del bloque es decorativo salvo el gris; **No:** codificar mecánica en el tono.
- **Sí:** selector y persistencia reutilizados de spec 10; **No:** duplicar lógica en el reproductor.

---

## Riesgos identificados

| Riesgo                                                    | Mitigación                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `shadowBlur` costoso                                      | Solo paleta, bolas (≤ 4), láseres y cápsulas; ≤ 10 px; medir en el paso 3.                        |
| Glow que persiste y mancha texto o bloques                | `ctx.save()/restore()` por elemento; `shadowBlur = 0` tras cada dibujo.                           |
| Spec 10 no integrada cuando se implemente                 | Prerrequisito explícito; si falta, aplicar primero su paso 1 (tipos) y selector.                  |
| Divergencia visual de colisión (bola cuadrada en `retro`) | La colisión usa `r`; la bola cuadrada se dibuja inscrita (lado `2r`), diferencia ≤ 3 px aceptada. |
| Desajuste de hidratación por leer `localStorage`          | Ya resuelto en spec 10 (lectura en `useEffect`).                                                  |
| Cambio de skin en pausa no se ve hasta reanudar           | Aceptado (fuera de alcance).                                                                      |

---

## Qué **no** está en esta spec

- Skins para otros juegos.
- Skins de la UI del sitio.
- Controles táctiles.
- Supabase Auth/RLS.
- Edición del spritesheet, sonido o skins extra.

Cada uno, si se aborda, va en su propia spec.
