# SPEC 02 — Power-ups (XL, X3, L, SB)

> **Estado:** implementada
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-05
> **Objetivo:** Al destruir un bloque puede caer una cápsula con un power-up (XL, X3, L o SB) que, al recogerla con la paleta, activa un efecto sobre la paleta o las bolas.

## Alcance

**Dentro:**

- 25% de probabilidad de soltar un power-up cada vez que un bloque pasa a `hits === 0` (también los `gray`, al romperse del todo). El tipo se elige al azar con la misma probabilidad entre los 4.
- La cápsula cae desde el centro del bloque destruido, se dibuja con canvas (rectángulo redondeado + texto `XL`, `X3`, `L` o `SB`, color distinto por tipo) y se recoge al tocar la paleta. Si sale por debajo del canvas, se pierde.
- **XL:** la paleta pasa al doble de ancho (162 → 324 px), manteniendo su centro. Dura un tiempo aleatorio entre 30 y 40 s. Si ya está activo, recoger otro XL se ignora (no cambia el tamaño ni el tiempo).
- **X3:** se añaden 3 bolas nuevas desde la posición de una bola existente. Es acumulable (cada X3 suma 3 más) y no tiene duración.
- **L:** la paleta dispara láseres desde sus dos extremos con `Espacio` durante 20 s. Recoger otro L con el efecto activo reinicia el tiempo a 20 s.
- **SB:** la bola más cercana a la paleta en el momento de recoger la cápsula cambia de color continuamente y atraviesa los bloques destruyéndolos sin rebotar, durante 15 s.
- Con varias bolas, perder una no resta vida; solo se resta cuando se pierde la última.
- Los efectos con tiempo se congelan en pausa (`P`).
- Todos los efectos y las cápsulas en caída se borran al perder una vida y al reiniciar la partida.
- Indicador en pantalla de los efectos activos con su tiempo restante.

**Fuera de alcance (para otras specs):**

- Sprites o sonidos nuevos para los power-ups (se reutilizan `ball-bounce.mp3` y `break-sound.mp3`).
- Power-ups negativos, vida extra, bola lenta/rápida u otros tipos.
- Probabilidades distintas por tipo o por color de bloque.
- Puntos por recoger una cápsula.
- Persistencia de efectos entre vidas o partidas.
- Control con ratón o táctil para disparar.

## Modelo de datos

```js
const POWERUP_DROP_CHANCE = 0.25;
const POWERUP_TYPES = ['XL', 'X3', 'L', 'SB'];
const POWERUP_W = 40, POWERUP_H = 20;
const POWERUP_FALL_SPEED = 150;         // px/s
const XL_MIN_MS = 30000, XL_MAX_MS = 40000;
const LASER_MS = 20000;
const SB_MS = 15000;
const LASER_COOLDOWN_MS = 300;
const LASER_SPEED = 600;                // px/s
const LASER_W = 4, LASER_H = 14;
const X3_ANGLES = [-40, 0, 40];         // grados desde la vertical, hacia arriba

const game = {
  // ...campos de SPEC 01, salvo `ball`, que pasa a `balls`
  balls: [ /* { x, y, vx, vy, r, piercing } */ ],
  powerups: [ /* { type, x, y } cápsulas cayendo; x, y = esquina superior izquierda */ ],
  lasers: [ /* { x, y } rayos en vuelo; y = parte superior */ ],
  effects: {
    xlLeft: 0,        // ms restantes; 0 = inactivo
    laserLeft: 0,     // ms restantes; 0 = inactivo
    laserCooldown: 0, // ms hasta poder volver a disparar
    sbLeft: 0,        // ms restantes; 0 = inactivo
    sbBall: null,     // referencia a la bola con piercing, o null
  },
};
```

Convenciones:

