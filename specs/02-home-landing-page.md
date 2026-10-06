# SPEC 02 — Home / landing page de Arcade Vault

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-06
> **Objetivo:** Implementar en `/` la landing page del template `references/templates/home-about/home.jsx` y mover la Biblioteca actual a `/games`.

---

## Por qué existe esta spec

La spec 01 dejó la Biblioteca como portada (`/`). El template `references/templates/home-about/` define una landing de marketing (hero, beneficios, juegos destacados, estadísticas, actividad, precios, CTA final) que debe ser la portada, con la Biblioteca como pantalla separada, como en el template ("Inicio" / "Biblioteca").

---

## Alcance

**Dentro:**

- Nueva portada en `/` (`app/page.tsx`) con las secciones del template:
  - **Hero**: eyebrow "INSERTA UNA MONEDA_", título en 3 líneas, subtítulo, CTAs "EXPLORAR JUEGOS" (→ `/games`) y "CREAR CUENTA" (→ `/auth`), indicador "DESLIZA", 8 siluetas pixel flotantes decorativas (SVG).
  - **// 01 ¿POR QUÉ ARCADE VAULT?**: 4 tarjetas de beneficios con icono pixel (GAMEPAD, FREE, TROPHY, ROCKET).
  - **// 02 JUEGOS DISPONIBLES AHORA**: carrusel con los 6 primeros de `GAMES` (cada mini-tarjeta → `/juegos/[id]`) y botón "VER TODOS LOS JUEGOS →" (→ `/games`).
  - **Estadísticas**: 3 bloques ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING").
  - **// 03 ACTIVIDAD EN VIVO**: "Últimas puntuaciones" (7 filas) y "Top jugadores · hoy" (5 filas con barra), enlace "VER SALÓN →" (→ `/salon`).
  - **// 04 PRECIOS**: tarjeta "JUGADOR VAULT $0 / SIEMPRE", botón "EMPEZAR GRATIS →" (→ `/auth`) y 3 preguntas frecuentes.
  - **CTA final**: "¿LISTO PARA JUGAR?" y "INSERTAR MONEDA →" (→ `/games`).
- Animación de entrada por scroll (`.reveal` → `.in`) con `IntersectionObserver`, respetando `prefers-reduced-motion`.
- **Mover la Biblioteca actual a `/games`** (`app/games/page.tsx`) con su contenido actual (hero + `Library`), sin otros cambios.
- Nav (menú de escritorio y panel móvil): agregar enlace **"Inicio"** (→ `/`); "Biblioteca" pasa a apuntar a `/games`.
- Actualizar los enlaces existentes que apuntan a la Biblioteca para que usen `/games`.
- Portar a `app/globals.css` los estilos del Home desde `references/templates/home-about/styles.css` (`home-*`, `feature-*`, `mini-*`, `stat-*`, `activity-*`, `tick-*`, `top-*`, `price-*`, `faq-*`, `reveal`, etc.), sin duplicar los que ya existen.
- Datos mock estáticos tipados en `lib/home.ts` (últimas puntuaciones, top jugadores, beneficios, estadísticas, FAQ).
- Metadata (`title`) de `/` y `/games`.

**Fuera de alcance (para otras specs):**

- Página "Acerca de" (`about.jsx`) y su enlace en el nav. Se deja para una spec propia.
- Datos reales o en tiempo real en "Actividad en vivo"; los datos no se mezclan con `av_scores` ni con `seededScores`.
- Redirecciones desde la antigua Biblioteca (no hay usuarios ni enlaces externos aún).
- Cambios en las pantallas de detalle, reproductor, auth o salón, salvo actualizar sus enlaces a la Biblioteca.
- Pasarela de pago o planes reales: la sección Precios es solo informativa.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

Definido en `lib/home.ts` (valores copiados de `home.jsx`, constantes sin lógica):

```ts
import type { Accent } from "@/lib/games";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export type Feature = { icon: FeatureIconKind; title: string; desc: string; color: Accent };
export type HomeStat = { n: string; unit: string; sub: string };
export type RecentScore = { player: string; game: string; score: number; when: string; color: Accent };
export type TopPlayer = { rank: number; player: string; score: number };
export type Faq = { q: string; a: string };

export const FEATURES: Feature[];       // 4
export const HOME_STATS: HomeStat[];    // 3
export const RECENT_SCORES: RecentScore[]; // 7
export const TOP_PLAYERS: TopPlayer[];  // 5
export const FAQS: Faq[];               // 3
```

Convenciones:

- Los puntajes se muestran con `toLocaleString("es-ES")`.
- El ancho de la barra de "Top jugadores" es `100 - índice * 16` (%), como en el template.
- Los juegos de la sección 02 salen de `GAMES.slice(0, 6)` (`lib/games.ts`); no se duplican.
- No hay persistencia nueva.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Server/Client Components y de `metadata` (según `AGENTS.md`, esta versión de Next tiene cambios incompatibles).

