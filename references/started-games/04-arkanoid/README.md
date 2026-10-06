# Juego de Arkanoid

Un Arkanoid hecho con HTML, CSS y JavaScript puros: cero dependencias, sin build y sin gestor de paquetes.

## Cómo jugar

Abre `index.html` en el navegador (o sírvelo con cualquier servidor de archivos estáticos). La página debe estar en la raíz del proyecto porque el spritesheet y los sonidos se cargan con rutas relativas.

### Controles

| Tecla | Acción |
| ----- | ------ |
| `←` `→` / `A` `D` | Mover la paleta |
| `Espacio` | Lanzar la bola; disparar el láser si está activo |
| `P` | Pausa / reanudar |
| `↑` `↓` | En pausa: cambiar de opción del menú |
| `←` `→` | En pausa: ajustar el volumen o alternar el sonido |
| `Espacio` / `Enter` | Reiniciar tras Game Over o Victoria |

### Reglas

- Empiezas con una reserva de **3 bolas**; cada 2000 puntos ganas una más.
- Cada golpe a un bloque suma 10 puntos. Los bloques grises aguantan 2 golpes.
- El ángulo de rebote en la paleta depende de dónde golpee la bola (centro = vertical, borde = 60°).
- Hay **10 niveles**, cada uno generado al azar (forma, tamaño y colores). Al limpiar el décimo ganas.
- El récord se guarda en el navegador (`localStorage`), igual que el volumen y el estado del sonido.

### Power-ups

Al romper un bloque hay un 25% de probabilidad de que caiga una cápsula; recógela con la paleta.

| Cápsula | Efecto |
| ------- | ------ |
| `XL` | Paleta del doble de ancho durante 30–40 s |
| `X3` | La bola se divide en tres |
| `L` | Láser durante 20 s (dispara con `Espacio`) |
| `SB` | Bola que atraviesa los bloques durante 15 s |

## Estructura

```
index.html            página con el canvas de 800×600
style.css             estilos
game.js               toda la lógica del juego
assets/
  spritesheet-breakout.png
  spritesheet.js      atlas de sprites y su cargador
  sounds/             ball-bounce.mp3, break-sound.mp3
specs/                especificaciones numeradas (spec-driven)
```

## Desarrollo guiado por specs

Las funcionalidades grandes se definen primero en `specs/NN-slug.md` con `/spec` y se implementan después, desde una rama `spec-NN-slug`, con `/spec-impl`. Specs actuales:

1. `01-arkanoid-mvp`: juego base, puntuación y récord.
2. `02-powerups`: cápsulas XL, X3, L y SB.
3. `03-sonido-bolas-niveles`: menú de pausa, reserva de bolas y niveles aleatorios.

Más detalles para quien trabaje con Claude Code en `CLAUDE.md`.
