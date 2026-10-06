# SPEC 06 — Leaderboard real y tabla `games` en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-10-06
> **Objetivo:** Crear las tablas `games` y `scores` en Supabase, guardar allí los puntajes del modal "GUARDAR PUNTUACIÓN" y mostrar el leaderboard real por juego en `/salon`, en lugar de los datos sembrados.

---

## Por qué existe esta spec

SPEC 04 dejó los clientes de Supabase listos pero sin tablas, y SPEC 05 hizo jugable Asteroids guardando el puntaje en `localStorage` (`av_scores`), que nadie más ve. El Salón de la Fama sigue mostrando filas inventadas por `seededScores`. Esta spec conecta ambos extremos: los puntajes se persisten en la base de datos y el Salón los lee. La autenticación sigue siendo una maqueta (`session-provider`), así que el puntaje se guarda de forma **anónima**, con las iniciales del modal.

---

## Alcance

**Dentro:**

- **Migración** (aplicada con la herramienta MCP `apply_migration`) que crea:
  - Tabla `games` con los 9 juegos actuales de `lib/games.ts` como seed (solo `id` y `title`), usada como clave foránea de `scores`.
  - Tabla `scores` con restricciones `CHECK`, índice por `(game_id, score desc)` y RLS activado.
  - Políticas RLS: `SELECT` e `INSERT` públicos en `scores` (rol `anon` y `authenticated`); `SELECT` público en `games`. Sin `UPDATE` ni `DELETE`.
- **Tipos generados** con `generate_typescript_types` en `lib/supabase/database.types.ts`, y clientes de `lib/supabase/client.ts` / `server.ts` tipados con `Database`.
- **Guardado de puntaje** en `GamePlayer`: "GUARDAR PUNTUACIÓN" inserta `{ game_id, name, score }` en `scores` con el cliente de navegador. Estados: guardando, guardado y error (con opción de reintentar). Aplica a todos los juegos, con motor o simulados.
- **Leaderboard en `/salon`**: `HallOfFame` consulta `scores` del juego de la pestaña activa (top 12 por `score desc`, desempate por `created_at asc`) con el cliente de navegador. El podio usa los 3 primeros. Estados: cargando, error, sin puntajes ("SIN PUNTAJES TODAVÍA").
- **Abandono de `av_scores`**: `GamePlayer` deja de leer y escribir `localStorage`.
- **Eliminación de lo simulado en el Salón**: se retira el uso de `seededScores` y el bloque "TU MEJOR MARCA" (ficticio) de `HallOfFame`.

**Fuera de alcance (para otras specs):**

- Autenticación real, `user_id` en `scores`, "mi mejor marca" real y RLS por usuario.
- Que Biblioteca, detalle y reproductor lean los juegos desde la tabla `games`: la UI sigue usando `lib/games.ts` (covers, colores, descripciones).
- Calcular `best` y `plays` del catálogo desde `scores`; siguen los valores fijos.
- Realtime (leaderboard en vivo) y Edge Functions.
- Prevención de trampas (validación de partidas en servidor, firma de puntajes); solo se aplican los `CHECK` de rango.
- Moderación de nombres, rate limiting y eliminación de puntajes.
- Paginación del leaderboard o filtros por fecha.
- Migrar puntajes ya existentes en `av_scores` de los navegadores.
- Carpeta `supabase/` con migraciones versionadas y Supabase CLI.
- Tests automatizados (el proyecto no tiene framework de tests).

---

## Modelo de datos

```sql
create table public.games (
  id    text primary key,          -- mismo id que lib/games.ts
  title text not null
);

create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games (id),
  name       text not null check (char_length(name) between 1 and 10),
  score      integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public"  on public.games  for select to anon, authenticated using (true);
create policy "scores_select_public" on public.scores for select to anon, authenticated using (true);
create policy "scores_insert_public" on public.scores for insert to anon, authenticated with check (true);
```

Seed de `games` (`id`, `title`): `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroids`, `ranaria`, `duelo-pixel`, con el título de `lib/games.ts`.

Tipos de la capa de UI:

```ts
// lib/supabase/database.types.ts — generado, no se edita a mano
// components/hall-of-fame.tsx
type LeaderRow = { name: string; score: number; created_at: string };
```

Convenciones:

- `scores.game_id` coincide con `Game.id` de `lib/games.ts`; agregar un juego al catálogo exige agregar su fila a `games` (queda documentado en el riesgo de duplicidad).
- El nombre se guarda tal como lo produce el modal (mayúsculas, máx. 10); el `CHECK` es la última defensa.
- La fecha del leaderboard se muestra en formato `dd/mm/aaaa` a partir de `created_at`.
- Las consultas piden solo `name, score, created_at`.
- Si la inserción falla, el modal permanece abierto con el mensaje de error; el puntaje no se pierde mientras el modal esté abierto.

---

## Plan de implementación