1. **Mover la Biblioteca.** Crear `app/games/page.tsx` con el contenido actual de `app/page.tsx`; actualizar en `components/nav.tsx` el href de "Biblioteca" (escritorio y móvil) y el estado activo (`/games`, `/juegos*`, `/jugar*`); actualizar los enlaces "VOLVER AL VAULT" / "VOLVER A LA BIBLIOTECA" en `components/game-player.tsx`, `components/hall-of-fame.tsx` y `app/juegos/[id]/page.tsx` si aplica. Dejar temporalmente `app/page.tsx` como está. Verificación: `/games` muestra la Biblioteca, y los enlaces de vuelta llegan a `/games`.
2. **Datos.** Crear `lib/home.ts` con tipos y constantes. Verificación: `npm run build` compila.
3. **Estilos.** Portar los estilos del Home a `app/globals.css`, reutilizando variables y utilidades existentes (`btn`, `pixel`, `neon-*`, `blink`, `fade-in`). Verificar que `.reveal` deja el contenido visible si no hay JS o si hay `prefers-reduced-motion`. Verificación: sin errores de CSS al arrancar.
4. **Componentes de presentación.** Crear `components/home/floating-silhouettes.tsx`, `components/home/feature-icon.tsx` y `components/home/mini-card.tsx` (Server Components; `mini-card` usa `<Link>`).
5. **Reveal.** Crear `components/home/reveal-observer.tsx` (cliente, sin UI): `IntersectionObserver` sobre `.reveal` con `threshold: 0.12`; añade `.in` y deja de observar; si `prefers-reduced-motion`, marca todo como `.in` de inmediato.
6. **Página Home.** Reescribir `app/page.tsx` (Server Component) con las 6 secciones, el CTA final y `<RevealObserver />`; los botones son `<Link className="btn …">`. Exportar `metadata.title`.
7. **Nav.** Agregar "Inicio" (→ `/`) en escritorio y panel móvil; el estado activo de "Inicio" es solo `pathname === "/"`. Verificación: el nav marca la sección correcta en `/`, `/games`, `/juegos/*`, `/salon`.
8. **Pulido.** Revisión responsive a 375 px, metadata de `/games`, `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/` renderiza el Home con hero, secciones 01 a 04, estadísticas y CTA final, sin errores en la consola del navegador.
- [ ] `/games` muestra la Biblioteca (8 tarjetas, buscador y chips funcionando como en la spec 01).
- [ ] `/` ya no muestra el buscador ni la grilla de la Biblioteca.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" navegan a `/games`.
- [ ] "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`; "VER SALÓN →" navega a `/salon`.
- [ ] La sección 02 muestra 6 mini-tarjetas y cada una navega a `/juegos/<id>` del juego correspondiente.
- [ ] La sección 03 muestra 7 filas de últimas puntuaciones y 5 de top jugadores, con puntajes formateados en `es-ES` (p. ej. `312.840`).
- [ ] El nav muestra "Inicio", "Biblioteca" y "Salón de la Fama" (sin "Acerca de"); "Inicio" está activo solo en `/` y "Biblioteca" en `/games`, `/juegos/*` y `/jugar/*`.
- [ ] El panel móvil incluye "Inicio" y los enlaces "VOLVER" de reproductor, salón y detalle llevan a `/games`.
- [ ] Las secciones con `.reveal` aparecen al hacer scroll; con `prefers-reduced-motion: reduce` están visibles desde el inicio.
- [ ] A 375 px de ancho no hay scroll horizontal en `/` y las siluetas decorativas no tapan botones ni texto.
- [ ] Las siluetas tienen `aria-hidden` y los botones son enlaces (`<a>`) navegables con teclado.
- [ ] Visualmente, `/` es equivalente a la landing de `references/templates/home-about/arcade-vault-standalone.html`.
- [ ] No quedan imports ni código en `app/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** Home en `/` y Biblioteca en `/games`. Decisión del usuario; replica la separación Inicio / Biblioteca del template.
- **No:** Home en `/inicio` con la Biblioteca en `/`. Descartado: la landing debe ser la portada.
- **Sí:** "Acerca de" fuera de alcance, sin enlace en el nav. Evita un enlace roto y mantiene la spec en una sola pantalla.
- **Sí:** datos de actividad y estadísticas como mock estático en `lib/home.ts`. Coherente con la spec 01 (mock, sin backend).
- **No:** derivar la actividad de `GAMES`/`seededScores`. Los nombres y puntajes del template no coinciden con esos datos y forzarlo cambiaría el diseño aprobado.
- **Sí:** Home como Server Component; solo `RevealObserver` es cliente. Menos JS y los CTAs son `<Link>` reales.
- **No:** Home completo como componente cliente (como el template). No hace falta estado ni handlers.
- **Sí:** portar CSS a `app/globals.css` conservando clases, igual que la spec 01.
- **Sí:** mantener `/juegos/[id]` y `/jugar/[id]` sin renombrar. Solo `/` y `/games` cambian; renombrar el resto es otra decisión.
- **Sí:** respetar `prefers-reduced-motion` en el reveal, aunque el template no lo hace (accesibilidad básica).
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Enlaces que apuntan a `/` esperando la Biblioteca quedan mal (`game-player`, `hall-of-fame`, detalle) | Paso 1 los revisa explícitamente; `auth-form` redirige a `/` tras login y se mantiene (aterriza en el Home). |
| `.reveal` oculta contenido si el observer no corre (sin JS, o el observer no dispara) | CSS que deja visible el contenido sin JS/`reduced-motion`; el observer marca `.in` al montar si no hay `IntersectionObserver`. |
| Colisión de nombres CSS entre el Home y estilos de la spec 01 (`hero`, `card`, etc.) | Los estilos del Home usan prefijos propios (`home-*`, `feature-*`, `mini-*`); revisar duplicados en el paso 3. |
| Next 16 difiere de lo conocido (metadata, Server/Client Components) | Leer la guía en `node_modules/next/dist/docs/` antes de escribir. |
| Las siluetas flotantes causan scroll horizontal en móvil | Contenedor con `overflow: hidden`; verificar a 375 px. |

---

## Qué **no** está en esta spec

- Página "Acerca de".
- Datos reales o en vivo de actividad y rankings.
- Redirecciones o compatibilidad con la URL antigua de la Biblioteca.
- Sistema de pagos o planes.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
