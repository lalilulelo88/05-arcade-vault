# SPEC 12 — Skins de SERPENTINA (clasico, neon, retro)

> **Estado:** Aprobado
> **Depende de:** SPEC 09 (motor Serpentina) y SPEC 10 (patrón de skins: `SkinId`, `skin?`/`setSkin?` en el contrato y selector en `GamePlayer`)
> **Fecha:** 2026-10-10
> **Objetivo:** Añadir tres skins al motor `serpentina` (`clasico` por defecto, `neon` y `retro`), legibles en modo oscuro con contraste WCAG verificado, reutilizando el selector de skin del reproductor (persistido en `localStorage`).

---

## Auditoría del estado actual

Colores hardcodeados en `lib/engines/serpentina.ts` (7 valores distintos, 9 sitios):

| Elemento                  | Valor actual                                          | Ratio contra `#07070f` |
| ------------------------- | ----------------------------------------------------- | ---------------------- |
| Fondo canvas              | `#07070f`                                             | —                      |
| Puntos de rejilla         | `rgba(255,255,255,0.08)`                              | decorativo (~1.3:1)    |
| Serpiente (gradiente)     | `hsl(135 100% 60%)` cabeza → `hsl(110 100% 32%)` cola | 14.9 cabeza / 6.0 cola |
| Glow de la serpiente      | `#39ff14`, `shadowBlur` 14                            | —                      |
| Ojos: esclera / pupila    | `#fff` / `#07070f`                                    | 20.1 / —               |
| Texto "PULSA UNA FLECHA…" | `#fff`                                                | 20.1                   |
| Fruta                     | spritesheet `fruits.png` (22 frutas a color)          | variable (ver riesgos) |

| skin    | ¿existe?                     | colores hardcodeados | problemas de contraste                                                                                                                                                 |
| ------- | ---------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| clasico | Sí (implícito, sin selector) | 7 valores / 9 sitios | Ninguno en serpiente y texto. Fruta de spritesheet sin garantía: frutas oscuras (berenjena, uva) pueden caer bajo 3:1 contra el fondo. Se acepta: es el look original. |
| neon    | No                           | 0                    | —                                                                                                                                                                      |
| retro   | No                           | 0                    | —                                                                                                                                                                      |

Particularidad: la fruta es un **spritesheet** (`public/games/serpentina/fruits.png`). Los skins no cambian el PNG ni añaden sprites: `neon` la rodea de glow y `retro` la dibuja como silueta monocroma ámbar (recoloreo en un canvas fuera de pantalla creado en el closure al cargar la imagen). `clasico` la dibuja como hoy.

---

## Alcance

**Dentro:**

- Reutilizar `SkinId`, el parámetro `skin?` de `GameEngine` y `setSkin?` de `EngineHandle` (SPEC 10). Si al implementar no existen en `lib/engines/types.ts`, añadirlos con la misma forma que en la SPEC 10.
- En `lib/engines/serpentina.ts`: `PALETTES: Record<SkinId, Palette>` y variable `pal` en el closure; todo `fillStyle`/`shadowColor`/`shadowBlur` sale de `pal`. `clasico` reproduce exactamente los valores actuales (incluido el gradiente `hsl` y glow `#39ff14`/14).
- `neon`: serpiente con glow moderado (≤ 12 px), fruta con halo magenta (`shadowBlur` 10); texto y puntos de rejilla sin glow; `shadowBlur = 0` tras cada dibujo.
- `retro`: sin glow; segmentos **cuadrados** (`fillRect` redondeado a 2 px, 34×34 y cabeza 40×40) en lugar de círculos, conectores cuadrados, ojos de 4×4 cuadrados, fruta como silueta ámbar con `imageSmoothingEnabled = false`, rejilla de puntos 2×2.
- Selector en `components/game-player.tsx`: añadir `"serpentina"` al conjunto `SKINNED` (que ya contiene `asteroids` tras la SPEC 10). Clave `av_skin_serpentina`.
- Actualizar `references/game-with-themes.md` (fila `serpentina`).

**Fuera de alcance:**

- Otros juegos (asteroids, caida, arkanoid y los simulados).
- Skins de la UI del sitio (`app/globals.css`, HUD de la plataforma, modales).
- Controles táctiles.
- Supabase Auth/RLS y cualquier cambio de esquema; el skin no se guarda en `scores`.
- Sprites alternativos de fruta, sonido, skins extra, tests automatizados (no hay framework).
- Redibujar el frame congelado si el skin cambia en pausa (se ve al reanudar).
- Cambiar reglas, velocidad o rejilla del juego.

---

## Modelo de datos

Sin tablas nuevas. Tipos:

```ts
// lib/engines/types.ts (de la SPEC 10; reutilizar si ya existe)
export type SkinId = "clasico" | "neon" | "retro";

// lib/engines/serpentina.ts
type Palette = {
  bg: string;
  grid: string; // puntos de rejilla
  head: string; // color en i = 0 (gradiente)
  tail: string; // color en i = último (clasico lo calcula en hsl)
  glow: number; // shadowBlur de la serpiente, 0 = sin glow
  glowColor: string;
  fruitGlow: number; // shadowBlur de la fruta (neon)
  fruitGlowColor: string;
  fruitTint: string | null; // retro: color de la silueta; null = sprite original
  eyeWhite: string;
  eyePupil: string;
  text: string;
  square: boolean; // retro: segmentos cuadrados a 2 px, ojos cuadrados
};
const PALETTES: Record<SkinId, Palette>;
```

`localStorage`: `av_skin_serpentina` = `SkinId`; valor inválido o error → `clasico`.

### Paletas y contraste

Ratio = (L1+0.05)/(L2+0.05) con luminancia relativa WCAG. Umbrales: texto/HUD ≥ 4.5, entidades ≥ 3. Valores calculados con script; se recalculan en el paso 6.

**clasico** (fondo `#07070f`; sin cambios visuales)

| Elemento        | Valor                           | Ratio      |
| --------------- | ------------------------------- | ---------- |
| Cabeza          | `hsl(135 100% 60%)` = `#33ff66` | 14.9       |
| Cola            | `hsl(110 100% 32%)` = `#1ba300` | 6.0        |
| Texto de inicio | `#ffffff`                       | 20.1       |
| Fruta           | sprite original                 | n/a        |
| Rejilla         | `rgba(255,255,255,.08)`         | decorativa |

glow `#39ff14` / 14.

**neon** (fondo `#05050a`; armoniza con `.crt` `#050507`)

| Elemento                       | Hex                   | Ratio            | Glow           |
| ------------------------------ | --------------------- | ---------------- | -------------- |
| Cabeza (`--cyan`)              | `#00f5ff`             | 15.0             | 12 (`#00f5ff`) |
| Cola                           | `#0a8f9c`             | 5.3              | 12             |
| Halo de la fruta (`--magenta`) | `#ff006e`             | 5.3              | 10             |
| Texto de inicio                | `#e6e9ff`             | 16.9             | 0              |
| Ojos: esclera / pupila         | `#ffffff` / `#05050a` | 20.3 (entre sí)  | 0              |
| Rejilla                        | `#1a1a2e`             | 1.2 (decorativa) | 0              |

Cabeza vs cola: ratio mutuo 2.9 (diferencia de luminancia) y la cabeza es más grande y lleva ojos. Serpiente (cian) y fruta (sprite multicolor con halo magenta) se separan por halo, tamaño y forma, no solo tono. Glow ≤ 12 px sobre trazos de 34 px no tapa nada; el texto y los ojos se dibujan sin glow.

**retro** (fósforo verde + ámbar, fondo `#061406`, oscuro)

| Elemento               | Hex                   | Ratio                                  |
| ---------------------- | --------------------- | -------------------------------------- |
| Cabeza                 | `#33ff66`             | 14.1                                   |
| Cola                   | `#1f9a40`             | 5.2                                    |
| Fruta (silueta)        | `#d98a00`             | 6.8  |
| Texto de inicio        | `#33ff66`             | 14.1                                   |
| Ojos: esclera / pupila | `#d8ffd8` / `#061406` | 17.3 (entre sí), esclera vs cabeza 1.2 |
| Rejilla                | `#14381c`             | 1.5 (decorativa)                       |

glow 0, `square: true`. Cabeza vs cola: 2.7 (luminancia). Fruta vs cabeza: 2.1 en luminancia (fruta vs cola 1.3), por eso en `retro` la fruta se distingue por **forma** (silueta de fruta vs bloques cuadrados) y matiz, y por el ojo de la cabeza oscuro (`#061406`, 14.1 contra la cabeza) que la marca como cabeza; la fruta ya está oscurecida respecto al borrador y se aprueba así.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (`AGENTS.md`). No usar `/frontend-design` salvo para el estilo del selector.

