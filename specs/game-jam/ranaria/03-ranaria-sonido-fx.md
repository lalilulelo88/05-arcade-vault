# SPEC — RANARIA: sonido con Web Audio, animación de muerte y silencio persistente

> **Estado:** Borrador
> **Depende de:** 01-ranaria-core
> **Fecha:** 2026-10-10
> **Objetivo:** Dar feedback sonoro y visual a RANARIA (saltos, splash, atropello, nenúfares) con sonidos sintetizados y un control de silencio que persiste.

## Scope

**In:**

- Módulo `lib/engines/ranaria-audio.ts` con `createRanariaAudio()` que devuelve `{ play(name), setMuted(m), destroy() }`, usando `AudioContext` y osciladores (sin archivos de audio).
- Efectos: `hop` (blip corto agudo), `splash` (ruido filtrado descendente), `squash` (golpe grave corto), `pad` (arpegio ascendente de 3 notas), `levelup` (arpegio de 5 notas), `gameover` (3 notas descendentes), `tick` (cuando quedan <= 5 s, 1 por segundo).
- El `AudioContext` se crea o reanuda en la primera pulsación de tecla del juego (política de autoplay).
- Silencio: tecla `M` dentro del motor alterna silencio (se ignora en `<input>/<textarea>`); el estado se guarda en `localStorage` clave `av_ranaria_muted` y se lee al iniciar. Indicador `SONIDO ON/OFF` pequeño en una esquina del canvas durante 1.5 s tras alternar.
- Animación de muerte (ya hay 600 ms de pausa en el core): vehículo = rana aplastada que se aplana; agua = tres anillos concéntricos que se expanden y desvanecen; tiempo = rana parpadeando. Duración 600 ms con `dt`.
- Partículas simples (8 círculos) al ocupar un nenúfar.
- Transición de nivel: banner `NIVEL N` en el canvas durante 1 s (congela obstáculos solo durante el banner).
- `destroy()` del motor cierra el `AudioContext` y retira el listener de `M`.

**Fuera de alcance:**

- Música de fondo.
- Archivos de audio externos, librerías de sonido o ajuste de volumen.
- Selector de skins o temas visuales.
- Controles táctiles/mobile.
- Supabase Auth/RLS y Realtime en el leaderboard.
- Cambios en `GamePlayer` y en la base de datos.

## Data model

Sin SQL. Interfaces:

```ts
// lib/engines/ranaria-audio.ts
export type Sfx =
  "hop" | "splash" | "squash" | "pad" | "levelup" | "gameover" | "tick";
export type RanariaAudio = {
  play: (name: Sfx) => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  destroy: () => void;
};
export function createRanariaAudio(): RanariaAudio;

// localStorage: av_ranaria_muted = "1" | "0"
```

El motor `lib/engines/ranaria.ts` crea el audio al arrancar y lo destruye en `destroy()`.

## Implementation plan

1. **Módulo de audio.** Crear `ranaria-audio.ts` con los 7 efectos y manejo de `AudioContext` perezoso; fallar en silencio si no existe `AudioContext`. Verificación: `npm run build` y `npm run lint`.
2. **Integración en el motor.** Llamar a `play` en salto, muerte (según causa), nenúfar, nivel y game over; `tick` por segundo restante usando el reloj de `dt`. Verificación: se oye cada evento en `/jugar/ranaria`.
3. **Silencio persistente.** Tecla `M`, lectura/escritura de `localStorage` (con `try/catch`) e indicador. Verificación: recargar conserva el estado.
4. **Animaciones.** Muerte por causa, partículas de nenúfar y banner de nivel, todo con `dt`. Verificación visual y que PAUSA los congela.
5. **Limpieza.** `destroy()` cierra el audio y retira listeners. Verificación: salir de la página y volver no duplica sonidos (StrictMode incluido).
6. **Verificación final.** `npm run lint`, `npm run build`, `npx tsc --noEmit`, partida completa.

## Acceptance criteria

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] No hay sonido hasta la primera tecla pulsada y no hay errores de autoplay en consola.
- [ ] Cada evento (salto, agua, atropello, nenúfar, nivel, game over, últimos 5 s) reproduce su sonido una sola vez.
- [ ] `M` alterna el silencio, muestra el indicador y se ignora al escribir en el campo de iniciales.
- [ ] Tras recargar, el estado de silencio se conserva; si `localStorage` falla el juego sigue funcionando.
- [ ] La animación de muerte distingue vehículo, agua y tiempo y dura 600 ms.
- [ ] Ocupar un nenúfar lanza partículas; subir de nivel muestra el banner `NIVEL N` 1 s.
- [ ] PAUSA congela animaciones y no deja sonidos en cola; REANUDAR continúa sin ráfagas.
- [ ] "JUGAR DE NUEVO" y salir de la página no dejan `AudioContext`, loops ni listeners activos.
- [ ] Con sonido en silencio el juego se comporta igual que en la spec 01.
- [ ] No se añade ninguna dependencia ni archivo de audio.

## Decisions

- **Sí: Web Audio con osciladores** — Razón: cero assets y cero dependencias. **No:** `<audio>` con archivos ni librerías (Howler, etc.).
- **Sí: módulo de audio separado** — Razón: el motor no crece y el audio se puede reutilizar. **No:** meter todo en `ranaria.ts`.
- **Sí: silencio en `localStorage` con `av_ranaria_muted`** — Razón: preferencia local simple y por juego. **No:** guardarlo en Supabase (fuera de alcance, sin Auth).
- **Sí: tecla `M` en el motor** — Razón: `GamePlayer` no tiene control de sonido y no se modifica. **No:** botón nuevo en la plataforma.
- **Sí: animaciones con `dt`** — Razón: la pausa las congela. **No:** CSS ni `setTimeout`.
- **Sí: sin música** — Razón: mantener el alcance acotado; los efectos bastan. **No:** loop musical (otra spec).
- **Sí: mismas 3 vidas del core** — Razón: esta spec no cambia reglas.