- Los temporizadores se descuentan con `dt` dentro de `update`, que ya no se ejecuta en pausa, así que el tiempo se congela solo.
- `game.paddle.w` vale `PADDLE_W` o `PADDLE_W * 2` según `xlLeft`.
- Cada bola sale de `game.balls`; en estado `ready` hay una sola bola pegada a la paleta.
- Cada láser dispara 2 rayos a la vez: en `paddle.x + 4` y en `paddle.x + paddle.w - 4 - LASER_W`.
- Un rayo láser resta 1 a `hits` del primer bloque que toca y desaparece; suma `POINTS_PER_HIT`.
- La bola con `piercing` destruye el bloque entero (`hits = 0`) y suma `POINTS_PER_HIT * hits` que tenía.
- Los efectos de SB y X3 usan la velocidad constante `BALL_SPEED` de SPEC 01.

## Plan de implementación

1. Refactor sin cambio de comportamiento: sustituir `game.ball` por `game.balls` (una sola bola) y mover la lógica de movimiento, paredes, paleta y bloques a un bucle sobre las bolas. Perder la vida solo cuando `balls` queda vacío. Prueba: el juego se comporta igual que en SPEC 01.
2. Soltar y dibujar cápsulas: al destruir un bloque, 25% de crear un `{ type, x, y }` en `game.powerups`; caída, dibujo (rectángulo redondeado con texto) y eliminación al salir del canvas. Todavía sin recogida. Prueba: caen cápsulas al azar con la etiqueta correcta.
3. Recogida y XL: al tocar la paleta se retira la cápsula y se aplica el efecto; implementar XL (ancho doble, 30-40 s, ignorar repetido, volver al ancho normal al acabar manteniendo el centro). Prueba: recoger XL agranda la paleta y a los 30-40 s vuelve a normal.
4. X3: crear 3 bolas con los ángulos de `X3_ANGLES` desde la primera bola de `game.balls`. Prueba: con 1 bola pasan a 4; recoger otro X3 suma 3 más; perder una bola no resta vida.
5. SB: marcar `piercing` en la bola más cercana a la paleta (mayor `y`), fijar `sbBall`, color cambiante al dibujarla, y atravesar bloques sin rebotar; el efecto termina a los 15 s o si esa bola se pierde. Prueba: la bola destruye bloques sin cambiar de dirección.
6. Láser: con `laserLeft > 0` y estado `playing`, `Espacio` dispara 2 rayos respetando `LASER_COOLDOWN_MS`; los rayos suben, restan 1 `hits` al primer bloque que tocan y desaparecen; recoger otro L reinicia a 20 s. `Espacio` en `ready` sigue lanzando la bola. Prueba: los rayos rompen bloques; un `gray` necesita 2 rayos.
7. Reinicio e indicador: vaciar `powerups`, `lasers` y `effects`, devolver la paleta a `PADDLE_W` y dejar una sola bola al perder una vida y en `resetGame`. Mostrar en el HUD los efectos activos con segundos restantes. Prueba: perder una vida limpia todo.

## Criterios de aceptación

- [x] Abrir `index.html` no produce errores en la consola.
- [x] Al destruir un bloque (o romper un `gray` del todo) cae una cápsula aproximadamente en 1 de cada 4 casos; un `gray` con 1 golpe restante no suelta nada.
- [x] Cada cápsula muestra el texto `XL`, `X3`, `L` o `SB` y cae a velocidad constante.
- [x] Una cápsula que sale por debajo del canvas desaparece sin efecto.
- [x] Recoger XL duplica el ancho de la paleta a 324 px, sin salirse del canvas, y vuelve a 162 px a los 30-40 s.
- [x] Recoger un segundo XL con el efecto activo no cambia el ancho ni el tiempo restante.
- [x] Recoger X3 con una bola en juego deja 4 bolas; recoger otro X3 deja 7.
- [x] Perder una bola con otras en juego no resta vida; perder la última resta 1.
- [x] Todas las bolas mantienen `BALL_SPEED` de velocidad.
- [x] Recoger L permite disparar con `Espacio`: salen 2 rayos, uno por extremo, y no se puede volver a disparar antes de 300 ms.
- [x] Un rayo resta 1 golpe al bloque que toca y suma 10 puntos; un `gray` necesita 2 rayos.
- [x] El láser se desactiva a los 20 s; recoger otro L antes lo reinicia a 20 s.
- [x] Con la bola en estado `ready`, `Espacio` lanza la bola y no dispara láser.
- [x] Recoger SB cambia de color la bola más cercana a la paleta, que destruye bloques sin rebotar en ellos; un `gray` se destruye de un solo contacto y suma 20 puntos.
- [x] SB termina a los 15 s o al perderse esa bola, y la bola vuelve a su aspecto normal.
- [x] La bola con SB sigue rebotando en paredes, techo y paleta.
- [x] En pausa (`P`) las cápsulas, los rayos y todos los temporizadores quedan congelados.
- [x] Al perder una vida (o reiniciar) desaparecen cápsulas, rayos y efectos, la paleta vuelve a 162 px y hay una sola bola pegada a la paleta.
- [x] El HUD muestra los efectos con tiempo activos y sus segundos restantes.