Antes del paso 1: leer en `node_modules/next/dist/docs/` la guía de Client Components y de manejo de datos en el cliente, y consultar con `search_docs` del MCP la inserción y consulta con `supabase-js` y RLS. Según `AGENTS.md`, esta versión de Next tiene cambios incompatibles. Aplicar `/frontend-design` en los estados nuevos de UI (guardando, error, vacío).

1. **Migración.** Con `list_tables` confirmar que `public` está vacío y aplicar la migración con `apply_migration` (tablas, índice, RLS, políticas, seed de `games`). Verificación: `list_tables` muestra `games` (9 filas) y `scores` con RLS activo; `get_advisors` (security) no reporta tablas sin RLS.
2. **Tipos.** Generar tipos con `generate_typescript_types`, guardarlos en `lib/supabase/database.types.ts` y tipar `createClient` de `client.ts` y `server.ts` con `Database`. Verificación: `npm run build` compila.
3. **Guardado desde `GamePlayer`.** Reemplazar `save()` por la inserción en `scores` con estados `idle | saving | saved | error`; botón deshabilitado mientras guarda; mensaje y reintento si falla. Quitar el acceso a `localStorage`. Verificación: guardar un puntaje en `/jugar/asteroids` crea una fila en `scores` (`execute_sql` de lectura).
4. **Leaderboard en `HallOfFame`.** Consultar `scores` por `game_id` al cambiar de pestaña (descartando respuestas obsoletas si se cambia rápido), renderizar podio y tabla con filas reales y mostrar estados cargando / error / vacío; podio parcial si hay menos de 3 filas. Eliminar `seededScores` de este componente y el bloque "TU MEJOR MARCA" con su `useSession`. Verificación: la fila guardada en el paso 3 aparece en `/salon`, pestaña ASTEROIDS.
5. **Limpieza.** Si `seededScores` y `PLAYERS` quedan sin usos en `app/`, `components/` y `lib/`, eliminarlos de `lib/games.ts`. Verificación: `grep seededScores` sin resultados.
6. **Verificación final.** `npm run lint`, `npm run build`, `get_advisors` (security) y recorrido en navegador (con Playwright MCP o a mano): jugar, guardar, ver el Salón, probar el error forzado y la pestaña sin puntajes.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `list_tables` muestra `games` y `scores` en `public`, ambas con RLS activado.
- [ ] `games` contiene exactamente los 9 ids de `lib/games.ts`.
- [ ] `get_advisors` (security) no reporta tablas sin RLS ni políticas inseguras nuevas.
- [ ] Con la clave publishable (`anon`), `UPDATE` y `DELETE` sobre `scores` no modifican filas; `INSERT` y `SELECT` funcionan.
- [ ] Un `INSERT` con `score` negativo, `score` mayor a 10 000 000, `name` vacío, `name` de más de 10 caracteres o `game_id` inexistente es rechazado por la base de datos.
- [ ] Existe `lib/supabase/database.types.ts` y ambos clientes de Supabase están tipados con `Database`.
- [ ] Tras jugar en `/jugar/asteroids` y pulsar "GUARDAR PUNTUACIÓN", existe una fila en `scores` con `game_id = 'asteroids'`, las iniciales del modal y el mismo puntaje que mostraba el HUD.
- [ ] Mientras se guarda, el botón queda deshabilitado; al terminar el modal muestra el estado "guardado" y no permite guardar dos veces la misma partida.
- [ ] Si falla la inserción (p. ej. sin red), el modal muestra un error legible y permite reintentar sin perder el puntaje.
- [ ] Un juego simulado (p. ej. `/jugar/caida`) también guarda su puntaje en `scores` con su `game_id`.
- [ ] `GamePlayer` no lee ni escribe `localStorage["av_scores"]`.
- [ ] `/salon` muestra, por pestaña, filas ordenadas por puntaje descendente con rango `#01…`, nombre, puntaje y fecha `dd/mm/aaaa`, con un máximo de 12.
- [ ] El podio muestra los 3 primeros reales; con 1 o 2 filas no rompe el layout ni muestra datos inventados.
- [ ] Una pestaña sin puntajes muestra "SIN PUNTAJES TODAVÍA"; mientras carga muestra un estado de carga; si la consulta falla muestra un error.
- [ ] Cambiar de pestaña rápidamente no deja en pantalla las filas de otro juego (se ignoran respuestas obsoletas).
- [ ] El Salón ya no muestra el bloque "TU MEJOR MARCA" ni nombres de `PLAYERS`.
- [ ] No quedan usos de `seededScores` en `app/`, `components/` ni `lib/`.
- [ ] En el repositorio no aparece ninguna clave `service_role`.
- [ ] Biblioteca (`/games`), detalle (`/juegos/[id]`) y la jugabilidad de Asteroids siguen funcionando igual que antes.
- [ ] No quedan imports ni código en `app/`, `components/` ni `lib/` que dependan de `references/`.