1. **Tipos.** Verificar que `SkinId`, `skin?` y `setSkin?` existen en `lib/engines/types.ts` (SPEC 10). Si no, añadirlos tal como en la SPEC 10. Verificación: `npx tsc --noEmit` sin errores.
2. **Paletas en el motor.** Definir `Palette`/`PALETTES`, `let pal = PALETTES[skin ?? "clasico"]`, sustituir los 9 sitios hardcodeados, leer `skin` del tercer parámetro y exponer `setSkin`. Verificación: con `clasico` el juego es idéntico al actual (gradiente, glow, ojos); `npm run lint`.
3. **Neon.** Serpiente con `shadowColor`/`shadowBlur` de `pal`, fruta con halo (`ctx.save()/restore()`), resto sin glow. Verificación: partida en `neon`, sin caída perceptible de FPS con la serpiente larga (> 40 segmentos).
4. **Retro.** Segmentos cuadrados redondeados a 2 px, conectores cuadrados, ojos cuadrados, silueta ámbar de la fruta con canvas fuera de pantalla creado en `img.onload` (variable del closure, no de módulo; si `fruitTint` es null no se crea) y `imageSmoothingEnabled = false` en `retro`. Verificación: partida en `retro`, bordes angulosos, fruta ámbar reconocible, sin glow.
5. **Selector.** Añadir `"serpentina"` a `SKINNED` en `components/game-player.tsx`. Verificación: el selector aparece en `/jugar/serpentina` (y sigue en `/jugar/asteroids`), no en `/jugar/caida`, `/jugar/arkanoid` ni `/jugar/invasores`; el skin persiste tras recargar con `av_skin_serpentina`.
6. **Verificación de contraste y marco.** Recalcular las ratios de las tablas y comprobar visualmente cada skin dentro del marco `.crt` (`#050507`), incluidas varias frutas oscuras (berenjena, uva) en `clasico` y `neon`. Verificación: todas las ratios cumplen los umbrales.
7. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`, partida completa en cada skin (comer, cruzar borde, game over, guardar puntuación, jugar de nuevo) y cambio de skin en medio de la partida.
8. **Registro.** Marcar `✔` en `clasico`, `neon` y `retro` de `serpentina` en `references/game-with-themes.md`.

---

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] `clasico` es el skin por defecto (sin valor en `localStorage`) y se ve igual que antes de la spec.
- [ ] Los tres skins tienen fondo oscuro (≤ `#1a1a1a`) y cada par de las tablas cumple ≥ 4.5:1 (texto) y ≥ 3:1 (serpiente contra fondo).
- [ ] En `neon` el glow no oculta ojos ni texto; no hay `shadowBlur` activo sobre el fondo o la rejilla.
- [ ] En `retro` no hay glow, los segmentos son cuadrados y la fruta es silueta ámbar.
- [ ] Cabeza, cuerpo y fruta son distinguibles en cada skin sin depender solo del tono.
- [ ] El selector (`CLÁSICO`, `NEÓN`, `RETRO`) aparece en `/jugar/serpentina`.
- [ ] Cambiar de skin durante la partida no la reinicia ni altera puntaje, posición, dirección o fruta.
- [ ] El skin persiste en `av_skin_serpentina`; si `localStorage` falla o el valor es inválido, se usa `clasico` sin error.
- [ ] Sin desajuste de hidratación en consola.
- [ ] Carga del spritesheet, pausa, FIN, "JUGAR DE NUEVO" y `destroy()` cumplen el contrato; sin estado de módulo nuevo.
- [ ] ASTEROIDS, THETRIS, ARKANOID y los juegos simulados no cambian.
- [ ] `references/game-with-themes.md` marca `serpentina` con `✔` en los tres skins.

---

## Decisiones tomadas y descartadas

- **Sí:** paleta como `Record<SkinId, Palette>` dentro del motor; **No:** archivo compartido de temas.
- **Sí:** reutilizar el patrón de la SPEC 10 (`skin?`, `setSkin?`, `SKINNED`); **No:** reiniciar el motor al cambiar de skin.
- **Sí:** `clasico` conserva gradiente `hsl`, glow `#39ff14` y sprite de frutas; **No:** retocar el look original.
- **Sí:** `retro` con silueta ámbar generada en un canvas fuera de pantalla; **No:** `ctx.filter` (soporte irregular en Safari) ni PNG nuevos.
- **Sí:** `retro` verde fósforo + ámbar; **No:** paleta Game Boy de 4 tonos (tonos claros como fondo romperían el modo oscuro).
- **Sí:** pixelado por segmentos cuadrados a 2 px; **No:** renderizar a baja resolución con escalado (cambiaría los 800×800 del contrato).

---

## Riesgos identificados

| Riesgo                                                          | Mitigación                                                                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Frutas oscuras del sprite con < 3:1 contra el fondo (`clasico`) | Preexistente, aceptado. En `neon` el halo magenta la delimita; en `retro` es silueta ámbar.                                        |
| `retro`: fruta vs cabeza 2.1:1 y vs cola 1.3:1 en luminancia   | Aprobado `#d98a00`; distinguida por forma (silueta vs bloques) y matiz. Revisar en el paso 6. |
| `shadowBlur` costoso con serpiente larga                        | Glow ≤ 12 px; medir en el paso 3 (hasta 400 segmentos máx.).                                                                       |
| Glow que persiste y mancha texto u ojos                         | `ctx.save()/restore()` y `shadowBlur = 0` tras cada dibujo.                                                                        |
| Silueta tintada sin imagen cargada                              | Crearla en `img.onload`; si no está lista no se dibuja la fruta (igual que hoy).                                                   |
| Desajuste de hidratación por leer `localStorage`                | Leer en `useEffect` tras montar (ya resuelto en `GamePlayer`, SPEC 10).                                                            |

---

## Qué **no** está en esta spec

- Skins para otros juegos.
- Skins de la UI del sitio.
- Controles táctiles.
- Supabase Auth/RLS.
- Sprites nuevos, skins extra o sonido.

Cada uno, si se aborda, va en su propia spec.
