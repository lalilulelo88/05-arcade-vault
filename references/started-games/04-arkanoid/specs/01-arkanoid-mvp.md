# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** implementada
> **Depende de:** ninguna
> **Fecha:** 2026-10-05
> **Objetivo:** Un Arkanoid jugable en un canvas de 800x600 con un nivel fijo de 10x6 bloques, vidas, puntuación, récord guardado, sonidos y pantallas de inicio, game over y victoria.

## Alcance

**Dentro:**

- `index.html`, `style.css` y `game.js` en la raíz del proyecto (el spritesheet se carga con ruta relativa, así que la página debe estar en la raíz).
- Un `<canvas>` de exactamente 800x600 píxeles.
- Paleta controlada solo con teclado: flechas izquierda/derecha o A/D.
- Una bola con velocidad constante y rebote contra paredes, techo, paleta y bloques.
- Un nivel fijo: parrilla de 10 columnas x 6 filas con bloques de 64x24.
- Bloques `gray` de 2 golpes; el resto, 1 golpe.
- 3 vidas, puntuación en pantalla y pausa con `P`.
- Pantallas de inicio, game over y victoria.
- Animación de explosión al destruir un bloque (`EXPLOSION_FRAMES` / `EXPLOSION_DURATION`).
- Sonidos `ball-bounce.mp3` y `break-sound.mp3`.
- Récord (mejor puntuación) persistido en `localStorage`.

**Fuera de alcance (para otras specs):**

- Varios niveles o selección de nivel.
- Power-ups, bolas múltiples, láser.
- Control con ratón o táctil.
- Lista de mejores puntuaciones con nombres (solo un récord numérico).
- Aceleración progresiva de la bola.
- Bloques indestructibles y bloques con hotpink (el color queda sin usar en el MVP).
- Música de fondo y ajustes de volumen.

## Modelo de datos

```js
const W = 800, H = 600;
const COLS = 10, ROWS = 6;
const BLOCK_W = 64, BLOCK_H = 24;
const GRID_X = 80, GRID_Y = 60;         // 10 * 64 = 640 → margen lateral de 80
const BALL_SPEED = 360;                 // px/s, constante
const MAX_BOUNCE_ANGLE = Math.PI / 3;   // 60° desde la vertical
const POINTS_PER_HIT = 10;
const HIGHSCORE_KEY = 'arkanoid.highscore';
const ROW_COLORS = ['gray', 'red', 'yellow', 'cyan', 'magenta', 'green']; // de arriba abajo

const game = {
  state: 'start',        // 'start' | 'ready' | 'playing' | 'paused' | 'gameover' | 'won'
  score: 0,
  highScore: 0,          // entero leído de localStorage
  lives: 3,
  paddle: { x, y, w, h, speed },
  ball: { x, y, vx, vy, r },
  blocks: [ /* { x, y, color, hits, exploding, explodeStart } */ ],
};
```

Convenciones:

- Origen de coordenadas arriba a la izquierda.
- Velocidades en píxeles por segundo, con `dt` en segundos calculado desde `requestAnimationFrame`.
- `hits` empieza en 2 para `gray` y en 1 para el resto.
- Estado `ready`: la bola está pegada a la paleta y espera `Espacio`.
- Las dimensiones de la paleta (sprite de 162x14) y de la bola (sprite de 16x16) son constantes de `game.js`.

## Plan de implementación

1. Crear `index.html` y `style.css` con el `<canvas>` de 800x600 centrado, y `game.js` que llama a `loadSpritesheet` y dibuja un fondo y el texto "ARKANOID — pulsa Espacio". Prueba manual: abrir la página, ver el canvas sin errores en consola.
2. Dibujar la paleta y moverla con flechas/A-D, limitada a los bordes del canvas. Prueba: la paleta no sale del canvas.
3. Bucle con `dt`, bola pegada a la paleta en estado `ready` y lanzamiento con `Espacio`. Rebote en paredes laterales y techo. Prueba: la bola rebota en tres lados.
4. Rebote en la paleta con ángulo según el punto de impacto, a velocidad constante. Prueba: impacto en el centro sube recto; en los bordes sale a ~60°.
5. Generar la parrilla 10x6 y dibujarla. Colisión bola-bloque: invertir el eje con menor penetración, restar `hits`, sumar 10 puntos por golpe. Prueba: los bloques desaparecen y el marcador sube.
6. Animación de explosión al llegar `hits` a 0 y sonidos de rebote (paredes, paleta, bloque con `hits` restantes) y de rotura (bloque destruido).
7. Vidas: la bola que cae por debajo resta una vida y vuelve a `ready`; a 0 vidas pasa a `gameover`. Pausa con `P` (`playing` ↔ `paused`).
8. HUD con puntuación, vidas y récord. Pantallas de `gameover` y `won` (sin bloques vivos), con reinicio por `Espacio` o `Enter`.
9. Persistir el récord: leer `arkanoid.highscore` al cargar y actualizarlo al pasar a `gameover` o `won` si `score` lo supera. Envolver `localStorage` en `try/catch`.