---

## Decisiones tomadas y descartadas

- **Sí:** tabla `games` en Supabase, solo para la clave foránea de `scores`. Decisión del usuario; con ella la integridad referencial queda garantizada por la base de datos.
- **No:** que la UI lea los juegos desde `games`. Decisión del usuario: `lib/games.ts` sigue siendo la fuente (covers, colores, descripciones). A cambio hay duplicidad de `id`/`title`, anotada como riesgo.
- **Sí:** puntaje anónimo con iniciales, sin `user_id`. Decisión del usuario; la auth sigue siendo maqueta y se resolverá en su propia spec, que añadirá `user_id` a `scores`.
- **No:** dividir en una spec de auth previa ni usar `signInAnonymously`. Se consideraron; el usuario prefirió avanzar sin sesión.
- **Sí:** `SELECT` e `INSERT` públicos con `CHECK` de rango y sin `UPDATE`/`DELETE`. Decisión del usuario. Es falseable (cualquiera puede insertar), aceptado hasta que haya auth; los `CHECK` limitan el daño.
- **No:** Server Action para insertar. Con RLS pública no añadiría protección real y suma código; se reevaluará cuando exista validación de partidas.
- **Sí:** reemplazar `seededScores` por datos reales en `/salon`, sin fallback sembrado. Decisión del usuario; un juego sin puntajes muestra estado vacío honesto.
- **Sí:** todos los juegos guardan, también los simulados, y `av_scores` se abandona. Decisión del usuario; un único flujo de guardado. Los puntajes de los simulados son aleatorios y quedarán en la tabla: se asume mientras no tengan motor.
- **Sí:** guardado en Supabase y seed de `games` dentro de esta spec. Decisión del usuario.
- **No:** Realtime ni calcular `best`/`plays` desde `scores`. Quedan como mejoras posteriores; el usuario no los incluyó.
- **Sí:** consulta desde el cliente de navegador al cambiar de pestaña. `HallOfFame` ya es un Client Component con pestañas; evita reestructurar la página y no requiere cookies ni sesión.
- **Sí:** migración aplicada con `apply_migration` sin carpeta `supabase/`. Coherente con SPEC 04, que dejó la carpeta fuera. El SQL queda documentado en esta spec; versionar migraciones en el repo es otra spec.
- **Sí:** tipos generados ahora que existen tablas (SPEC 04 los dejó pendientes por no haber tablas).
- **Sí:** el contenido de `references/` es solo referencia; no se importa desde `app/`.

---

## Riesgos identificados

| Riesgo                                                                     | Mitigación                                                                                                              |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Cualquiera puede insertar puntajes falsos o spam con la clave publishable  | Aceptado por decisión; `CHECK` de rango y longitud, sin `UPDATE`/`DELETE`; auth y validación van en specs futuras.      |
| Nombres ofensivos o inyección de HTML en el leaderboard                    | React escapa el texto al renderizar; la moderación queda fuera de alcance.                                              |
| `lib/games.ts` y la tabla `games` se desincronizan (juego nuevo sin fila)  | La inserción falla por la FK con error visible; documentado en Convenciones. Se resolverá si la UI pasa a leer `games`. |
| Puntajes aleatorios de juegos simulados contaminan el leaderboard          | Aceptado mientras no tengan motor; se pueden borrar con SQL desde el panel.                                             |
| Doble envío al pulsar varias veces "GUARDAR"                               | Estado `saving`/`saved` deshabilita el botón; criterio de aceptación.                                                   |
| Respuestas fuera de orden al cambiar de pestaña pintan filas de otro juego | Ignorar respuestas obsoletas (flag en el efecto); criterio de aceptación.                                               |
| Migración aplicada directo al proyecto remoto, sin entorno de prueba       | Inspeccionar con `list_tables` antes, revisar el SQL, y verificar con `get_advisors` y `list_tables` después.           |
| Límite de 10 000 000 rechaza un puntaje legítimo muy alto                  | Valor holgado respecto a los puntajes actuales; ajustar con una migración si hiciera falta.                             |
| Next 16 / React 19 difieren de lo conocido (efectos, Client Components)    | Leer la guía en `node_modules/next/dist/docs/` antes de escribir.                                                       |
| Pérdida de puntajes antiguos de `av_scores`                                | Aceptado; eran locales y de prueba.                                                                                     |

---

## Qué **no** está en esta spec

- Autenticación real, `user_id`, "mi mejor marca" y RLS por usuario.
- UI leyendo juegos desde `games`; `best` y `plays` calculados.
- Realtime y Edge Functions.
- Anti-trampas, moderación y rate limiting.
- Paginación, filtros y migración de `av_scores`.
- Carpeta `supabase/` y migraciones versionadas.
- Tests automatizados.

Cada uno, si se aborda, va en su propia spec.
