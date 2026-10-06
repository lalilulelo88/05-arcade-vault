# SPEC 01 — MVP visual de Arcade Vault (5 pantallas)

> **Estado:** Implementado
> **Depende de:** ninguna
> **Fecha:** 2026-10-06
> **Objetivo:** Portar a Next.js (App Router) las 5 pantallas del prototipo en `references/templates/` con datos y sesión simulados, sin implementar ningún juego.

---

## Por qué existe esta spec

El prototipo de `references/templates/` es una SPA con React por CDN, ruteo por `location.hash` y estilos en un único `styles.css`. Esta spec lo traslada al stack real del proyecto (Next 16, React 19, Tailwind 4, TypeScript strict) conservando el diseño neón exacto, para tener la base visual sobre la que luego se construyen los juegos, la autenticación real y los puntajes reales.

---

## Alcance

**Dentro:**

- Pantalla **Biblioteca** (`/`): hero, buscador por nombre, chips de categoría, grilla de tarjetas con efecto tilt, estado vacío "NO HAY RESULTADOS".
- Pantalla **Detalle de juego** (`/juegos/[id]`): portada, tags, descripción, tira de estadísticas, ranking top 10, botones "JUGAR AHORA" y "VOLVER AL VAULT".
- Pantalla **Reproductor** (`/jugar/[id]`): HUD (jugador, puntuación, vidas, nivel), marco CRT con arena decorativa en CSS, pausa, fin de juego, modal de puntuación final con guardado.
- Pantalla **Auth** (`/auth`): pestañas "Iniciar sesión" / "Crear cuenta", formulario, "Jugar como invitado", botones sociales (solo visuales).
- Pantalla **Salón de la Fama** (`/salon`): pestañas por juego, podio top 3, tabla de 12 filas, fila "tu mejor marca" si hay sesión.
- **Nav** (con menú móvil y contador de créditos fijo "03") y **footer** comunes en `app/layout.tsx`.
- Estilos del template portados a `app/globals.css`.
- Datos mock tipados en `lib/games.ts`.
- Sesión simulada en `localStorage` (`av_user`) y guardado local de puntajes (`av_scores`).
- Reproductor simulado: el puntaje sube solo con un intervalo, igual que en el template.
- Diseño responsive (el template ya incluye menú hamburguesa).

**Fuera de alcance (para otras specs):**

- Cualquier juego real (lógica, canvas, input de teclado o táctil).
- Autenticación real: backend, base de datos, sesiones, OAuth con Google/GitHub. Los botones sociales no hacen nada.
- Validación de formularios y manejo de errores de login.
- Rankings reales: los puntajes guardados en `av_scores` **no** se mezclan con los rankings mock.
- Sistema de créditos real (el "03" es un texto fijo).
- Tests automatizados (el proyecto no tiene framework de tests).
- Internacionalización: la interfaz queda solo en español.

---

## Modelo de datos

Definido en `lib/games.ts`, portado de `data.jsx`:

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;        // slug de la URL: "bloque-buster", "caida", ...
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;     // clase CSS: "cover-bricks", "cover-tetro", ...
  color: Accent;
  best: number;
  plays: string;     // ya formateado: "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string };

