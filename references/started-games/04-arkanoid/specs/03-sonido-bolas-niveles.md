# SPEC 03 — Control de sonido, bolas de reserva y niveles aleatorios

> **Estado:** implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-05
> **Objetivo:** Añadir un menú de pausa con volumen ajustable (10% por defecto) y sonido activable, sustituir las vidas por una reserva de 3 bolas con explosión al perderlas y bola extra cada 2000 puntos, y encadenar niveles generados al azar al destruir todos los bloques.

## Alcance

**Dentro:**

- **Menú de pausa** (`P`) con dos opciones navegables con `↑`/`↓`: `Volumen` y `Sonido: ON/OFF`. `←`/`→` ajustan el volumen en pasos de 10% (0–100%); `←`/`→`/`Enter` alternan el sonido. `P` sigue reanudando.
- Volumen real = valor del menú × volumen original del mp3. Defecto 10%. Con `Sonido: OFF` no suena nada, sin perder el valor de volumen. Afecta a `ball-bounce.mp3` y `break-sound.mp3`.
- Volumen y estado del sonido persistidos en `localStorage` (con `try/catch`).
- **Bolas en vez de vidas:** `game.lives` pasa a `game.balls_left` (reserva), con valor inicial 3. El HUD muestra `Bolas:` con un icono de bola por cada una de la reserva (sin tope, ver Decisiones).
- La bola en juego cuenta como una de la reserva; al perderse la última bola en pantalla se descuenta 1 y, si quedan, sale la siguiente pegada a la paleta (estado `ready`). Con 0 → `gameover`. Las bolas extra de X3 no cuentan para la reserva (comportamiento de SPEC 02).
- **Explosión de pérdida:** al caer cada bola por debajo del canvas se genera una ráfaga de partículas dibujadas en canvas (~500 ms) en su posición `x` sobre el borde inferior, con `break-sound.mp3`. También explota cada bola extra de X3 que cae, pero solo la última descuenta de la reserva.
- **Bola extra por puntos:** cada 2000 puntos acumulados se suma 1 a la reserva (puntos 2000, 4000, 6000...), con aviso breve en pantalla.
- **Niveles aleatorios:** al destruir todos los bloques se pasa al nivel siguiente (sin pantalla de victoria). Cada nivel elige al azar una forma de plantilla y un tamaño, y colores al azar.
- Los efectos, cápsulas y láseres se reinician al cambiar de nivel (igual que al perder una bola); puntos y reserva se conservan.
- El HUD muestra el nivel actual y una pantalla breve `NIVEL N` al empezar cada uno (la bola queda en `ready`).

**Fuera de alcance (para otras specs):**

- Mostrar el volumen con ratón o deslizador arrastrable (solo teclado).
- Música de fondo y sonidos nuevos (se reutilizan los dos mp3).
- Dificultad progresiva (velocidad de bola, bloques más duros por nivel).
- Pantalla de victoria final o número máximo de niveles.
- Lista de récords con nombres y récord por nivel.
- Sprites nuevos (la explosión de la bola son partículas en canvas).
- Sonidos distintos por tipo de evento (bola extra, nivel superado).

## Modelo de datos

```js
const START_BALLS = 3;
const EXTRA_BALL_EVERY = 2000;          // puntos
const DEFAULT_VOLUME = 0.1;             // 10%
const VOLUME_STEP = 0.1;
const SETTINGS_KEY = 'arkanoid.settings';   // JSON { volume, muted }
const MAX_ROWS = 10;                    // 10 * 24 = 240 px, GRID_Y 60 → hasta y = 300
const PARTICLE_COUNT = 24, PARTICLE_MS = 500;
const COLORS = ['gray', 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const SHAPES = ['rect', 'pyramid', 'diamond', 'checker', 'stripes', 'frame'];

const game = {
  // ...campos de SPEC 01 y SPEC 02, salvo `lives`, que se renombra a `ballsLeft`
  ballsLeft: 3,
  level: 1,
  nextExtraAt: 2000,                    // siguiente umbral de puntos
  menuIndex: 0,                         // 0 = volumen, 1 = sonido
  particles: [ /* { x, y, vx, vy, born, color } */ ],
  banner: { text: '', until: 0 },       // avisos "NIVEL N" y "+1 BOLA"
};

const settings = { volume: 0.1, muted: false };   // cargado de SETTINGS_KEY
```

