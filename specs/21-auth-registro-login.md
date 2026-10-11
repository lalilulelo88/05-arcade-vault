# SPEC 21 — Registro, login y autenticación con Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 04 (clientes de Supabase), SPEC 06 (leaderboard y `scores`) y SPEC 01 (pantalla `/auth` y `SessionProvider` actuales)
> **Fecha:** 2026-10-11
> **Objetivo:** Reemplazar la sesión simulada en `localStorage` por autenticación real de Supabase (registro con confirmación por correo, login, cierre de sesión y recuperación de contraseña con correo + contraseña), manteniendo el modo invitado.

---

## Por qué existe esta spec

Hoy `/auth` es una maqueta: `components/auth-form.tsx` guarda un nombre en `localStorage` (`av_user`) sin validar nada, y `SessionProvider` no habla con Supabase. La spec 04 dejó los clientes `@supabase/ssr` listos y marcó como pendiente el login real y `proxy.ts`. Esta spec cierra ese hueco para que los puntajes puedan asociarse a un nombre de jugador real.

### Prerrequisitos manuales (fuera del código, panel de Supabase / Resend)

1. **Auth → Providers → Email:** activar «Confirm email».
2. **Auth → SMTP:** SMTP propio con Resend (host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = API key). Requiere un dominio verificado en Resend; sin él, Resend solo entrega al correo del propietario de la cuenta.
3. **Auth → URL Configuration:** `Site URL` = `http://localhost:3000` y `Redirect URLs` con `http://localhost:3000/auth/callback` (añadir las URL de producción cuando existan).
4. Plantillas de correo (Confirm signup y Reset password) apuntando a `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` y `...&type=recovery&next=/auth/restablecer` respectivamente (flujo `verifyOtp`, que no depende de que el correo se abra en el mismo navegador).

---

## Alcance

**Dentro:**

- Registro con **username + correo + contraseña**; el username se guarda en `user_metadata.username`. Tras registrarse se muestra el aviso «revisa tu correo»; no hay sesión hasta confirmar.
- Login con **correo + contraseña** (el username no sirve para entrar).
- Reenvío del correo de confirmación desde el aviso «revisa tu correo» y desde el error «correo sin confirmar» del login.
- Recuperación de contraseña: solicitar enlace (`/auth/recuperar`) y fijar la nueva (`/auth/restablecer`).
- Ruta `app/auth/callback/route.ts` que canjea `token_hash` + `type` con `verifyOtp` y redirige.
- Cierre de sesión desde el nav.
- `proxy.ts` en la raíz que refresca la sesión por cookies en cada petición.
- `SessionProvider` pasa a leer la sesión de Supabase (`onAuthStateChange`), conservando la API `useSession()` (`user`, `signOut`) y el estado «invitado hasta montar».
- `game-player.tsx`: con sesión, `name` por defecto = `username` (sigue siendo editable, como hoy).
- Mantener «JUGAR COMO INVITADO».
- Validación de formularios en cliente (correo válido, contraseña ≥ 8 caracteres, username 3–10 caracteres alfanuméricos o `_`) y mensajes de error de Supabase traducidos al español.

**Fuera (otras specs):**

- OAuth (Google/GitHub): los botones de la maqueta se **eliminan** de `AuthForm` en esta spec para no dejar controles muertos.
- Tabla `profiles`, unicidad de username, `scores.user_id` y RLS ligada al usuario (el leaderboard sigue como en la spec 06; `scores.name` sigue siendo texto libre).
- Rutas privadas / pantalla de perfil: ninguna ruta exige login.
- Obligar a iniciar sesión para guardar puntaje.
- Cambio de correo, de contraseña estando logueado, borrado de cuenta, MFA.
- Migraciones o cambios de esquema (no se toca la base de datos).
- Tests automatizados (no hay framework configurado).

---

## Modelo de datos

No hay tablas nuevas. Los datos viven en Supabase Auth.

```ts
// user_metadata del usuario de Supabase Auth (se envía en signUp → options.data)
type UserMetadata = { username: string }; // 3–10 chars, /^[A-Za-z0-9_]+$/

// components/session-provider.tsx — API pública (sin cambios de forma salvo `login`)
export type User = { name: string }; // name = user_metadata.username ?? parte local del correo, en mayúsculas
type Session = {
  user: User | null; // null = invitado o sesión sin cargar
  signOut: () => Promise<void>; // supabase.auth.signOut()
};
```

Rutas nuevas:

