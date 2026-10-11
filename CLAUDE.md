# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por la mayor cantidad de puntos. Se desarrolla con Spec Driven Design (comandos `/spec` y `/spec-impl`, skills de [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills)).

- Las specs viven en `specs/NN-slug.md` y cada una lleva `> **Estado:**` (Borrador → Aprobado → Implementado). `/spec-impl` trabaja en una rama `spec-NN-slug`, un commit por paso, y al final marca la spec como Implementado.
- `references/` contiene plantillas JSX/HTML del diseño y juegos de ejemplo (vanilla JS). Son solo referencia: no forman parte de la app.

## Comandos

```bash
npm run dev          # servidor de desarrollo (http://localhost:3000)
npm run build        # build de producción
npm run lint         # eslint (flat config)
npx tsc --noEmit     # chequeo de tipos
```

No hay framework de tests configurado. Un hook `PostToolUse` (`.claude/hooks/format.mjs`) corre prettier + eslint sobre cada archivo que se escribe/edita; si falla, hay que corregir antes de seguir.

## Skills

- `/frontend-design`: úsala siempre para diseñar interfaces de usuario.
- `/nuevo-juego <carpeta de references/started-games/ o descripción>`: genera solo la spec (Borrador) de un juego jugable con leaderboard. Definición: `.claude/skills/nuevo-juego/SKILL.md`.
- `/spec-impl-game <NN-slug>`: como `/spec-impl` y, al terminar, lanza `skin-designer` y luego `mobile-porter` sobre el juego. Definición: `.claude/skills/spec-impl-game/SKILL.md`.

## Agentes

Definición completa de cada uno en `.claude/agents/<nombre>.md`. Los que implementan escriben la spec en Borrador, esperan tu confirmación y trabajan en la rama `spec-NN-...`. Un juego por invocación.

- `game-planner`: recomienda qué juego añadir; lleva el To Do `references/game-suggestions.md`. No escribe código ni specs.
- `game-jam`: dado un tema, inventa un juego y escribe specs incrementales en `specs/game-jam/<game-id>/`. No escribe código.
- `skin-designer`: skins neon/retro/clasico de un juego (spec + implementación). Registro en `references/game-with-themes.md`.
- `mobile-porter`: versión móvil de un juego (botonera táctil, proporción, HUD; spec + implementación). No toca motores.
- `security-auditor`: audita la seguridad de la BD (RLS, políticas, advisors, grants) y de la app (secretos, Auth, headers, Server Actions, dependencias) contra las specs 21 y 22. Informa por defecto; solo corrige tras spec aprobada.
- `game-performance-booster`: mide ms/frame por skin de un juego y aplica solo las optimizaciones justificadas (spec + implementación). No toca jugabilidad.

## Arquitectura

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4 (vía `@tailwindcss/postcss`) + TypeScript strict. Alias `@/*` → raíz del repo.
- `LayoutProps<"/">` en el layout es un tipo global generado por Next (tipado de rutas); no se importa.
- Código en `app/` (rutas), `components/` (UI) y `lib/` (datos y lógica). Textos de UI en español.

### Rutas

`/` home, `/games` biblioteca (solo juegos con motor), `/juegos/[id]` detalle (mejor puntaje y top 10 reales), `/jugar/[id]` reproductor, `/salon` hall of fame (top 12 real por juego), `/auth`, `/about` (formulario de contacto vía Server Action `app/about/actions.ts` + Resend).

### Catálogo y motores de juego

- `lib/games.ts` define el catálogo `GAMES` (datos estáticos). Hay entradas sin motor (gloton, invasores, rocas, ranaria, duelo-pixel) que no se muestran en la biblioteca.
- `lib/engines/` contiene los motores reales sobre canvas: `asteroids`, `caida` (Tetris, "THETRIS", archivo `tetris.ts`), `arkanoid` (spritesheet en `public/games/arkanoid`), `serpentina` (Snake) y `frogger`. `ENGINES` (`lib/engines/index.ts`) mapea `game.id` → `EngineEntry` `{ start, width, height }` (resolución interna del canvas). Contrato en `lib/engines/types.ts`: `GameEngine = (canvas, events) => { pause, resume, end, destroy }`, con eventos `onScore/onLives/onLevel/onGameOver`; el estado vive en el closure del motor, sin estado de módulo.
- `components/game-player.tsx` es el único consumidor: si hay motor para el juego lo ejecuta en un `<canvas>` con el tamaño del motor; si no, cae a una simulación con `setInterval`. En móvil muestra la botonera de `components/touch-controls.tsx`. Al terminar permite "GUARDAR PUNTUACIÓN" (insert en `scores`). Para añadir un juego jugable: usar `/nuevo-juego`, luego motor en `lib/engines/`, registrarlo en `ENGINES` y tener la entrada en `GAMES`. `/games` y `components/library.tsx` filtran el catálogo por `id in ENGINES`.
- Leaderboard: tabla `scores` (`game_id` → `games.id`, `name`, `score`, `created_at`) con tipos en `lib/supabase/database.types.ts`. `lib/scores.ts` (server) expone `getBestScores` y `getGameBoard`; `components/hall-of-fame.tsx` y `game-player.tsx` usan el cliente de navegador.

### Sesión y Supabase

- Auth real de Supabase (correo + contraseña, confirmación por correo vía `verifyOtp`; spec 21). `components/session-provider.tsx` expone `useSession()` → `{ user, signOut }` desde la sesión de Supabase (invitado hasta montar); `user.name` = `user_metadata.username` en mayúsculas. Rutas `/auth` (login/registro, `components/auth-form.tsx`), `/auth/callback` (Route Handler), `/auth/recuperar` y `/auth/restablecer` (`components/password-forms.tsx`). Ninguna ruta exige login; se mantiene el modo invitado.
- `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts` (server, cookies vía `@supabase/ssr`). `supabaseEnv()` lanza error si faltan las variables; las referencias a `process.env.NEXT_PUBLIC_*` deben ser literales para que Next las inyecte. `proxy.ts` (raíz) refresca la sesión por cookies en cada petición y no protege rutas.
- Variables en `.env.local` (plantilla: `.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca uses `service_role` en el cliente.
- Seguridad (spec 22): RLS activo en `games` y `scores`. Políticas: `games_select_public`, `scores_select_public` y `scores_insert_validated` (insert para `anon`/`authenticated` con `WITH CHECK`: juego existente, `name` 1–10 caracteres tras `trim`, `score` 0–10 000 000); no hay políticas de UPDATE/DELETE. `public.rls_auto_enable()` (event trigger `SECURITY DEFINER`) no es ejecutable por `anon`/`authenticated`. `next.config.ts` añade a todas las rutas `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (sin cámara, micrófono ni geolocalización) y HSTS; no hay CSP. Ajustes de Auth del panel (no están en el repo): contraseña mínima de 8 caracteres, rate limit de signups/sign-ins por IP y leaked password protection (solo plan Pro).
- `.mcp.json` conecta el MCP de Supabase al proyecto; úsalo para inspeccionar tablas/migraciones antes de cambiar el esquema.