Convenciones:

- `playSound(sound)` ya existe en `game.js`: pasa a aplicar `sound.volume = settings.volume` y no reproduce si `settings.muted`.
- `generateLevel(level)` devuelve el array de bloques `{ x, y, color, hits, exploding, explodeStart }` ya usado en SPEC 01. Las plantillas trabajan sobre una rejilla de `COLS × rows`, con `rows` aleatorio entre 4 y `MAX_ROWS`; el número de bloques resultante varía según forma y tamaño.
- Cada nivel debe tener al menos 1 bloque; si la forma deja la rejilla vacía, se regenera.
- `gray` mantiene 2 golpes; `hotpink` se usa ahora como un color más con 1 golpe.
- Las partículas se eliminan al cumplirse `PARTICLE_MS` y se pintan también en `paused` (congeladas, sin avanzar).

## Plan de implementación

1. **Ajustes de sonido (solo lógica):** definir `settings`, cargarlos/guardarlos en `localStorage` con `try/catch` y aplicar volumen y silencio en `playSound`. Prueba: forzar `settings.volume` en consola cambia el volumen; `muted = true` silencia.
2. **Menú de pausa:** dibujar el menú en estado `paused` y manejar `↑`/`↓`/`←`/`→`/`Enter`, guardando en `localStorage` en cada cambio. Prueba: el volumen sube y baja en pasos de 10%, el sonido se silencia, recargar conserva los valores.
3. **Vidas → bolas:** renombrar `lives` a `ballsLeft`, mostrar `Bolas:` con iconos (con `drawSprite('ball')`) en el HUD, y descontar al perder la última bola en pantalla. Prueba: 3 bolas iniciales; al perder las 3 → `gameover`.
4. **Explosión de pérdida:** generar partículas al caer cada bola, animarlas y reproducir `break-sound.mp3`. Prueba: cada bola que cae explota en su `x`; la explosión sigue ocurriendo aunque queden bolas.
5. **Bola extra por puntos:** al sumar puntos comprobar `score >= nextExtraAt`, sumar 1 a `ballsLeft`, subir `nextExtraAt` en 2000 y mostrar `+1 BOLA`. Prueba: forzar `score = 2000` otorga 1 bola; en 4000, otra.
6. **Generador de niveles:** implementar `generateLevel` con las 6 plantillas, tamaño y colores aleatorios, y usarlo en el inicio de partida. Prueba: llamar `generateLevel` varias veces muestra formas y cantidades distintas, sin vacíos.
7. **Cambio de nivel:** cuando no quedan bloques, incrementar `level`, generar el siguiente, reiniciar efectos y dejar la bola en `ready`, con el cartel `NIVEL N` y el nivel en el HUD. `resetGame` vuelve a nivel 1, 3 bolas y `nextExtraAt = 2000`. Prueba: destruir todos los bloques pasa al nivel 2 sin pantalla de victoria.

## Criterios de aceptación