## Criterios de aceptación

- [x] Abrir `index.html` no produce errores en la consola.
- [x] El `<canvas>` mide exactamente 800x600 píxeles.
- [x] La parrilla inicial tiene 60 bloques (10 columnas x 6 filas), con la fila superior `gray` y las siguientes `red`, `yellow`, `cyan`, `magenta`, `green`.
- [x] Las flechas y A/D mueven la paleta y esta no sale del canvas.
- [x] Con la bola en estado `ready`, `Espacio` la lanza; sin pulsar, no se mueve.
- [x] Un bloque `gray` necesita 2 golpes; cada otro bloque necesita 1.
- [x] Cada golpe a un bloque suma exactamente 10 puntos (un `gray` destruido suma 20).
- [x] La bola rebota en el centro de la paleta con ángulo vertical y en el borde con ~60° respecto a la vertical.
- [x] La velocidad de la bola es igual al empezar y tras 60 segundos de juego.
- [x] Al romper un bloque se reproduce la animación de explosión y suena `break-sound.mp3`; al rebotar suena `ball-bounce.mp3`.
- [x] Perder la bola resta 1 vida y devuelve la bola a la paleta; con 0 vidas aparece "Game over".
- [x] Romper los 60 bloques muestra la pantalla de victoria.
- [x] `P` pausa y reanuda; en pausa la bola y la paleta no se mueven.
- [x] `Espacio` o `Enter` en game over o victoria reinicia la partida con 3 vidas y 0 puntos.
- [x] Tras terminar una partida con más puntos que el récord, recargar la página muestra el nuevo récord.
- [x] Con `localStorage` bloqueado el juego funciona igual, sin récord persistente.

## Decisiones

- **Sí:** canvas fijo de 800x600, pedido explícitamente por el usuario.
- **Sí:** parrilla de 10x6 con bloques de 64x24 (escala 2x en ancho, 1.5x en alto del sprite de 32x16). Cabe con 80 px de margen lateral.
- **Sí:** 6 filas con `gray`, `red`, `yellow`, `cyan`, `magenta`, `green`. **No:** `hotpink`, porque hay 7 colores para 6 filas.
- **Sí:** solo teclado. **No:** ratón ni táctil, para reducir superficie de pruebas.
- **Sí:** ángulo de rebote según el punto de impacto y velocidad constante. **No:** reflexión simple, que genera bucles predecibles. **No:** aceleración, que añade reglas que especificar.
- **Sí:** 10 puntos por golpe, iguales para todos los colores. **No:** tabla de puntos por color.
- **Sí:** récord como entero en la clave `arkanoid.highscore`. **No:** nombres ni top N, que merecen su propia spec.
- **Sí:** tres archivos (`index.html`, `style.css`, `game.js`) como scripts clásicos. **No:** módulos ES, porque exigen servidor y `spritesheet.js` es un script clásico.
- **Sí:** `gray` con 2 golpes, reutilizando los frames de explosión de `red` (ya definidos en `spritesheet.js`).

## Riesgos

| Riesgo                                                             | Mitigación                                                                                     |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| La bola atraviesa bloques o paleta a `dt` grande                   | Limitar `dt` a un máximo de 1/30 s por frame.                                                  |
| Bola atascada en trayectoria casi horizontal                       | Limitar el ángulo máximo a 60° desde la vertical, de modo que `vy` nunca sea casi nulo.        |
| Los navegadores bloquean el audio hasta que hay interacción        | El primer sonido ocurre tras pulsar `Espacio`; ignorar rechazos de `play()` con `.catch`.      |
| Sonidos solapados cortados al reproducirlos seguido                | Clonar el `Audio` en cada reproducción o reiniciar `currentTime`.                              |
| `localStorage` desactivado o con valor corrupto                    | `try/catch` y `Number.isFinite`; si falla, el récord vale 0 y solo vive en memoria.            |
| `drawSprite` no hace nada hasta cargar el spritesheet              | Arrancar el bucle solo dentro del callback de `loadSpritesheet`.                               |

## Qué **no** entra en esta spec

- Más de un nivel.
- Power-ups.
- Control con ratón o táctil.
- Lista de récords con nombres.
- Música de fondo y ajustes de audio.

Cada uno de estos puntos, si llega, va en su propia spec.
