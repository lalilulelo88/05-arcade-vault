# SPEC 14 — Skins de FROGGER (clasico, neon, retro)

> **Estado:** Implementado
> **Depende de:** `specs/game-jam/frogger/01-frogger-core.md` (motor Frogger) y SPEC 10 (patrón de skins: `SkinId`, `skin?`/`setSkin?` en el contrato y selector en `GamePlayer`)
> **Fecha:** 2026-10-10
> **Objetivo:** Añadir tres skins al motor `frogger` (`clasico` por defecto, `neon` y `retro`), legibles en modo oscuro con contraste WCAG verificado, reutilizando el selector de skin del reproductor (persistido en `localStorage`).

---

## Auditoría del estado actual

`lib/engines/frogger.ts` tiene **una única paleta fija**: 31 valores de color distintos hardcodeados en ~40 sitios (`fillStyle`/`strokeStyle`), sin `shadowBlur`, sin parámetro `skin` ni `setSkin`. No usa spritesheet: todo se dibuja con primitivas de canvas.

| skin    | ¿existe?                     | colores hardcodeados    | problemas de contraste                                                                                                                                                                                                                             |
| ------- | ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| clasico | Sí (implícito, sin selector) | 31 valores / ~40 sitios | Rana vs tortuga 2.0:1 (separadas por el trazo oscuro de la tortuga); tronco vs río 1.9:1 (lo delimita el veteado); zona segura `#14532d` más luminosa que `#1a1a1a`; camión rojo vs carretera 4.5:1. Preexistente, se acepta: es el look original. |
| neon    | No                           | 0                       | —                                                                                                                                                                                                                                                  |
| retro   | No                           | 0                       | —                                                                                                                                                                                                                                                  |

Elementos a parametrizar: zonas (metas, río, zona segura x2, carretera), línea de carril, bocas (relleno y borde), coches (3 colores), camión (remolque y cabina), ruedas, ventanilla, tronco (relleno y veteado), tortuga (relleno, trazo, sumergida), rana (cuerpo, ojos), HUD (texto, vidas), barra de tiempo (3 tramos), texto de inicio.

Particularidad: el motor **no guarda estado en el módulo** salvo constantes; la paleta (`pal`) vive en el closure y `setSkin` solo reasigna `pal`, de modo que el cambio es inmediato en el siguiente frame y sin reinicio. `drawFrog` se reutiliza para las bocas ocupadas.

---

## Alcance

**Dentro:**

- Reutilizar `SkinId`, el parámetro `skin?` de `GameEngine` y `setSkin?` de `EngineHandle` (ya existen en `lib/engines/types.ts`).
- En `lib/engines/frogger.ts`: `PALETTES: Record<SkinId, Palette>`, `let pal = PALETTES[skin ?? "clasico"]`, y todo color sale de `pal`. `clasico` reproduce exactamente los valores actuales. Exportar `setSkin` en el `EngineHandle`.
- `neon`: contornos y relleno oscuro con glow moderado (`shadowBlur` ≤ 10) en rana, vehículos, troncos y tortugas; zonas, líneas, HUD y texto sin glow; `shadowBlur = 0` tras cada dibujo (`ctx.save()/restore()`).
- `retro`: paleta de fósforo verde con ámbar, sin glow, `roundRect` sustituido por `fillRect` (radios 0), ruedas cuadradas, rana con cuerpo rectangular, tortugas cuadradas, veteado del tronco en líneas rectas; sin antialiasing perceptible (coordenadas redondeadas a enteros).
- Contorno oscuro de 2 px alrededor de la rana en `neon` y `retro` para separarla de troncos y tortugas por borde y no solo por tono.
- Selector en `components/game-player.tsx`: añadir `"frogger"` a `SKINNED` (hoy `["asteroids", "arkanoid", "serpentina"]`). Clave `av_skin_frogger`.
- Registro en `references/game-with-themes.md`: añadir fila `frogger` (hoy no existe) con `spec` y la ruta.

**Fuera de alcance:**

- Otros juegos (asteroids, caida, arkanoid, serpentina, ranaria y los simulados).
- Skins de la UI del sitio (`app/globals.css`, HUD de la plataforma, modales).
- Controles táctiles.
- Supabase Auth/RLS y cambios de esquema; el skin no se guarda en `scores`.
- Cambiar reglas, velocidades, rejilla o dimensiones (640×560) del juego.
- Skins extra, sonido, tests automatizados (no hay framework).
- Redibujar el frame congelado si se cambia de skin en pausa (se ve al reanudar).

