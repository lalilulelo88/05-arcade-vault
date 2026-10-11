# SPEC 22 — Medidas de seguridad básicas (RLS, Auth y headers)

> **Estado:** Implementado
> **Depende de:** SPEC 04 (Supabase y `next.config.ts`), SPEC 06 (tabla `scores` y sus políticas) y SPEC 21 (Auth real)
> **Fecha:** 2026-10-11
> **Objetivo:** Cerrar los puntos de `references/security/security-checklist.md` (RLS, política de contraseñas, protección anti-bot, funciones `SECURITY DEFINER` y headers HTTP) hasta que `get_advisors` de seguridad no reporte warnings aplicables.

---

## Por qué existe esta spec

El linter de Supabase (2026-10-11) reporta 4 warnings de seguridad y `next.config.ts` no define headers. Una auditoría previa muestra el estado real:

- `games` y `scores` **ya tienen RLS habilitado**. Políticas actuales: `games_select_public` (SELECT), `scores_select_public` (SELECT) y `scores_insert_public` (INSERT, `WITH CHECK (true)`, roles `anon` y `authenticated`).
- `scores` **ya tiene** `CHECK` de `name` (1–10 caracteres) y `score` (0–10 000 000) y FK `game_id → games.id`. El warning `rls_policy_always_true` es por la política, no por falta de validación en la tabla; acotar el `WITH CHECK` es defensa en profundidad y silencia el linter.
- `public.rls_auto_enable()` es un event trigger `SECURITY DEFINER` que Postgres dispara solo; hoy además es invocable vía `/rest/v1/rpc/rls_auto_enable` por `anon` y `authenticated`.

### Prerrequisitos manuales (panel de Supabase, fuera del código)

1. **Auth → Policies / Sign In-Up → Password:** longitud mínima = 8.
2. **Auth → Policies → Prevent use of leaked passwords:** activar (HaveIBeenPwned). **Requiere plan Pro**; en plan Free queda marcado «no aplicable» (ver Decisiones).
3. **Auth → Rate Limits:** «Rate limit for sign-ups and sign-ins» (por IP) con un valor bajo, p. ej. 10 por hora. Anotar el valor elegido en el PR.

---

## Alcance

**Dentro:**

- Migración `supabase/migrations`-equivalente aplicada con `apply_migration` que:
  - reemplaza `scores_insert_public` por una política con `WITH CHECK` acotado (juego existente en `games`, `name` no vacío tras `trim` y ≤ 10 caracteres, `score` entre 0 y 10 000 000), manteniendo insert para `anon` y `authenticated` (modo invitado);
  - hace `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated`.
- Headers de seguridad en `next.config.ts` para todas las rutas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva y `Strict-Transport-Security`.
- Validación en cliente de la contraseña ≥ 8 caracteres: ya existe (SPEC 21); solo se verifica que coincide con el mínimo del panel.
- Documentar en `CLAUDE.md` las políticas RLS vigentes, los headers y los ajustes de Auth del panel.

**Fuera (otras specs):**

- `Content-Security-Policy` (requiere nonces para los scripts inline de Next y pruebas con Supabase, Resend y los juegos).
- Rate limiting propio del insert de `scores` (anti-spam de puntajes) y validación de puntajes en servidor (anti-trampas).
- `scores.user_id` y RLS ligada al usuario; exigir login para guardar puntaje.
- RLS para tablas futuras (el trigger `rls_auto_enable` ya las habilita al crearse).
- CAPTCHA en registro (Turnstile/hCaptcha).
- MFA, cambio de correo y borrado de cuenta.
- Tests automatizados (no hay framework configurado).

---

## Modelo de datos

No hay tablas ni columnas nuevas. Solo cambian una política y un privilegio.

```sql
-- Política resultante (nombre nuevo para distinguirla de la abierta)
create policy scores_insert_validated on public.scores
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.games g where g.id = game_id)
    and char_length(btrim(name)) between 1 and 10
    and score between 0 and 10000000
  );

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

```ts
// next.config.ts — forma de los headers
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];
// headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

Convenciones:

- Los valores del bloque son los de partida; el paso 3 confirma que `Permissions-Policy` no bloquea nada que use la app (los juegos usan teclado, touch y canvas; ninguno usa cámara, micrófono ni geolocalización).
- `Strict-Transport-Security` solo tiene efecto sobre HTTPS; en `http://localhost:3000` el navegador lo ignora.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de `headers` de `next.config` (esta versión de Next difiere de lo conocido, según `AGENTS.md`) y ejecutar `get_advisors` (tipo `security`) para guardar la línea base.

