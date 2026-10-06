# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

Arcade Vault: plataforma para jugar online y competir por la mayor cantidad de puntos. Se desarrolla con Spec Driven Design (comandos `/spec` y `/spec-impl`, skills de [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills)). El código está aún en el scaffold inicial de Create Next App.

## Comandos

```bash
npm run dev     # servidor de desarrollo (http://localhost:3000)
npm run build   # build de producción
npm run lint    # eslint (flat config, eslint.config.mjs)
npx tsc --noEmit  # chequeo de tipos
```

No hay framework de tests configurado.

## Arquitectura

- Next.js 16 (App Router) + React 19 + Tailwind CSS 4 (vía `@tailwindcss/postcss`) + TypeScript strict.
- Todo el código vive en `app/` (layout raíz en `app/layout.tsx`, estilos globales en `app/globals.css`).
- Alias de imports: `@/*` → raíz del repo.
- `LayoutProps<"/">` en el layout es un tipo global generado por Next (tipado de rutas); no se importa.
- Fuentes Geist vía `next/font/google`.