---

## Modelo de datos

Sin tablas nuevas. Tipos:

```ts
// lib/engines/types.ts: ya existe SkinId, skin?, setSkin?

// lib/engines/frogger.ts
type Palette = {
  goal: string; // fila de bocas
  river: string;
  safe: string; // filas 7 y 13
  road: string;
  laneLine: string;
  mouth: string;
  mouthBorder: string;
  cars: [string, string, string];
  truckTrailer: string;
  truckCab: string;
  wheel: string;
  window: string;
  log: string;
  logGrain: string;
  turtle: string;
  turtleStroke: string;
  turtleSunk: string;
  frog: string;
  frogOutline: string | null; // neon/retro: contorno de 2 px
  eye: string;
  pupil: string;
  text: string;
  timeBar: [string, string, string]; // > 50 %, > 25 %, resto
  glow: number; // shadowBlur de entidades, 0 = sin glow
  square: boolean; // retro: sin esquinas redondeadas
};
const PALETTES: Record<SkinId, Palette>;
```

`localStorage`: `av_skin_frogger` = `SkinId`; valor inválido o error → `clasico`.

### Paletas y contraste

Ratio = (L1+0.05)/(L2+0.05) con luminancia relativa WCAG, calculadas con script. Umbrales: texto/HUD ≥ 4.5, entidades jugables ≥ 3. "Fondo" = la zona sobre la que se dibuja cada elemento.

**clasico** (sin cambios visuales)

| Par                                    | Valores                                     | Ratio                        |
| -------------------------------------- | ------------------------------------------- | ---------------------------- |
| Texto HUD vs metas                     | `#ffffff` / `#0f3d1c`                       | 12.3                         |
| Texto de inicio vs río                 | `#ffffff` / `#0a2a5e`                       | 13.9                         |
| Rana vs zona segura / carretera / río  | `#4ade80` / `#14532d`, `#111118`, `#0a2a5e` | 5.2 / 10.8 / 8.0             |
| Coches vs carretera `#111118`          | `#e63946` / `#f4d35e` / `#3a86ff`           | 4.5 / 12.8 / 5.4             |
| Camión: remolque / cabina vs carretera | `#8d99ae` / `#e07a1f`                       | 6.5 / 6.2                    |
| Tortuga vs río                         | `#2f9e44` / `#0a2a5e`                       | 4.0                          |
| Tronco vs río                          | `#7b4a21` / `#0a2a5e`                       | 1.9 (preexistente, aceptado) |
| Rana vs tortuga                        | `#4ade80` / `#2f9e44`                       | 2.0 (preexistente, aceptado) |
| Barra de tiempo vs metas               | `#4ade80` / `#0f3d1c`                       | 7.1                          |

**neon** (zonas casi negras, armoniza con `.crt` `#050507`)

| Elemento                         | Hex                                           | Ratio contra su fondo                                                                         |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Metas / río / segura / carretera | `#05050a` / `#061a38` / `#06200f` / `#0a0a12` | zonas distinguibles por luminancia ~1.1-1.2 y por borde (línea de 2 px `#1a1a2e` entre zonas) |
| Texto HUD / inicio               | `#e6e9ff`                                     | 16.9 (metas) / 14.4 (río)                                                                     |
| Rana                             | `#00ff88`, contorno `#05050a`                 | 12.8 segura / 14.7 carretera / 12.9 río; vs tronco 3.7                                        |
| Coches                           | `#ff006e` / `#f5ff00` / `#00f5ff`             | 5.1 / 18.0 / 14.6                                                                             |
| Camión                           | remolque `#8a8fb5`, cabina `#ff7a00`          | 6.3 / 7.5                                                                                     |
| Tronco                           | `#9a6420`                                     | 3.5 vs río                                                                                    |
| Tortuga                          | `#087a85`                                     | 3.4 vs río; rana vs tortuga 3.8                                                               |
| Bocas                            | borde `#00ff88` sobre `#0a2a1a`               | 11.5                                                                                          |
| Barra de tiempo                  | `#00ff88` / `#f5ff00` / `#ff006e`             | 15.2 / 18.0 / 5.1 vs metas                                                                    |

