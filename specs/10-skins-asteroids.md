# SPEC 10 — Skins de ASTEROIDS (clasico, neon, retro)

> **Estado:** Implementado
> **Depende de:** SPEC 05 (motor Asteroids)
> **Fecha:** 2026-10-10
> **Objetivo:** Añadir tres skins al motor `asteroids` (`clasico` por defecto, `neon` y `retro`), legibles en modo oscuro con contraste WCAG verificado, y un selector de skin en el reproductor persistido en `localStorage`.

---

## Auditoría del estado actual

Colores hardcodeados en `lib/engines/asteroids.ts` (9 sitios, 5 valores distintos):

| Elemento                | Valor actual              | Ratio contra `#000`                      |
| ----------------------- | ------------------------- | ---------------------------------------- |
| Fondo canvas            | `#000`                    | —                                        |
| Nave / asteroide / bala | `#fff` (3 sitios)         | 21.0:1                                   |
| Power-up y HUD `3x`     | `#0ff` (3 sitios)         | 16.7:1                                   |
| Llama del propulsor     | `rgba(255,130,0,0.85)`    | ~6.2:1                                   |
| Partículas              | `rgba(255,255,255,alpha)` | 21:1 al inicio, se desvanece a propósito |

| skin    | ¿existe?                     | colores hardcodeados | problemas de contraste                                                                                                                |
| ------- | ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| clasico | Sí (implícito, sin selector) | 5 valores / 9 sitios | Ninguno de contraste. Nave, asteroides y balas son todos `#fff`: se distinguen solo por forma/tamaño. Se acepta: es el look original. |
| neon    | No                           | 0                    | —                                                                                                                                     |
| retro   | No                           | 0                    | —                                                                                                                                     |

No hay `SkinId` en `lib/engines/types.ts`. Sin spritesheet (todo vectorial), así que no hay recoloreo de sprites. No hay `shadowBlur` en el motor hoy.

---

## Alcance

**Dentro:**

- `SkinId = "clasico" | "neon" | "retro"` en `lib/engines/types.ts`.
- `GameEngine` recibe un tercer parámetro opcional `skin?: SkinId` (default `clasico`); `EngineHandle` gana `setSkin?: (skin: SkinId) => void` opcional. Los motores existentes (caida, arkanoid, serpentina) no cambian: ignoran el parámetro.
- En `lib/engines/asteroids.ts`: `PALETTES: Record<SkinId, Palette>` y variable `pal` en el closure; todo `fillStyle`/`strokeStyle`/`shadowColor` sale de `pal`. `clasico` reproduce exactamente los valores actuales.
- `neon`: glow con `shadowBlur` moderado solo en nave, balas, power-up y asteroides (no en partículas); se restablece `shadowBlur = 0` tras cada dibujo.
- `retro`: sin glow, `lineWidth` 2, `lineJoin = "miter"`, balas cuadradas con `fillRect` 3×3, posiciones de dibujo redondeadas a 2 px y vértices de asteroides cuantizados a 2 px para aspecto pixelado.
- Selector de skin (3 botones, textos en español: `CLÁSICO`, `NEÓN`, `RETRO`) en `components/game-player.tsx`, visible solo si el juego está en un conjunto `SKINNED = ["asteroids"]`. Persistencia en `localStorage` clave `av_skin_asteroids` con try/catch; se lee en `useEffect` (evita desajuste de hidratación). Al cambiar se llama `handle.setSkin(skin)` sin reiniciar la partida.
- Actualizar `references/game-with-themes.md` al implementar.

**Fuera de alcance:**

- Otros juegos (caida, arkanoid, serpentina y los simulados).
- Skins de la UI del sitio (`app/globals.css`, HUD de la plataforma, modales).
- Controles táctiles.
- Supabase Auth/RLS y cualquier cambio de esquema; el skin no se guarda en `scores`.
- Sonido, skins extra, tests automatizados (no hay framework).
- Redibujar el frame congelado cuando el skin cambia en pausa (se ve al reanudar).

---

## Modelo de datos

Sin tablas nuevas. Tipos:

```ts
// lib/engines/types.ts
export type SkinId = "clasico" | "neon" | "retro";
export type GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
  skin?: SkinId,
) => EngineHandle;
// EngineHandle: + setSkin?: (skin: SkinId) => void

// lib/engines/asteroids.ts
type Palette = {
  bg: string;
  ship: string;
  asteroid: string;
  bullet: string;
  powerUp: string;
  flame: string;
  particle: string; // rgb "r,g,b" para alpha
  glow: number; // shadowBlur en px, 0 = sin glow
  lineWidth: number; // trazo de nave y asteroides
  pixel: boolean; // redondeo a 2 px, miter, balas cuadradas
};
const PALETTES: Record<SkinId, Palette>;
```

`localStorage`: `av_skin_asteroids` = `SkinId`; valor inválido o error → `clasico`.

### Paletas y contraste

Ratio = (L1+0.05)/(L2+0.05) con luminancia relativa WCAG. Umbrales: HUD/texto ≥ 4.5, entidades ≥ 3.

**clasico** (fondo `#000`, L=0; sin cambios visuales)

| Elemento                | Hex                   | Ratio       |
| ----------------------- | --------------------- | ----------- |
| Nave, asteroides, balas | `#ffffff`             | 21.0        |
| Power-up y texto `3x`   | `#00ffff`             | 16.7        |
| Llama                   | `rgba(255,130,0,.85)` | 6.2         |
| Partículas              | `255,255,255`         | 21.0 (fade) |

glow 0, lineWidth 1.5.

**neon** (fondo `#05050a`, L=0.0016; armoniza con `.crt` `#050507`)

| Elemento              | Hex                     | Ratio                 | Glow               |
| --------------------- | ----------------------- | --------------------- | ------------------ |
| Nave                  | `#00f5ff`               | 15.0                  | 10                 |
| Asteroides            | `#ff006e`               | 5.3                   | 6                  |
| Balas                 | `#f5ff00`               | 18.6                  | 8                  |
| Power-up y texto `3x` | `#00ff88`               | 15.2 (texto ≥ 4.5 OK) | 8 (texto sin glow) |
| Llama                 | `#ff8a00`               | 8.6                   | 0                  |
| Partículas            | `230,233,255` (`--ink`) | 16.9 (fade)           | 0                  |

Nave y asteroides difieren en luminancia (L 0.725 vs 0.224, ratio mutuo 2.8) además de tono; glow ≤ 10 px no tapa los trazos de 1.5 px (el texto `3x` se dibuja sin glow).

**retro** (fósforo verde + ámbar, fondo `#061406`, L=0.0055; oscuro, no claro)

| Elemento              | Hex         | Ratio      |
| --------------------- | ----------- | ---------- |
| Nave                  | `#33ff66`   | 14.1       |
| Asteroides            | `#2ea84f`   | 6.2        |
| Balas                 | `#d8ffd8`   | 17.3       |
| Power-up y texto `3x` | `#ffb000`   | 10.3       |
| Llama                 | `#ffb000`   | 10.3       |
| Partículas            | `46,168,79` | 6.2 (fade) |

glow 0, lineWidth 2, `pixel: true`. Nave (L 0.73) y asteroides (L 0.29) se separan por luminancia (ratio mutuo 2.3) y por grosor/forma, no solo por tono. Las ratios deben recalcularse con una herramienta al implementar (paso 6).

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (`AGENTS.md`). No usar `/frontend-design` salvo para el estilo del selector.

1. **Tipos.** Añadir `SkinId`, parámetro `skin?` en `GameEngine` y `setSkin?` en `EngineHandle`. Verificación: `npx tsc --noEmit` sin errores (los motores existentes compilan sin cambios).
2. **Paletas en el motor.** Definir `PALETTES`, `let pal = PALETTES[skin ?? "clasico"]`, sustituir los 9 sitios hardcodeados y exponer `setSkin`. Verificación: con `clasico` el juego se ve idéntico al actual; `npm run lint`.
3. **Neon.** Aplicar `shadowColor`/`shadowBlur` con `ctx.save()/restore()` (o reset a 0) en nave, asteroides, balas y power-up; el texto sin glow. Verificación: partida con `neon`, sin caída perceptible de FPS con ~15 asteroides.
4. **Retro.** Redondeo a 2 px, vértices cuantizados al crear el asteroide según `pal.pixel`, `miter`, balas con `fillRect`. Verificación: partida con `retro`, trazos sin glow y bordes angulosos.
5. **Selector en `GamePlayer`.** Conjunto `SKINNED`, estado `skin`, lectura/escritura de `av_skin_asteroids` con try/catch, paso del skin a `startEngine` y llamada a `setSkin` al cambiar. Verificación: el selector aparece en `/jugar/asteroids` y no en `/jugar/caida`, `/jugar/arkanoid`, `/jugar/serpentina` ni `/jugar/invasores`; el skin persiste tras recargar.
6. **Verificación de contraste y marco.** Recalcular las ratios de las tablas y comprobar visualmente cada skin dentro del marco `.crt` (`#050507`). Verificación: todas las ratios cumplen los umbrales.
7. **Verificación final.** `npm run lint`, `npm run build`, partida completa en cada skin (power-up, game over, guardar puntuación, jugar de nuevo) y cambio de skin en medio de la partida.
8. **Registro.** Marcar `✔` en `clasico`, `neon` y `retro` de `asteroids` en `references/game-with-themes.md` (la spec ya figura en su columna Spec).

