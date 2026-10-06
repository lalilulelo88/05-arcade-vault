# SPEC 03 — Página "Acerca de" y formulario de contacto con Resend

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-06
> **Objetivo:** Implementar en `/about` la página "Acerca de" del template `references/templates/home-about/about.jsx` y hacer que su formulario de contacto envíe un correo real al equipo mediante Resend.

---

## Por qué existe esta spec

La spec 02 dejó "Acerca de" fuera de alcance y sin enlace en el nav para no publicar un enlace roto. El template `references/templates/home-about/` incluye la página completa (misión, highlights, divisor y formulario de contacto). El formulario del template solo simula el envío (`setSent(...)`); esta spec lo conecta a un servicio real. Es la primera funcionalidad con código de servidor y secretos del proyecto, por eso se documentan las variables de entorno y las decisiones de seguridad.

---

## Alcance

**Dentro:**

- Nueva página `/about` (`app/about/page.tsx`, Server Component) con las secciones del template:
  - **Hero "ACERCA DE"**: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", párrafo de misión y 3 highlights con icono pixel (HEART, BROWSER, PLANT).
  - **Divisor animado** (`.about-divider`, decorativo, `aria-hidden`) con 24 píxeles.
  - **Contacto**: kicker "▸ CONTACTO", título "CONTÁCTANOS", subtítulo, 3 tips con LED ("RESPUESTA EN 24-48H", "SUGERENCIAS BIENVENIDAS", "SIN SPAM, JAMÁS") y formulario (NOMBRE, CORREO ELECTRÓNICO, MENSAJE, botón "▶ ENVIAR MENSAJE").
  - **Estado de éxito** con terminal "VAULT-OS // TERMINAL", mensaje "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}." y botón "ENVIAR OTRO MENSAJE".
- Animación de entrada por scroll reutilizando `components/home/reveal-observer.tsx` (spec 02).
- **Envío real con Resend** mediante una Server Action: un único correo al equipo, con `reply-to` = correo del visitante.
- Validación en el servidor (campos obligatorios, formato de correo, longitudes máximas) y campo **honeypot** anti-bots.
- Estados del formulario: normal, enviando (botón deshabilitado "ENVIANDO…"), éxito (terminal), error de validación (animación `shake` del template) y **error de envío** (mensaje visible sobre el formulario; se conservan los valores escritos).
- Nav (escritorio y panel móvil): agregar enlace **"Acerca de"** (→ `/about`), activo cuando `pathname === "/about"`.
- Portar a `app/globals.css` los estilos de `about-*`, `highlight*`, `hl-*`, `contact-*`, `tip*`, `field`, `terminal-success`, `term-*`, `shake` y `caret` desde `references/templates/home-about/styles.css`, sin duplicar los que ya existen.
- Variables de entorno documentadas en `.env.example` (el `.env.local` real no se versiona).
- Metadata (`title`) de `/about`.

**Fuera de alcance (para otras specs):**

- Correo de confirmación al visitante. Con el sandbox de Resend solo se puede enviar al correo del propietario de la cuenta; se aborda cuando exista un dominio verificado.
- Dominio propio verificado en Resend (el remitente queda configurable por variable de entorno).
- Rate limit por IP o CAPTCHA (en serverless no es fiable sin Redis/KV).
- Guardar los mensajes en base de datos o panel de administración.
- Plantillas HTML de correo (react-email); el correo es de texto plano.
- Adjuntos y múltiples destinatarios.
- Enlace "Acerca de" en el footer.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

No hay persistencia nueva: el mensaje se envía y no se guarda. Estructuras nuevas, en `lib/contact.ts`:

```ts
export type ContactInput = { name: string; email: string; msg: string };

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "validation" | "send"; fields?: (keyof ContactInput)[] };

export const CONTACT_LIMITS = { name: 60, email: 120, msg: 2000 } as const;
export function validateContact(input: ContactInput): (keyof ContactInput)[]; // campos inválidos
```

Variables de entorno (solo servidor, nunca `NEXT_PUBLIC_*`):