## Decisiones

- **Sí:** probabilidad de drop del 25%, elegida por el usuario. **No:** 10% o 35%.
- **Sí:** el tipo se elige con probabilidad uniforme. **No:** pesos por tipo, para no añadir reglas de balance sin datos.
- **Sí:** X3 añade 3 bolas nuevas (1 → 4 → 7), elegido por el usuario. **No:** dividir cada bola en 3 (crecimiento exponencial) ni llegar a un total de 3 (no acumulable).
- **Sí:** las 3 bolas de X3 salen hacia arriba a -40°, 0° y +40° desde la vertical. Respeta el límite de 60° de SPEC 01 y evita trayectorias casi horizontales.
- **Sí:** SB afecta solo a la bola más cercana a la paleta, elegida al recoger la cápsula y fija durante 15 s, según el usuario. **No:** reevaluarla cada frame, por complejidad.
- **Sí:** SB destruye un `gray` de un solo contacto. **No:** restarle 1 golpe, porque "destruye los bloques" pedido por el usuario.
- **Sí:** láser con 2 rayos por pulsación y 300 ms de cadencia mínima; recoger L de nuevo reinicia a 20 s. **No:** ráfaga continua manteniendo `Espacio`, demasiado potente.
- **Sí:** XL repetido se ignora por completo, literal a "no se puede activar más de una vez".
- **Sí:** todo se reinicia al perder una vida. **No:** conservar efectos, porque la paleta y la bola vuelven al estado inicial.
- **Sí:** cápsula rectangular con texto dibujada en canvas, elección del usuario aunque lo pedido era una estrella. **No:** estrella poligonal ni sprites nuevos.
- **Sí:** reutilizar `ball-bounce.mp3` y `break-sound.mp3`; sin sonido propio para recoger cápsulas.
- **Sí:** seguir con scripts clásicos y todo en `game.js`, como en SPEC 01.

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| El refactor a `game.balls` rompe el comportamiento del MVP             | El paso 1 no cambia comportamiento y se prueba solo antes de añadir nada más.                |
| Con muchas bolas (X3 acumulado) baja el rendimiento o suena todo a la vez | Sin límite por decisión del usuario; las colisiones son baratas. Se revisa si falla en prueba. |
| XL agranda la paleta fuera del canvas cerca de un borde                | Limitar `paddle.x` a `[0, W - paddle.w]` al activar y al expirar.                            |
| La bola con SB atraviesa bloques y deja el nivel ganado antes de tiempo | Es el comportamiento pedido; la victoria sigue comprobándose cuando no quedan bloques.       |
| Un rayo y una bola golpean el mismo bloque en el mismo frame           | Procesar bloques con `exploding` ignorados, igual que SPEC 01; el segundo golpe no cuenta.   |

## Qué **no** entra en esta spec

- Sprites o sonidos nuevos.
- Otros power-ups (vida extra, bola lenta, etc.).
- Más de un nivel.
- Control con ratón o táctil.
- Lista de récords con nombres.

Cada uno de estos puntos, si llega, va en su propia spec.
