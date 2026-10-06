# SPEC 04 — Integración base de Supabase en Next.js

> **Estado:** Implementado
> **Depende de:** SPEC 03
> **Fecha:** 2026-10-06
> **Objetivo:** Dejar Supabase conectado a la aplicación Next.js con clientes de navegador y de servidor listos para usar, sin crear tablas ni cambiar ninguna pantalla.

---

## Por qué existe esta spec

Las siguientes funcionalidades (autenticación, perfiles, puntajes reales, ranking en tiempo real y Edge Functions) dependen de Supabase. Esta spec instala solo la base de la integración para que cada una de ellas se defina en su propia spec sin repetir configuración. El proyecto Supabase (`prjsqlqfbcfredpvwonc`) ya está enlazado en `.mcp.json` desde el commit `5951e1e`.

---

## Alcance

**Dentro:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno públicas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en `.env.example` y definidas en `.env.local` (no versionado).
- Cliente de navegador en `lib/supabase/client.ts` (para Client Components).
- Cliente de servidor en `lib/supabase/server.ts` (para Server Components, Server Actions y Route Handlers), con manejo de cookies.
- Error claro y temprano si falta alguna de las dos variables.

**Fuera de alcance (para otras specs):**

- Autenticación: método de login, formulario real en `/auth`, cierre de sesión y protección de rutas. El método se decide en su propia spec.
- Refresco de sesión por cookies (`proxy.ts`, antes `middleware.ts`). No hay sesiones hasta que exista la spec de auth; se agrega allí.
- Tablas, políticas RLS, migraciones y carpeta `supabase/`. Esta spec no modifica la base de datos.
- Tabla `profiles` y nombres de usuario.
- Persistir puntajes o reemplazar `av_scores` de `localStorage` y `seededScores`.
- Realtime (ranking en vivo) y Edge Functions. Se pensó en ellos como uso futuro; no se configura nada ahora.
- Tipos generados de la base de datos (`generate_typescript_types`): sin tablas no hay nada que tipar.
- Clave `service_role`. No se usa ni se guarda en el proyecto.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

Esta spec no introduce datos ni tablas. Solo agrega dos módulos y variables de entorno.

```ts
// lib/supabase/client.ts — Client Components
export function createClient(): SupabaseClient; // createBrowserClient(url, key)

// lib/supabase/server.ts — Server Components, Server Actions, Route Handlers
export async function createClient(): Promise<SupabaseClient>; // createServerClient con cookies de next/headers
```

Variables de entorno (públicas por diseño; la seguridad la dará RLS en specs futuras):

```
NEXT_PUBLIC_SUPABASE_URL=                  # https://prjsqlqfbcfredpvwonc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # clave publishable del proyecto
```

Convenciones:

- Cada llamada a `createClient()` crea un cliente nuevo; no hay singleton de módulo en el servidor.
- Si falta una variable, el módulo lanza `Error` con el nombre de la variable que falta.
- Los valores se obtienen con las herramientas MCP `get_project_url` y `get_publishable_keys`, o desde el panel de Supabase.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de `cookies()` de `next/headers` y la de variables de entorno. Según `AGENTS.md`, esta versión de Next tiene cambios incompatibles. Revisar también la guía oficial de Supabase para Next.js con `@supabase/ssr` (`search_docs` del MCP).

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`; agregar las dos variables a `.env.example` con comentario; copiar los valores reales a `.env.local`. Verificación: `npm run build` compila.
2. **Cliente de navegador.** Crear `lib/supabase/client.ts` con `createBrowserClient` y la comprobación de variables. Verificación: `npm run build` compila.
3. **Cliente de servidor.** Crear `lib/supabase/server.ts` con `createServerClient` y el adaptador de cookies sobre `await cookies()`. El `setAll` ignora el error de escritura de cookies en Server Components (se resolverá con `proxy.ts` en la spec de auth). Verificación: `npm run build` compila.
4. **Verificación de conexión.** Con un Route Handler temporal (no se commitea) que llama `createClient()` del servidor y `supabase.auth.getUser()`, comprobar que responde sin error de red; eliminarlo al terminar. Verificación: ver criterios de aceptación.
5. **Pulido.** `npm run lint`, `npm run build` y revisión de que `.env.local` no está en git.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Existen `lib/supabase/client.ts` y `lib/supabase/server.ts`, ambos exportan `createClient`.
- [ ] `npm ls @supabase/supabase-js @supabase/ssr` muestra ambas dependencias instaladas.
- [ ] `.env.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales; `.env.local` no está en git.
- [ ] `curl` a `$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health` con la cabecera `apikey` responde `200`.
- [ ] El Route Handler temporal, con el cliente de servidor, devuelve `user: null` sin error de red ni excepción, y fue eliminado (no queda en `app/`).
- [ ] Sin `NEXT_PUBLIC_SUPABASE_URL` definida, `createClient()` lanza un error que nombra esa variable.
- [ ] En el código y en el repositorio no aparece ninguna clave `service_role`.
- [ ] Ninguna pantalla existente cambia: `/`, `/games`, `/about`, `/auth`, `/salon` se comportan igual que antes.
- [ ] La base de datos no cambió: `list_tables` del MCP no muestra tablas nuevas en el esquema `public` respecto al inicio.
- [ ] No quedan imports ni código en `app/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** solo la base de integración en esta spec. Decisión del usuario; auth, puntajes y realtime son áreas distintas y van en specs propias.
- **No:** login real en `/auth`, aunque se consideró. El usuario separó el método de autenticación de esta spec.
- **No:** tabla `profiles` ni ninguna otra. Decisión del usuario: solo la implementación de Next.js con Supabase, sin agregar tablas.
- **Sí:** `@supabase/ssr` con dos clientes (navegador y servidor). Es el enfoque oficial para App Router y servirá para auth por cookies más adelante.
- **No:** solo `@supabase/supabase-js` con un único cliente. Funcionaría hoy, pero obligaría a rehacerlo cuando haya sesión en el servidor.
- **No:** `proxy.ts` ahora. Sin autenticación no hay sesión que refrescar; agregarlo ahora es código sin uso (YAGNI). Entra en la spec de auth.
- **Sí:** nombre `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Es la clave publishable actual de Supabase (la que expone `get_publishable_keys`), no la antigua `anon`.
- **Sí:** error explícito si falta una variable. Falla rápido con un mensaje útil en vez de un error opaco del SDK.
- **Sí:** verificación con un Route Handler temporal y no commiteado. No hay tests ni pantalla que consuma Supabase todavía; así no se deja código muerto en el repo.
- **No:** `service_role` ni Edge Functions ahora. Realtime y Edge Functions quedan anotados como uso futuro, sin configuración previa.
- **No:** tipos generados. Sin tablas no aportan nada; se generan cuando existan.
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo                                                                                    | Mitigación                                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Next 16 difiere de lo conocido (`cookies()` asíncrono, `middleware` renombrado a `proxy`) | Leer la guía en `node_modules/next/dist/docs/` antes de escribir; `cookies()` se espera con `await`.  |
| Confundir la clave publishable con `service_role` y exponer privilegios                   | Solo se usa la publishable; criterio de aceptación que verifica que no hay `service_role` en el repo. |
| Una clave publishable sin RLS expone tablas futuras                                       | Fuera de alcance aquí (no hay tablas); cada spec que cree tablas deberá incluir RLS.                  |
| Escribir cookies desde un Server Component lanza error                                    | `setAll` captura y omite el error; el refresco real llega con `proxy.ts` en la spec de auth.          |
| Valores reales de `.env.local` se versionan por error                                     | `.env*` ya está en `.gitignore`; solo se versiona `.env.example`.                                     |
| Cambios en la API de `@supabase/ssr` respecto a lo conocido                               | Consultar la documentación vigente con `search_docs` del MCP antes del paso 2.                        |

---

## Qué **no** está en esta spec

- Autenticación (método, formulario, sesión, rutas protegidas) ni `proxy.ts`.
- Tablas, `profiles`, RLS y migraciones.
- Puntajes y ranking persistentes.
- Realtime y Edge Functions.
- Tipos generados y clave `service_role`.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