| Ruta                | Tipo          | Función                                                           |
| ------------------- | ------------- | ----------------------------------------------------------------- |
| `/auth`             | existente     | Pestañas Iniciar sesión / Crear cuenta + aviso «revisa tu correo» |
| `/auth/callback`    | Route Handler | `verifyOtp({ token_hash, type })` y redirección (`next` o `/`)    |
| `/auth/recuperar`   | página        | Pide el correo y llama `resetPasswordForEmail`                    |
| `/auth/restablecer` | página        | Con sesión de recuperación activa, `updateUser({ password })`     |

Convenciones:

- `login` desaparece del contexto (la sesión la gobierna Supabase); `AuthForm` llama directamente a `supabase.auth.signInWithPassword` / `signUp`.
- `localStorage` `av_user` deja de usarse; se borra la clave al montar si existe (limpieza de la maqueta).
- Los textos de UI y los mensajes de error van en español.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` las guías de `proxy` (antes `middleware`), Route Handlers y `cookies()`, y en la documentación de Supabase (`search_docs` del MCP) el flujo de Auth con `@supabase/ssr` para Next.js (`verifyOtp` con `token_hash`, `getUser` vs `getSession` en servidor). Según `AGENTS.md`, esta versión de Next tiene cambios incompatibles.

1. **`proxy.ts` y refresco de sesión.** Crear `proxy.ts` en la raíz con `createServerClient` sobre `request`/`response` que llama `supabase.auth.getUser()` y reescribe las cookies; `matcher` que excluye estáticos e imágenes. Verificación: `npm run build`; la app sigue cargando todas las rutas existentes.
2. **Callback de confirmación.** Crear `app/auth/callback/route.ts` con `verifyOtp`; redirige a `next` (solo rutas internas) o `/`, y a `/auth?error=enlace` si falla. Verificación: `npm run build`; petición con token inválido redirige con error sin excepción.
3. **`SessionProvider` con Supabase.** Reescribir `components/session-provider.tsx`: `getUser()` al montar + `onAuthStateChange`, `user` derivado de `user_metadata.username`, `signOut` asíncrono; eliminar `login` y la lectura de `av_user`. Verificación: `npx tsc --noEmit` (obliga a actualizar `AuthForm`).
4. **`AuthForm` real.** Reemplazar `submit` por `signInWithPassword` / `signUp` (con `options.data.username` y `emailRedirectTo` no necesario por usar `verifyOtp`); validación y errores traducidos; estados «enviando», error y aviso «revisa tu correo» con botón «Reenviar correo» (`auth.resend({ type: "signup" })`, con enfriamiento de 60 s); enlace «¿Olvidaste tu contraseña?»; quitar botones sociales; conservar «JUGAR COMO INVITADO». Verificación: registro con un correo real recibe el mensaje y, tras confirmar, queda logueado.
5. **Recuperar y restablecer contraseña.** Crear `app/auth/recuperar/page.tsx` y `app/auth/restablecer/page.tsx` reutilizando las clases `auth-card`/`field`/`btn` de la maqueta (usar `/frontend-design`). Verificación: el correo de recuperación llega, el enlace lleva a `/auth/restablecer` y la nueva contraseña permite entrar.
6. **Nav y `game-player`.** `components/nav.tsx`: con sesión, menú/botón con el username y acción «Cerrar sesión» (hoy el botón ya llama `signOut`; añadir etiqueta clara y redirigir a `/`). `components/game-player.tsx`: sin cambios de lógica salvo que `user?.name` ya sale del username. Verificación: login → el nav muestra el username; guardar puntaje usa ese nombre; cerrar sesión vuelve a «Iniciar Sesión».
7. **Documentación y pulido.** Actualizar `CLAUDE.md` (sección «Sesión y Supabase»: ya existe `proxy.ts`, la sesión es real, rutas `/auth/*`) y `.env.example` si hiciera falta (no se esperan variables nuevas). `npx tsc --noEmit`, `npm run lint`, `npm run build`, recorrido manual completo.

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` (sin errores en el código de la app) y `npm run build` terminan sin errores.
- [ ] Registrarse con username, correo y contraseña válidos muestra el aviso «revisa tu correo» y **no** inicia sesión; el correo de confirmación llega.
- [ ] Abrir el enlace del correo canjea el token en `/auth/callback`, deja la sesión iniciada y redirige a `/`; el nav muestra el username en mayúsculas.
- [ ] Iniciar sesión con correo y contraseña correctos funciona; con contraseña incorrecta muestra un error en español sin revelar si el correo existe; con correo sin confirmar ofrece reenviar el correo.
- [ ] «Reenviar correo» envía un nuevo mensaje y queda deshabilitado 60 s.
- [ ] Un username fuera de 3–10 caracteres o con símbolos, un correo inválido o una contraseña < 8 caracteres bloquean el envío con mensaje de validación.
- [ ] «Recuperar contraseña» envía el correo, el enlace abre `/auth/restablecer` y la nueva contraseña permite iniciar sesión; abrir `/auth/restablecer` sin sesión de recuperación redirige a `/auth/recuperar`.
- [ ] Cerrar sesión desde el nav limpia la sesión (cookies incluidas) y recargar la página mantiene el estado de invitado.
- [ ] La sesión persiste tras recargar y tras cerrar y reabrir el navegador (cookies refrescadas por `proxy.ts`).
- [ ] Con sesión, `/jugar/[id]` propone el username como nombre; el puntaje se guarda en `scores` con ese nombre y aparece en el leaderboard.
- [ ] «JUGAR COMO INVITADO» sigue funcionando y el invitado puede jugar y guardar puntaje como antes.
- [ ] `/auth` ya no muestra botones de Google/GitHub; en `localStorage` no queda `av_user` tras cargar la app.
- [ ] `/auth/callback?next=https://otro-sitio.com` no redirige fuera del dominio (solo rutas internas).
- [ ] La base de datos no cambió: `list_tables` sigue mostrando solo `games` y `scores`; no aparece `service_role` en el repo.
- [ ] `/`, `/games`, `/juegos/[id]`, `/salon`, `/about` se comportan igual que antes para un invitado.

---

## Decisiones tomadas y descartadas

- **Sí:** correo + contraseña. **No:** OAuth ni magic link en esta spec; OAuth exige apps externas y configuración que merece su propia spec, y los botones muertos se eliminan.
- **Sí:** confirmación por correo, con SMTP propio de Resend. Decisión del usuario. **No:** SMTP por defecto de Supabase, que solo entrega a miembros del equipo y con límite muy bajo.
- **Sí:** flujo `verifyOtp` con `token_hash`. Funciona aunque el enlace se abra en otro navegador o dispositivo. **No:** `exchangeCode` con PKCE, que falla si el correo se abre fuera del navegador que inició el flujo.
- **Sí:** username en `user_metadata`, sin tabla. Decisión del usuario; evita migración y RLS. **Consecuencia aceptada:** sin unicidad (dos usuarios pueden compartir username) y `scores` sigue sin `user_id`. **No:** `profiles` ni `scores.user_id`, que quedan para otra spec.
- **Sí:** login solo con correo, porque sin tabla no se puede resolver username → correo. **No:** login por username.
- **Sí:** recuperar contraseña y reenviar confirmación dentro de esta spec. Decisión del usuario, a pesar de añadir dos rutas.
- **Sí:** mantener modo invitado y rutas públicas. **No:** exigir login para guardar puntaje ni rutas protegidas.
- **Sí:** `proxy.ts` ahora (la spec 04 lo difirió hasta tener sesiones). Usar `getUser()` y no `getSession()` en servidor, que no valida el JWT.
- **Sí:** conservar `useSession()` con `user.name` para no tocar los consumidores (`nav`, `game-player`). **No:** reescribir el contexto con otra forma.
- **No:** migrar a los usuarios de la maqueta; `av_user` es un dato simulado y se descarta.

---

## Riesgos identificados

| Riesgo                                                                         | Mitigación                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Resend sin dominio verificado no entrega a usuarios reales                     | Prerrequisito 2 explícito; para pruebas, registrarse con el correo propietario de la cuenta de Resend |
| Límite de envíos de correo de Supabase Auth (registro, reenvío y recuperación) | Enfriamiento de 60 s en cliente; mostrar el error de límite traducido                                 |
| Next 16 difiere de lo conocido (`proxy`, `cookies()` asíncrono)                | Leer las guías en `node_modules/next/dist/docs/` antes del paso 1                                     |
| Open redirect vía `next` en `/auth/callback`                                   | Aceptar solo rutas que empiecen por `/` y no por `//`; criterio de aceptación específico              |
| Enumeración de correos por mensajes de error distintos                         | Mensaje genérico en login fallido; en recuperación, mismo aviso exista o no el correo                 |
| Username sin unicidad permite suplantar nombres en el leaderboard              | Riesgo aceptado y documentado; se resuelve con `profiles` en una spec futura                          |
| Plantillas de correo sin actualizar rompen los enlaces                         | Prerrequisito 4 explícito; la verificación del paso 4 y 5 usa correos reales                          |
| `SessionProvider` con `onAuthStateChange` provoca desajuste de hidratación     | Mantener «invitado hasta montar», como hoy                                                            |

---

## Qué **no** está en esta spec

- OAuth (Google/GitHub) y magic link.
- Tabla `profiles`, unicidad de username y `scores.user_id`.
- Rutas protegidas, pantalla de perfil y obligar login para guardar puntaje.
- Cambio de correo/contraseña con sesión activa, borrado de cuenta y MFA.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