1. **Migración de `scores` y `rls_auto_enable`.** Aplicar con `apply_migration` (`security_scores_insert_y_revoke_rls_auto_enable`): `drop policy scores_insert_public`, `create policy scores_insert_validated` y el `revoke`. Verificación: `get_advisors` ya no lista `rls_policy_always_true` ni los dos `*_security_definer_function_executable`; una inserción válida con la anon key funciona y una con `name` de 11 caracteres, `score` negativo o `game_id` inexistente es rechazada.
2. **Headers de seguridad.** Añadir `securityHeaders` y `headers()` a `next.config.ts`, conservando `allowedDevOrigins`. Verificación: `npm run build`; `curl -I http://localhost:3000/` muestra los 5 headers en `/`, `/games`, `/jugar/<id>` y `/auth`.
3. **Regresión de la app con los headers.** Recorrido manual: jugar un juego con motor, guardar puntaje, registrarse/iniciar sesión, enviar el formulario de `/about`. Si `Permissions-Policy` o `X-Frame-Options` rompe algo, ajustar el header concreto y anotarlo en Decisiones.
4. **Ajustes de Auth del panel.** Aplicar los prerrequisitos manuales 1–3 y registrar los valores. Verificación: `signUp` con una contraseña de 7 caracteres es rechazada por Supabase (no solo por el cliente); si hay plan Pro, una contraseña filtrada conocida (`password123`) es rechazada.
5. **Documentación.** Actualizar `CLAUDE.md` (sección «Sesión y Supabase»: políticas RLS de `scores`, headers en `next.config.ts`, ajustes de Auth). Ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run build` y repetir `get_advisors`.

---

## Criterios de aceptación

- [ ] `npx tsc --noEmit`, `npm run lint` (sin errores en el código de la app) y `npm run build` terminan sin errores.
- [ ] `list_tables` muestra `rls_enabled: true` en `games` y `scores`.
- [ ] `get_advisors` (seguridad) no reporta `rls_policy_always_true` en `public.scores`.
- [ ] `get_advisors` no reporta `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para `public.rls_auto_enable`.
- [ ] `POST /rest/v1/rpc/rls_auto_enable` con la anon key responde 401/403/404, no ejecuta la función.
- [ ] Insertar en `scores` con la anon key un puntaje válido (`game_id` existente, `name` 1–10 caracteres, `score` 0–10 000 000) funciona; desde `/jugar/[id]` como invitado sigue guardándose y apareciendo en el leaderboard.
- [ ] Insertar con `game_id` inexistente, `name` vacío o solo espacios, `name` de 11 caracteres, `score` negativo o `score` > 10 000 000 es rechazado.
- [ ] `UPDATE` y `DELETE` sobre `scores` con la anon key siguen sin afectar filas (no hay política).
- [ ] `curl -I` a `/`, `/games`, `/juegos/[id]`, `/jugar/[id]`, `/salon`, `/about` y `/auth` devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` y `Strict-Transport-Security`.
- [ ] Con los headers activos, un juego con motor carga y se juega, se guarda un puntaje, el login/registro funciona y el formulario de `/about` envía.
- [ ] Supabase Auth rechaza una contraseña de 7 caracteres enviada directamente a la API (longitud mínima = 8 en el panel).
- [ ] El panel de Supabase tiene el límite de signups/sign-ins por IP configurado y el valor queda anotado en el PR.
- [ ] Leaked password protection está activa **o** el PR indica explícitamente que el plan Free no la ofrece (único warning que puede quedar abierto: `auth_leaked_password_protection`).
- [ ] No aparece `service_role` en el repo y `CLAUDE.md` documenta las políticas, los headers y los ajustes de Auth.

---

## Decisiones tomadas y descartadas

- **Sí:** acotar el `WITH CHECK` de `scores` manteniendo insert para `anon`. Preserva el modo invitado (SPEC 21) y silencia el linter. **No:** exigir login para insertar; rompe el modo invitado y merece su propia spec.
- **Sí:** reconocer que los `CHECK` de la tabla ya cubren `name` y `score`, y que la política duplica esa validación a propósito (defensa en profundidad). **No:** presentarla como la única barrera.
- **Sí:** `REVOKE EXECUTE` sobre `rls_auto_enable`. El event trigger lo dispara Postgres sin necesitar privilegio de `anon`, así que la protección automática de RLS en tablas nuevas se conserva. **No:** eliminar la función ni moverla de schema.
- **Sí:** los 3 headers del checklist más `Permissions-Policy` y `Strict-Transport-Security`; riesgo bajo de romper la app. **No:** `Content-Security-Policy`: requiere nonces y pruebas con Supabase, Resend y los juegos, y se hace en otra spec.
- **Sí:** ajustes de Auth del panel como prerrequisitos manuales con criterios verificables, igual que la SPEC 21. **No:** intentar configurarlos desde código; no existen en el repo.
- **Sí:** leaked password protection se acepta como «no aplicable» en plan Free, sin bloquear la spec. **No:** subir de plan solo por esto.
- **Sí:** el límite de signups por IP se hace con el rate limit nativo de Supabase Auth. **No:** rate limiting propio en Next ni CAPTCHA; son más piezas para el mismo objetivo.

---

## Riesgos identificados

| Riesgo                                                                          | Mitigación                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` o `Permissions-Policy` rompe alguna función             | Paso 3 de regresión manual; ajustar solo el header afectado y documentarlo                        |
| HSTS con `includeSubDomains` fuerza HTTPS en subdominios que no lo soporten     | El dominio de producción aún no existe; si hay subdominios HTTP, quitar `includeSubDomains`       |
| Un `WITH CHECK` mal escrito bloquea el guardado de puntajes (regresión visible) | La verificación del paso 1 incluye una inserción válida y el guardado real desde `/jugar/[id]`    |
| El revoke afecta al trigger de eventos                                          | Verificar creando y borrando una tabla de prueba en `public`: debe quedar con RLS habilitado      |
| El límite de signups por IP bloquea a usuarios legítimos tras un NAT compartido | Valor moderado (≥ 10/h) y anotado en el PR; ajustable en el panel sin tocar código                |
| Spam de puntajes válidos sigue posible con insert anónimo                       | Riesgo aceptado y documentado; se resuelve con `scores.user_id` o validación en servidor (futuro) |

---

## Qué **no** está en esta spec

- `Content-Security-Policy`.
- Rate limiting o anti-trampas del insert de `scores`.
- `scores.user_id`, RLS ligada al usuario y login obligatorio.
- CAPTCHA, MFA, cambio de correo y borrado de cuenta.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