```
RESEND_API_KEY=       # clave de Resend
CONTACT_TO_EMAIL=     # destinatario del equipo (en sandbox: el correo de la cuenta de Resend)
RESEND_FROM=          # opcional; por defecto "Arcade Vault <onboarding@resend.dev>"
```

Convenciones:

- Los tres campos se recortan con `trim()` antes de validar.
- Formato de correo: expresión simple `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- Asunto: `[Arcade Vault] Mensaje de {name}`, con saltos de línea eliminados del nombre.
- Cuerpo en texto plano (`text`), nunca HTML, para no inyectar contenido del visitante.
- Honeypot: campo oculto `website`; si llega con valor, la acción responde `{ ok: true }` sin enviar nada.
- El nombre mostrado en el terminal de éxito va en mayúsculas, como en el template.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Server Actions / `'use server'` y de formularios (`useActionState`), y la de variables de entorno. Según `AGENTS.md`, esta versión de Next tiene cambios incompatibles.

1. **Dependencia y entorno.** `npm install resend`; crear `.env.example` con las tres variables. Verificación: `npm run build` compila.
2. **Lógica de contacto.** Crear `lib/contact.ts` con tipos, `CONTACT_LIMITS` y `validateContact`. Verificación: `npm run build` compila.
3. **Server Action.** Crear `app/about/actions.ts` (`'use server'`) con `sendContact`: honeypot, `validateContact`, comprobación de variables de entorno, `resend.emails.send({ from, to, replyTo, subject, text })`, y `try/catch` que devuelve `{ ok: false, error: "send" }` y registra el error en el servidor sin exponer detalles al cliente. Verificación: con claves reales, invocar la acción envía un correo al buzón configurado.
4. **Estilos.** Portar los estilos de About/Contacto a `app/globals.css`, reutilizando variables y utilidades existentes (`btn`, `pixel`, `neon-*`, `fade-in`, `reveal`). Verificación: sin errores de CSS al arrancar.
5. **Presentación.** Crear `components/about/highlight-icon.tsx` (SVG HEART, BROWSER, PLANT, Server Component) y `app/about/page.tsx` con hero, highlights, divisor y la sección de contacto, más `<RevealObserver />`. El formulario aún es un marcador. Exportar `metadata.title`. Verificación: `/about` renderiza hero, highlights y divisor.
6. **Formulario.** Crear `components/about/contact-form.tsx` (cliente, `useActionState`) con los tres campos, honeypot oculto, estados enviando / éxito / error de validación (`shake`) / error de envío, terminal de éxito y "ENVIAR OTRO MENSAJE" (restablece el estado). Montarlo en `/about`. Verificación: enviar un mensaje válido muestra el terminal y llega el correo.
7. **Nav.** Agregar "Acerca de" (→ `/about`) en escritorio y panel móvil con estado activo por `pathname`. Verificación: el nav marca "Acerca de" en `/about` y ninguna otra sección.
8. **Pulido.** Revisión responsive a 375 px, `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/about` renderiza hero, 3 highlights, divisor y formulario, sin errores en la consola del navegador.
- [ ] El nav muestra "Acerca de" en escritorio y en el panel móvil; está activo solo en `/about`.
- [ ] Enviar el formulario vacío, o con un correo sin formato válido, no llama a Resend y dispara la animación `shake` en el formulario.
- [ ] Con `RESEND_API_KEY` y `CONTACT_TO_EMAIL` válidos, enviar nombre "kai", correo válido y un mensaje muestra el terminal "MENSAJE RECIBIDO… GRACIAS, KAI." y llega un correo a `CONTACT_TO_EMAIL`.
- [ ] El correo recibido tiene asunto `[Arcade Vault] Mensaje de kai`, incluye nombre, correo y mensaje en texto plano, y al pulsar "Responder" el destinatario es el correo del visitante.
- [ ] Si Resend falla (p. ej. `RESEND_API_KEY` inválida), se muestra un mensaje de error sobre el formulario, los campos conservan lo escrito y no aparece el terminal de éxito.
- [ ] Sin `RESEND_API_KEY` o sin `CONTACT_TO_EMAIL` definidos, la acción devuelve error de envío (no lanza excepción) y la página sigue funcionando.
- [ ] Con el campo honeypot `website` relleno, la acción responde éxito y no se envía ningún correo.
- [ ] Un nombre de más de 60 caracteres, un correo de más de 120 o un mensaje de más de 2000 son rechazados por el servidor, aunque se salte la validación del cliente.
- [ ] Mientras se envía, el botón muestra "ENVIANDO…" y está deshabilitado (no se puede enviar dos veces).
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] `RESEND_API_KEY` no aparece en el bundle del cliente (ninguna variable con prefijo `NEXT_PUBLIC_`) y `.env.local` no está en git.
- [ ] Las secciones con `.reveal` aparecen al hacer scroll; con `prefers-reduced-motion: reduce` están visibles desde el inicio.
- [ ] A 375 px de ancho no hay scroll horizontal en `/about`.
- [ ] Los campos tienen `<label>` asociado y el formulario es navegable con teclado.
- [ ] Visualmente, `/about` es equivalente a la pantalla "Acerca de" de `references/templates/home-about/arcade-vault-standalone.html`.
- [ ] No quedan imports ni código en `app/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** Server Action para el envío. La API key queda solo en el servidor y no hay endpoint público que mantener.
- **No:** Route Handler `POST /api/contact`. Más código y una URL pública expuesta sin beneficio para un único formulario.
- **Sí:** sandbox de Resend (`onboarding@resend.dev`) con destinatario en `CONTACT_TO_EMAIL`. No exige dominio ahora; pasar a dominio propio es solo cambiar variables de entorno.
- **No:** dominio propio verificado en esta spec. El usuario no lo tiene configurado.
- **Sí:** un solo correo al equipo con `reply-to` del visitante. Permite responder directo desde el cliente de correo.
- **No:** correo de confirmación al visitante. Decisión del usuario: con el sandbox solo se puede enviar al propietario de la cuenta, por lo que no funcionaría; se difiere hasta tener dominio verificado.
- **Sí:** validación en el servidor más honeypot. El cliente no es de fiar y el honeypot filtra bots básicos sin fricción para personas.
- **No:** rate limit por IP ni CAPTCHA. Un límite en memoria no es fiable en serverless; requiere Redis/KV y va en otra spec.
- **Sí:** correo en texto plano. Evita inyección de HTML con contenido controlado por el visitante.
- **Sí:** mostrar error de envío conservando los valores escritos. El template no lo contempla, pero con un servicio real puede fallar.
- **Sí:** agregar "Acerca de" al nav, como en `nav.jsx`. La spec 02 lo había pospuesto hasta tener la página.
- **Sí:** página `/about` como Server Component; solo el formulario y `RevealObserver` son cliente.
- **Sí:** portar CSS a `app/globals.css` conservando clases, igual que las specs 01 y 02.
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El sandbox de Resend solo entrega al correo de la cuenta; si `CONTACT_TO_EMAIL` es otro, el envío falla | Documentarlo en `.env.example`; el error de envío se muestra al usuario y se registra en el servidor. |
| Filtración de `RESEND_API_KEY` | Variable sin prefijo `NEXT_PUBLIC_`, solo leída en `app/about/actions.ts`; `.env*` ya está en `.gitignore`; solo se versiona `.env.example`. |
| Spam o abuso del formulario | Honeypot y límites de longitud; sin rate limit (queda explícito como fuera de alcance). |
| Inyección de cabeceras o HTML vía nombre/mensaje | Asunto sin saltos de línea, cuerpo en texto plano. |
| Doble envío por clics repetidos | Botón deshabilitado mientras la acción está pendiente. |
| Next 16 difiere de lo conocido (Server Actions, `useActionState`, env) | Leer la guía en `node_modules/next/dist/docs/` antes de escribir. |
| Colisión de nombres CSS (`field`, `shake`, `btn`) con estilos existentes | Revisar duplicados al portar los estilos en el paso 4. |

---

## Qué **no** está en esta spec

- Correo de confirmación al visitante.
- Dominio propio verificado en Resend.
- Rate limit, CAPTCHA o moderación.
- Almacenamiento de mensajes o panel de administración.
- Correos HTML con plantillas.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