Glow 8 (color de la entidad) en rana, vehículos, troncos y tortugas; 0 en HUD, zonas y texto. Tortuga sumergida: trazo `#087a85` al 35 % de opacidad. Entidades separadas del fondo por contorno y glow, y vehículos de río vs carretera por zona, no solo tono.

**retro** (fósforo verde + ámbar, 4 tonos `#061406` / `#14381c` / `#1f9a40` / `#33ff66` + ámbar `#d98a00`; fondo oscuro)

| Elemento           | Hex                                  | Ratio contra su fondo                                                                                                                                                |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metas / carretera  | `#061406`                            | base                                                                                                                                                                 |
| Río / segura       | `#14381c` / `#0b2410`                | río vs carretera 1.5; segura vs carretera 1.1 (separadas por línea `#1f9a40` de 2 px y por patrón de olas en el río)                                                 |
| Texto HUD / inicio | `#33ff66`                            | 14.1 (metas) / 9.7 (río)                                                                                                                                             |
| Rana               | `#33ff66`, contorno `#061406`        | 12.3 segura / 14.1 carretera / 9.7 río; vs tronco 2.1 y vs tortuga 2.7 en luminancia: se separa por el contorno oscuro (6.8 contra el tronco, 5.2 contra la tortuga) |
| Coches             | `#33ff66` / `#d98a00` / `#9be8ae`    | 14.1 / 6.8 / 13.1                                                                                                                                                    |
| Camión             | remolque `#1f9a40`, cabina `#d98a00` | 5.2 / 6.8                                                                                                                                                            |
| Tronco             | `#d98a00`                            | 4.7 vs río                                                                                                                                                           |
| Tortuga            | `#1f9a40`                            | 3.6 vs río                                                                                                                                                           |
| Bocas              | borde `#d98a00` sobre `#0b2410`      | 6.0                                                                                                                                                                  |
| Barra de tiempo    | `#33ff66` / `#d98a00` / `#ff5a36`    | 14.1 / 6.8 / 6.1 (calculado en el paso 6, >= 3)                                                                                                                      |

Glow 0, `square: true`. Verde/ámbar con el rojo `#ff5a36` solo en la barra crítica. Vehículos verdes vs rana verde sobre la misma carretera: la rana lleva contorno y forma propia (cuerpo + ojos), los coches son rectángulos con ventanilla, y el motor ya los separa por movimiento.

### Resultado de la verificación de contraste (paso 6)

Recalculado con script (fórmula WCAG). Todos los ratios de las tablas anteriores se confirman; la barra crítica de `retro` (`#ff5a36`) da 6.1 contra las metas.

**Excepción documentada:** el criterio "zonas con luminancia ≤ `#1a1a1a`" (0.0103) no se cumple del todo con las paletas definidas: el río de `neon` (`#061a38`) tiene 0.0111 (apenas por encima, sigue siendo casi negro) y el río de `retro` (`#14381c`) tiene 0.0306. En `retro` se mantiene porque es lo que separa el río de la carretera (ratio 1.5); oscurecerlo lo haría indistinguible. Si se prefiere cumplir el criterio al pie de la letra, hay que bajar ese tono y reforzar el patrón de olas.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components (`AGENTS.md`).

1. **Tipos.** Verificar que `SkinId`, `skin?` y `setSkin?` existen en `lib/engines/types.ts`. Verificación: `npx tsc --noEmit`.
2. **Paletas en el motor.** Definir `Palette`/`PALETTES`, `let pal = PALETTES[skin ?? "clasico"]`, sustituir todos los colores hardcodeados (incluidos `CAR_COLORS`), tercer parámetro `skin` y `setSkin` en el handle. Verificación: con `clasico` el juego es idéntico al actual; `npm run lint`.
3. **Neon.** Glow por entidad con `save()/restore()`, contorno de rana, bordes de zona. Verificación: partida en `neon`, sin caída de FPS con 11 carriles, HUD y texto sin glow.
4. **Retro.** `square: true` (sin `roundRect` ni arcos en vehículos, tortugas y rana), líneas rectas, patrón de olas en el río, coordenadas enteras. Verificación: partida en `retro`, sin glow, bordes angulosos.
5. **Selector.** Añadir `"frogger"` a `SKINNED` en `components/game-player.tsx`. Verificación: aparece en `/jugar/frogger` y en los demás juegos con skins; no en `/jugar/caida` ni juegos simulados; persiste con `av_skin_frogger` tras recargar.
6. **Verificación de contraste y marco.** Recalcular todas las ratios y revisar cada skin dentro del marco `.crt` (`#050507`), incluidas tortugas sumergidas, rana sobre tronco/tortuga y barra de tiempo en sus tres tramos. Verificación: todas cumplen los umbrales o están documentadas.
7. **Verificación final.** `npx tsc --noEmit`, `npm run lint`, `npm run build`, partida completa en cada skin (morir, meta, ronda, game over, guardar puntuación, jugar de nuevo) y cambio de skin en medio de la partida.
8. **Registro.** Marcar `✔` en `clasico`, `neon` y `retro` de `frogger` en `references/game-with-themes.md`.