- [x] Abrir `index.html` no produce errores en la consola.
- [x] Pulsar `P` en juego abre el menú con `Volumen` y `Sonido`; `P` vuelve a jugar.
- [x] El volumen inicial es 10% y `←`/`→` lo cambian en pasos de 10%, sin salirse de 0–100%.
- [x] Con `Sonido: OFF` no suena `ball-bounce.mp3` ni `break-sound.mp3`; al volver a ON suenan con el volumen elegido.
- [x] Tras recargar la página se conservan volumen y estado del sonido; con `localStorage` bloqueado el juego funciona con los valores por defecto.
- [x] El HUD muestra 3 bolas al empezar y ya no muestra `Vidas`.
- [x] Al perder la bola se descuenta 1 de la reserva y la siguiente sale pegada a la paleta; con 0 aparece `Game over`.
- [x] Cada bola que cae genera una ráfaga de partículas de ~500 ms en su posición y suena `break-sound.mp3`.
- [x] Perder una bola extra de X3 con otras en juego no descuenta de la reserva.
- [x] Al llegar a 2000 puntos se suma 1 bola y aparece `+1 BOLA`; vuelve a ocurrir a los 4000.
- [x] Destruir todos los bloques lleva al nivel 2 con el cartel `NIVEL 2` y la bola en `ready`, sin pantalla de victoria.
- [x] Puntos y bolas en reserva se conservan al cambiar de nivel; efectos, cápsulas y láseres se limpian.
- [x] Dos niveles consecutivos no son siempre iguales: la forma, el número de bloques y los colores varían.
- [x] Ningún nivel generado está vacío ni tiene bloques fuera del área `y ≤ 300`.
- [x] El HUD muestra el nivel actual.
- [x] `Espacio` o `Enter` en `gameover` reinicia en nivel 1 con 3 bolas y 0 puntos.

## Decisiones

- **Sí:** menú de pausa solo con teclado (`↑`/`↓`/`←`/`→`), como pidió el usuario. **No:** deslizador con ratón, por mantener la decisión de SPEC 01.
- **Sí:** volumen defecto 10% sobre el volumen original del mp3, persistido en `localStorage`. **No:** volver al 10% en cada recarga.
- **Sí:** reserva de 3 bolas como contador, mostrada con iconos. **No:** 3 bolas simultáneas, que solapa con X3 y cambia la jugabilidad.
- **Sí:** bola extra cada 2000 puntos y sin tope, según el usuario. **No:** umbrales distintos ni máximo en la reserva. El HUD debe seguir legible con muchas bolas (pasar a `×N` si no caben).
- **Sí:** explosión con partículas en canvas. **No:** reutilizar `EXPLOSION_FRAMES`, pensadas para bloques; **No:** sprites nuevos.
- **Sí:** niveles por plantilla (`rect`, `pyramid`, `diamond`, `checker`, `stripes`, `frame`) con tamaño y colores aleatorios. **No:** ruido puro, que da formas poco reconocibles.
- **Sí:** niveles infinitos, sin pantalla de victoria. **No:** nivel final, porque el usuario pidió generación aleatoria continua.
- **Sí:** conservar puntos y reserva entre niveles, y reiniciar efectos y cápsulas (igual que al perder una bola, SPEC 02).
- **Sí:** misma velocidad de bola en todos los niveles. **No:** dificultad progresiva (otra spec).
- **Sí:** `hotpink` entra como color de bloque, ya que SPEC 01 lo dejó sin usar solo por falta de filas.
- **Sí:** scripts clásicos y todo en `game.js`, como en SPEC 01 y 02.

## Riesgos

| Riesgo                                                                     | Mitigación                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Una forma deja el nivel con muy pocos bloques o con ninguno                | Mínimo de 1 bloque garantizado; regenerar si queda vacío. Tamaño mínimo de 4 filas.              |
| Reserva sin tope desborda el HUD                                           | Mostrar iconos hasta un máximo visible y `×N` a partir de ahí.                                   |
| `Audio.volume` ignorado en algunos navegadores móviles                     | Fuera de alcance (solo escritorio); se aplica en cada clon dentro de `playSound`.                |
| `localStorage` corrupto o bloqueado                                        | `try/catch` y `Number.isFinite`; si falla, volumen 10% y sonido ON solo en memoria.              |
| Renombrar `lives` a `ballsLeft` deja referencias olvidadas                 | El paso 3 busca todos los usos antes de renombrar y se prueba la partida completa.               |
| Bola extra repetida si se suma mucha puntuación de golpe (varios umbrales) | Usar `while (score >= nextExtraAt)` para otorgar todas las bolas pendientes.                     |

## Qué **no** entra en esta spec

- Control con ratón o táctil.
- Música de fondo y sonidos nuevos.
- Dificultad progresiva por nivel.
- Pantalla de victoria final o límite de niveles.
- Lista de récords con nombres.

Cada uno de estos puntos, si llega, va en su propia spec.