export const GAMES: Game[];                 // los 8 juegos de data.jsx
export const CATS: ("TODOS" | Category)[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Sesión y puntajes locales:

```ts
// localStorage "av_user"   → { name: string } | ausente (invitado)
// localStorage "av_scores" → { game: string; score: number; name: string; at: number }[]
```

Convenciones:

- Números con `toLocaleString("es-ES")`.
- `seededScores` es determinista: mismo seed, mismas filas (evita errores de hidratación).
- `name` de usuario en mayúsculas, máximo 10 caracteres, `"PLAYER1"` si el campo está vacío.

---

## Plan de implementación

Antes del paso 1: leer la guía relevante de `node_modules/next/dist/docs/` (según `AGENTS.md`, esta versión de Next tiene cambios incompatibles; en especial `params` asíncronos, `generateStaticParams` y `notFound`).

1. **Datos.** Crear `lib/games.ts` con tipos, `GAMES`, `CATS` y `seededScores` portados de `data.jsx`. Verificación: `npm run build` compila.
2. **Estilos.** Portar `references/templates/styles.css` a `app/globals.css` (variables `--cyan`, `--magenta`, etc., clases `av-*`, `card`, `chip`, `btn`, `cover-*`). Verificar que las fuentes de `app/layout.tsx` cubren las usadas por el template (`--mono`, `.pixel`). Verificación: la app arranca sin errores de CSS.
3. **Sesión y Nav.** Crear `components/session-provider.tsx` (contexto cliente que lee `av_user` en `useEffect` y expone `user`, `login`, `signOut`) y `components/nav.tsx` (links con estado activo vía `usePathname`, contador de créditos, menú móvil). Montarlos junto al footer en `app/layout.tsx`. Verificación: el Nav se ve en todas las rutas.
4. **Biblioteca.** `app/page.tsx` más `components/game-card.tsx` y `components/library.tsx` (cliente: estado de búsqueda y categoría, tilt, estado vacío). Las tarjetas enlazan a `/juegos/[id]`.
5. **Detalle.** `app/juegos/[id]/page.tsx` (servidor, `generateStaticParams`, `notFound()` si el id no existe) con el ranking top 10 desde `seededScores`.
6. **Auth.** `app/auth/page.tsx` y `components/auth-form.tsx` (cliente): pestañas, `login({ name })`, redirección a `/`; "Jugar como invitado" limpia la sesión y redirige a `/`.
7. **Salón de la Fama.** `app/salon/page.tsx` y `components/hall-of-fame.tsx` (cliente): pestañas por juego, podio, tabla y fila "tu mejor marca" cuando hay `user`.
8. **Reproductor.** `app/jugar/[id]/page.tsx` y `components/game-player.tsx` (cliente): HUD, intervalo de puntaje, pausa, FIN, modal de fin de juego, guardado en `av_scores`, "JUGAR DE NUEVO". `SALIR` vuelve a `/juegos/[id]`.
9. **Pulido.** Metadata (`title`) por página y revisión responsive en ancho móvil.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Existen las rutas `/`, `/juegos/[id]`, `/jugar/[id]`, `/auth` y `/salon`, y cada una renderiza sin errores en la consola del navegador.
- [ ] `/` muestra 8 tarjetas; escribir "caida" en el buscador deja solo la tarjeta CAÍDA.
- [ ] Elegir el chip "PUZZLE" muestra solo juegos de categoría PUZZLE; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Hacer clic en una tarjeta o en su botón JUGAR navega a `/juegos/<id>`.
- [ ] `/juegos/inexistente` devuelve la página 404 de Next.
- [ ] `/juegos/<id>` muestra título, descripción, 3 estadísticas y 10 filas de ranking; "JUGAR AHORA" lleva a `/jugar/<id>`.
- [ ] En `/jugar/<id>` la puntuación aumenta sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la retoma.
- [ ] Al pulsar FIN aparece el modal "FIN DEL JUEGO" con la puntuación final; "GUARDAR PUNTUACIÓN" agrega una entrada en `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia puntuación, vidas y nivel (0, 3, 01).
- [ ] En `/auth`, enviar el formulario con usuario "kai" guarda `{"name":"KAI"}` en `av_user`, redirige a `/` y el Nav muestra "KAI".
- [ ] "JUGAR COMO INVITADO" redirige a `/` y el Nav muestra "Iniciar Sesión".
- [ ] La pestaña "CREAR CUENTA" muestra el campo de correo; "INICIAR SESIÓN" lo oculta.
- [ ] `/salon` muestra podio con 3 posiciones y 12 filas; cambiar de pestaña cambia las filas.
- [ ] En `/salon` la fila "TU MEJOR MARCA" aparece solo con sesión iniciada.
- [ ] Recargar la página con sesión iniciada conserva el usuario en el Nav, sin errores de hidratación en consola.
- [ ] A 375 px de ancho no hay scroll horizontal y el botón ≡ abre el menú móvil con los enlaces Biblioteca, Salón de la Fama y Cuenta.
- [ ] Visualmente, cada pantalla es equivalente a su par en `references/templates/Arcade Vault.html`.

---

## Decisiones tomadas y descartadas

- **Sí:** rutas reales del App Router. URLs compartibles, botón atrás del navegador funcional y Server Components donde no hace falta estado.
- **No:** SPA con `location.hash` como el template. Va contra el modelo de Next y no escala.
- **Sí:** portar `styles.css` a `app/globals.css` conservando clases. Garantiza fidelidad con el diseño de referencia con el menor riesgo.
- **No:** reescribir todo con utilidades Tailwind. Más trabajo y riesgo de divergir del diseño aprobado; se puede migrar luego.
- **Sí:** sesión simulada con `localStorage` (`av_user`). Mantiene el MVP visual y permite ver los estados con y sin sesión.
- **No:** autenticación real en esta spec. El usuario la eligió inicialmente, pero contradice "solamente la parte visual"; se acordó dejarla para una spec propia (backend, BD, OAuth).
- **Sí:** reproductor con puntaje simulado, igual que el template, para validar HUD, pausa y modal.
- **Sí:** `av_scores` se guarda pero no se muestra en los rankings. Evita lógica de mezcla que el template no tiene.
- **Sí:** `seededScores` determinista. Evita desajustes de hidratación entre servidor y cliente.
- **Sí:** el contenido de `references/templates/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Error de hidratación al leer `localStorage` en el primer render | `SessionProvider` lee `av_user` en `useEffect`; el Nav renderiza el estado de invitado hasta montar. |
| `localStorage` bloqueado o con JSON corrupto | Envolver lecturas y escrituras en `try/catch` y tratarlo como invitado, como hace el template. |
| Next 16 difiere de lo conocido (`params` asíncronos, convenciones) | Leer la guía en `node_modules/next/dist/docs/` antes de escribir las páginas. |
| El CSS del template depende de fuentes distintas a las de `layout.tsx` | Verificar en el paso 2 y ajustar `layout.tsx` si faltan fuentes. |
| El efecto de nivel del reproductor (`score % 2500 < 100`) puede subir varios niveles seguidos | Es comportamiento heredado del template; aceptado, ya que no hay juego real. |

---

## Qué **no** está en esta spec

- Ningún juego jugable.
- Autenticación real, base de datos o sesiones de servidor.
- Rankings reales o mezcla de `av_scores` con los rankings mock.
- Sistema de créditos.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
