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

Usa siempre /frontend-design para diseñar interfaces de usuario.

## Arquitectura

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4 (vía `@tailwindcss/postcss`) + TypeScript strict. Alias `@/*` → raíz del repo.
- `LayoutProps<"/">` en el layout es un tipo global generado por Next (tipado de rutas); no se importa.
- Código en `app/` (rutas), `components/` (UI) y `lib/` (datos y lógica). Textos de UI en español.

### Rutas

`/` home, `/games` biblioteca, `/juegos/[id]` detalle, `/jugar/[id]` reproductor, `/salon` hall of fame, `/auth`, `/about` (formulario de contacto vía Server Action `app/about/actions.ts` + Resend).

### Catálogo y motores de juego

- `lib/games.ts` define el catálogo `GAMES` (datos estáticos). Los datos de puntajes del hall of fame siguen siendo de muestra hasta la spec 06 (leaderboard en Supabase, tabla `scores`).
- `lib/engines/` contiene los motores reales sobre canvas. `ENGINES` (`lib/engines/index.ts`) mapea `game.id` → `GameEngine`. Contrato en `lib/engines/types.ts`: `(canvas, events) => { pause, resume, end, destroy }`, con eventos `onScore/onLives/onLevel/onGameOver`; el estado vive en el closure del motor, sin estado de módulo.
- `components/game-player.tsx` es el único consumidor: si hay motor para el juego lo ejecuta en un `<canvas>`; si no, cae a una simulación con `setInterval`. Para añadir un juego jugable: motor en `lib/engines/`, registrarlo en `ENGINES` y tener la entrada en `GAMES`.

### Sesión y Supabase

- `components/session-provider.tsx`: sesión de cliente basada en `localStorage` (`av_user`), invitado hasta montar. Todavía no es auth real de Supabase.
- `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts` (server, cookies vía `@supabase/ssr`). `supabaseEnv()` lanza error si faltan las variables; las referencias a `process.env.NEXT_PUBLIC_*` deben ser literales para que Next las inyecte. Aún no existe `proxy.ts` (refresco de sesión).
- Variables en `.env.local` (plantilla: `.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca uses `service_role` en el cliente.
- `.mcp.json` conecta el MCP de Supabase al proyecto; úsalo para inspeccionar tablas/migraciones antes de cambiar el esquema.