---

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] `clasico` es el default (sin valor en `localStorage`) y se ve igual que antes de la spec.
- [ ] `neon` y `retro` tienen todas las zonas con luminancia ≤ `#1a1a1a`; texto/HUD ≥ 4.5:1 y entidades ≥ 3:1 contra su zona (con las excepciones documentadas de rana/tronco/tortuga en retro, resueltas por contorno).
- [ ] En `neon` el glow no oculta la rana ni el HUD; sin `shadowBlur` activo sobre zonas o texto.
- [ ] En `retro` no hay glow ni esquinas redondeadas.
- [ ] Rana, vehículos, troncos y tortugas son distinguibles en cada skin sin depender solo del tono.
- [ ] El selector (`CLÁSICO`, `NEÓN`, `RETRO`) aparece en `/jugar/frogger`.
- [ ] Cambiar de skin durante la partida no la reinicia ni altera puntaje, vidas, nivel, posición ni tiempo.
- [ ] El skin persiste en `av_skin_frogger`; si `localStorage` falla o el valor es inválido, se usa `clasico`.
- [ ] Sin desajuste de hidratación en consola.
- [ ] Pausa, FIN, "JUGAR DE NUEVO" y `destroy()` cumplen el contrato; sin estado de módulo nuevo.
- [ ] Los demás juegos no cambian.
- [ ] `references/game-with-themes.md` marca `frogger` con `✔` en los tres skins.

---

## Decisiones tomadas y descartadas

- **Sí:** paleta como `Record<SkinId, Palette>` dentro del motor; **No:** archivo compartido de temas.
- **Sí:** reutilizar el patrón de la SPEC 10; **No:** reiniciar el motor al cambiar de skin.
- **Sí:** `clasico` conserva los colores actuales aunque haya ratios bajos preexistentes; **No:** retocar el look original.
- **Sí:** contorno oscuro de la rana en `neon`/`retro` para separarla de troncos y tortugas; **No:** oscurecer troncos/tortugas hasta perder 3:1 contra el río.
- **Sí:** `retro` verde fósforo + ámbar; **No:** paleta Game Boy clara (rompe el modo oscuro).
- **Sí:** pixelado por formas cuadradas y coordenadas enteras; **No:** renderizar a baja resolución con escalado (cambiaría los 640×560 del contrato).

---

## Riesgos identificados

| Riesgo                                                 | Mitigación                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `retro`: coches verdes y rana verde sobre la carretera | Contorno de rana, ventanilla y forma de coche; revisar en el paso 6. |
| `retro`: zonas con luminancia casi igual (1.1-1.5)     | Líneas de borde de 2 px y patrón de olas; revisar en el paso 6.      |
| `shadowBlur` costoso con ~60 entidades                 | Glow 8 y solo en entidades; medir en el paso 3.                      |
| Glow que persiste y mancha HUD o texto                 | `ctx.save()/restore()` y `shadowBlur = 0` tras cada dibujo.          |
| Ratios preexistentes bajos en `clasico`                | Aceptado, es el look original.                                       |
| Desajuste de hidratación por leer `localStorage`       | Leer en `useEffect` tras montar (ya resuelto en `GamePlayer`).       |

---

## Qué **no** está en esta spec

- Skins para otros juegos.
- Skins de la UI del sitio.
- Controles táctiles.
- Supabase Auth/RLS.
- Sprites nuevos, skins extra o sonido.

Cada uno, si se aborda, va en su propia spec.