---

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] `clasico` es el skin por defecto (sin valor en `localStorage`) y se ve igual que antes de la spec.
- [ ] Los tres skins tienen fondo oscuro (≤ `#1a1a1a`) y cada par de la tabla cumple ≥ 4.5:1 (texto/HUD) y ≥ 3:1 (entidades).
- [ ] En `neon` el glow no oculta los trazos ni el texto `3x`; no hay `shadowBlur` activo sobre el fondo ni las partículas.
- [ ] En `retro` no hay glow, los trazos son angulosos y las balas cuadradas.
- [ ] Nave, asteroides, balas y power-up son distinguibles en cada skin sin depender solo del tono.
- [ ] El selector muestra `CLÁSICO`, `NEÓN`, `RETRO` y solo aparece en `/jugar/asteroids`.
- [ ] Cambiar de skin durante la partida no la reinicia ni altera puntaje, vidas o nivel.
- [ ] El skin elegido persiste en `av_skin_asteroids`; si `localStorage` falla o el valor es inválido, se usa `clasico` sin error.
- [ ] Sin desajuste de hidratación en consola.
- [ ] CARGA, pausa, FIN, "JUGAR DE NUEVO" y `destroy()` siguen cumpliendo el contrato; sin estado de módulo nuevo.
- [ ] THETRIS, ARKANOID, SERPENTINA y los juegos simulados no cambian.
- [ ] `references/game-with-themes.md` marca `asteroids` con `✔` en los tres skins.

---

## Decisiones tomadas y descartadas

- **Sí:** paleta como `Record<SkinId, Palette>` dentro del motor; **No:** archivo compartido de temas ni CSS variables (el canvas no las lee).
- **Sí:** `skin?` opcional y `setSkin?` opcional en el contrato; **No:** reiniciar el motor al cambiar de skin (perdería la partida).
- **Sí:** `clasico` conserva los colores actuales aunque nave/asteroides/balas compartan blanco; **No:** retocar el look original.
- **Sí:** `retro` verde fósforo con ámbar de acento; **No:** paleta Game Boy de 4 tonos (el verde claro típico `#9bbc0f` cae en tonos demasiado claros como fondo y exigiría invertir el esquema).
- **Sí:** pixelado por redondeo a 2 px y `miter`; **No:** renderizar a baja resolución con escalado (cambiaría la resolución interna 800×600 del contrato).
- **Sí:** selector solo en juegos de `SKINNED`; **No:** mostrarlo en juegos sin skins.

---

## Riesgos identificados

| Riesgo                                            | Mitigación                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `shadowBlur` costoso con muchos objetos           | Glow solo en 4 tipos de entidad, ≤ 10 px, nada en partículas; medir en el paso 3.           |
| Glow que persiste y mancha el texto o el fondo    | Resetear `shadowBlur = 0` tras cada dibujo.                                                 |
| Vértices cuantizados cambian el radio de colisión | La colisión usa `radius`, no `verts`; cuantizar solo en dibujo/forma con tolerancia ≤ 2 px. |
| Desajuste de hidratación por leer `localStorage`  | Leer en `useEffect` tras montar.                                                            |
| Cambio de skin en pausa no se ve hasta reanudar   | Aceptado (fuera de alcance).                                                                |

---

## Qué **no** está en esta spec

- Skins para otros juegos.
- Skins de la UI del sitio.
- Controles táctiles.
- Supabase Auth/RLS.
- Skins extra o sonido.

Cada uno, si se aborda, va en su propia spec.
