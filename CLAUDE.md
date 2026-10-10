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

- Usa siempre /frontend-design para diseñar interfaces de usuario.
- `/nuevo-juego <carpeta de references/started-games/ o descripción>` (`.claude/skills/nuevo-juego/`, plantilla en `template.md`): genera **solo la spec** (`specs/NN-slug.md`, estado Borrador) de un juego jugable con leaderboard. No escribe código; la implementación se hace luego con `/spec-impl NN-slug`.
- Agente `game-planner` (`.claude/agents/game-planner.md`): recomienda qué juego añadir y registra lo sugerido en el To Do `references/game-suggestions.md` (su memoria). No escribe código ni specs.
- Agente `skin-designer` (`.claude/agents/skin-designer.md`): dado UN juego que indiques, audita sus skins neon/retro/clasico legibles en modo oscuro y escribe la spec `specs/NN-skins-<game-id>.md` (Borrador, espera tu revisión) y, **al confirmarla, la pasa a Aprobado y la implementa él mismo** en la rama `spec-NN-skins-<game-id>` (un commit por paso, verifica con tsc/lint/build). Un juego por invocación. Registro de qué juegos ya tienen skins en `references/game-with-themes.md`.
- Agente `game-jam` (`.claude/agents/game-jam.md`): dado un tema, inventa un juego y escribe 3 specs incrementales (Borrador) en `specs/game-jam/<game-id>/`. No escribe código.

## Arquitectura

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4 (vía `@tailwindcss/postcss`) + TypeScript strict. Alias `@/*` → raíz del repo.
- `LayoutProps<"/">` en el layout es un tipo global generado por Next (tipado de rutas); no se importa.
- Código en `app/` (rutas), `components/` (UI) y `lib/` (datos y lógica). Textos de UI en español.

### Rutas

`/` home, `/games` biblioteca (solo juegos con motor), `/juegos/[id]` detalle (mejor puntaje y top 10 reales), `/jugar/[id]` reproductor, `/salon` hall of fame (top 12 real por juego), `/auth`, `/about` (formulario de contacto vía Server Action `app/about/actions.ts` + Resend).

### Catálogo y motores de juego

- `lib/games.ts` define el catálogo `GAMES` (datos estáticos). Hay entradas sin motor (gloton, invasores, rocas, ranaria, duelo-pixel) que no se muestran en la biblioteca.
- `lib/engines/` contiene los motores reales sobre canvas: `asteroids`, `caida` (Tetris, "THETRIS"), `arkanoid` (spritesheet en `public/games/arkanoid`) y `serpentina` (Snake) (ver `references/implemented-games.md`) cuando se necesite implementar. `ENGINES` (`lib/engines/index.ts`) mapea `game.id` → `EngineEntry` `{ start, width, height }` (resolución interna del canvas). Contrato en `lib/engines/types.ts`: `GameEngine = (canvas, events) => { pause, resume, end, destroy }`, con eventos `onScore/onLives/onLevel/onGameOver`; el estado vive en el closure del motor, sin estado de módulo.
- `components/game-player.tsx` es el único consumidor: si hay motor para el juego lo ejecuta en un `<canvas>` con el tamaño del motor; si no, cae a una simulación con `setInterval`. Al terminar permite "GUARDAR PUNTUACIÓN" (insert en `scores`). Para añadir un juego jugable: usar `/nuevo-juego`, luego motor en `lib/engines/`, registrarlo en `ENGINES` y tener la entrada en `GAMES`. `/games` y `components/library.tsx` filtran el catálogo por `id in ENGINES`.
- Leaderboard: tabla `scores` (`game_id` → `games.id`, `name`, `score`, `created_at`) con tipos en `lib/supabase/database.types.ts`. `lib/scores.ts` (server) expone `getBestScores` y `getGameBoard`; `components/hall-of-fame.tsx` y `game-player.tsx` usan el cliente de navegador.

### Sesión y Supabase

- `components/session-provider.tsx`: sesión de cliente basada en `localStorage` (`av_user`), invitado hasta montar. Todavía no es auth real de Supabase.
- `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts` (server, cookies vía `@supabase/ssr`). `supabaseEnv()` lanza error si faltan las variables; las referencias a `process.env.NEXT_PUBLIC_*` deben ser literales para que Next las inyecte. Aún no existe `proxy.ts` (refresco de sesión).
- Variables en `.env.local` (plantilla: `.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca uses `service_role` en el cliente.
- `.mcp.json` conecta el MCP de Supabase al proyecto; úsalo para inspeccionar tablas/migraciones antes de cambiar el esquema.
