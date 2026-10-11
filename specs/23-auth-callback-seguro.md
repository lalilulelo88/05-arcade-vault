# SPEC 23 — Endurecer `/auth/callback` (open redirect y tipos de OTP)

> **Estado:** Implementado
> **Depende de:** SPEC 21 (Auth real) y SPEC 22 (seguridad básica)
> **Fecha:** 2026-10-11
> **Objetivo:** Cerrar el open redirect de `app/auth/callback/route.ts` y limitar los tipos de OTP que acepta el callback, sin cambiar el flujo de confirmación ni de recuperación.

---

## Por qué existe esta spec

La revisión de seguridad de la autenticación (2026-10-11) encontró en `app/auth/callback/route.ts`:

- **Open redirect (media-alta).** `safeNext` filtra con `/^\/(?![/\\])/`, que bloquea `//` y `/\` pero no tabulaciones ni saltos de línea. El parser WHATWG de `URL` los elimina, así que `?next=/%09/evil.com` pasa el filtro y `new URL("/\t/evil.com", request.url)` resuelve a `https://evil.com/`. Verificado ejecutando el código: el regex devuelve `true` y la URL resultante es `https://evil.com/`. Un enlace de confirmación o recuperación válido con ese `next` deja al usuario en un sitio ajeno tras `verifyOtp` (phishing).
- **`type` sin allowlist (baja).** `searchParams.get("type") as EmailOtpType` es solo un cast; cualquier valor llega a `verifyOtp`. La app solo necesita `signup`, `recovery` y `email`.

---

## Alcance

**Dentro:**

- Reescribir `safeNext` en `app/auth/callback/route.ts` para validar por **origen**: resolver `next` contra `request.url` y aceptarlo solo si el origen coincide; devolver `pathname + search` (nunca la URL completa). Cualquier otro caso → `/`.
- Allowlist de `type`: `signup`, `recovery` y `email`. Si no está, redirigir a `/auth?error=enlace` sin llamar a `verifyOtp`.
- Actualizar el comentario del archivo y la mención del callback en `CLAUDE.md` si procede.

**Fuera (otras specs):**

- Validación de `username` en servidor (trigger/`CHECK` sobre `auth.users.raw_user_meta_data`) y unicidad de usernames.
- Exigir reautenticación o «Secure password change» en `/auth/restablecer`.
- `Content-Security-Policy`, CAPTCHA, MFA, cambio de correo y borrado de cuenta.
- Tests automatizados (no hay framework configurado).

---

## Modelo de datos

Sin cambios en tablas, políticas ni migraciones.

```ts
// app/auth/callback/route.ts — forma de la solución
const OTP_TYPES = ["signup", "recovery", "email"] as const;

// Solo rutas del mismo origen: evita open redirect vía ?next=
function safeNext(next: string | null, base: string) {
  if (!next) return "/";
  const url = new URL(next, base);
  return url.origin === new URL(base).origin ? url.pathname + url.search : "/";
}
```

Convenciones:

- `new URL(next, base)` ya normaliza tabulaciones, saltos de línea y `\`; por eso la comparación de origen cubre los bypass que el regex no ve.
- La redirección final usa `new URL(safeNext(...), request.url)`; al ser siempre una ruta relativa al mismo origen, no puede salir del sitio.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Route Handlers (esta versión de Next difiere de lo conocido, según `AGENTS.md`).

1. **Allowlist de `type`.** Definir `OTP_TYPES`, comprobar que `type` pertenece antes de llamar a `verifyOtp` y eliminar el cast `as EmailOtpType`. Verificación: `npx tsc --noEmit`; `/auth/callback?token_hash=x&type=invite` redirige a `/auth?error=enlace`.
2. **`safeNext` por origen.** Reemplazar el regex por la comparación de origen mostrada arriba y pasarle `request.url`. Verificación manual con `curl -i` sobre `/auth/callback?token_hash=x&type=signup&next=<valor>`, mirando que el `Location` de la redirección nunca salga del origen (ver criterios).
3. **Regresión de los flujos.** Registro con confirmación por correo, reenvío del correo y recuperación de contraseña hasta `/auth/restablecer`; comprobar que el `Location` final sigue siendo `/` o `/auth/restablecer`.
4. **Comprobación del panel (manual).** Revisar que la plantilla del correo de recuperación apunta a `/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/restablecer` y la de confirmación a `type=signup`; `resetPasswordForEmail` se llama sin `redirectTo`, así que depende de esa plantilla y de la Site URL. Anotar el resultado en el PR.
5. **Cierre.** `npx tsc --noEmit`, `npm run lint` y `npm run build` sin errores; actualizar `CLAUDE.md` si la descripción del callback cambia.

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` terminan sin errores.
- [ ] Con `next` = `/%09/evil.com`, `//evil.com`, `/\evil.com`, `https://evil.com` y `javascript:alert(1)`, la redirección va a `/` (o a `/auth?error=enlace` si el token no es válido) y nunca a otro origen.
- [ ] Con `next=/auth/restablecer` o `next=/games?x=1` (rutas internas legítimas), la redirección conserva la ruta y la query.
- [ ] `type` fuera de `signup|recovery|email` (p. ej. `invite`, `magiclink`, vacío) redirige a `/auth?error=enlace` sin llamar a `verifyOtp`.
- [ ] Confirmar correo (`signup`) y recuperar contraseña (`recovery`) siguen funcionando de punta a punta.
- [ ] Las plantillas de correo del panel usan `type=signup` y `type=recovery`, y el resultado queda anotado en el PR.

---

## Decisiones tomadas y descartadas

- **Sí:** validar por origen con `URL`. Es el mismo parser que usará la redirección, así que no hay discrepancia entre «lo que se valida» y «a dónde se va». **No:** endurecer el regex (añadir `\t`, `\n`…): lista negra frágil, un carácter olvidado reabre el bypass.
- **Sí:** devolver solo `pathname + search`. **No:** devolver `url.href`; descarta cualquier credencial (`user:pass@`) o puerto inesperado.
- **Sí:** allowlist de tres tipos. **No:** permitir todos los `EmailOtpType`; el callback solo atiende confirmación y recuperación, y cada tipo extra es superficie sin uso.
- **Sí:** dejar `username` en servidor y `ResetForm` para otra spec; son riesgo bajo y requieren cambios de esquema o de ajustes del panel. **No:** mezclarlos aquí.

---

## Riesgos identificados

| Riesgo                                                                    | Mitigación                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| La allowlist de `type` bloquea un flujo que la plantilla del panel sí usa | El paso 4 revisa las plantillas; si alguna usa `email_change` o `magiclink`, añadirlo y anotarlo |
| `new URL(next, base)` lanza con entradas no parseables                    | Con `base` válido casi nada lanza; envolver en `try/catch` devolviendo `/` si ocurre             |
| Cambiar el redirect rompe el destino `/auth/restablecer` tras `recovery`  | El paso 3 recorre el flujo completo y comprueba el `Location`                                    |

---

## Qué **no** está en esta spec

- Validación y unicidad de `username` en servidor.
- Reautenticación en `/auth/restablecer`.
- CSP, CAPTCHA, MFA, cambio de correo y borrado de cuenta.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
