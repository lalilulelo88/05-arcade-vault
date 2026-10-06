# CLAUDE.md

Este archivo da orientación a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

## Estado del proyecto

Juego de Arkanoid en HTML, CSS y JavaScript puros: **cero dependencias, sin paso de build, sin gestor de paquetes**. Está implementado y es jugable; el `README.md` todavía dice que no, está desactualizado. No hay tests ni configuración de lint. La rama principal local es `master`.

Se ejecuta abriendo `index.html` en el navegador (o con cualquier servidor de archivos estáticos). La página debe estar en la raíz del proyecto: el spritesheet y los sonidos se cargan con rutas relativas.

## Estructura

- `index.html`: un `<canvas id="game">` de 800×600 y dos scripts clásicos (sin módulos), en este orden: `assets/spritesheet.js` y `game.js`.
- `style.css`: estilos de la página.
- `game.js`: **toda** la lógica del juego (estado, física, power-ups, sonido, niveles, HUD, bucle `requestAnimationFrame`). Por decisión de las specs 01–03 no se divide en módulos.
- `assets/`: sprites y sonidos (ver abajo).
- `specs/`: specs numeradas, fuente de verdad de cada funcionalidad.

### Estado del juego en `game.js`

- Constantes en mayúsculas al principio del archivo; un único objeto `game` con el estado. `game.state` es `'ready' | 'playing' | 'paused' | 'gameover' | 'won'`.
- Velocidades en px/s con `dt` en segundos; `dt` se limita a 1/30 para evitar saltos.
- Persistencia en `localStorage` siempre con `try/catch`: `arkanoid.highscore` (entero) y `arkanoid.settings` (JSON `{ volume, muted }`). Si falla, el juego sigue con valores por defecto.
- Hay 10 niveles (`MAX_LEVEL`) generados al azar con `generateLevel()` a partir de plantillas (`SHAPES`); al limpiar el último se pasa a `'won'`.

## Assets

- `assets/spritesheet-breakout.png` + `assets/spritesheet.js`: el atlas de sprites y su cargador. Define globales:
  - `SPRITES`: rectángulos de origen (`sx, sy, sw, sh`) para `paddle`, `ball` y `blocks.<color>` (gray, grayLight, red, yellow, cyan, magenta, hotpink, green). `grayLight` es el gris tras el primer golpe.
  - `EXPLOSION_FRAMES` / `EXPLOSION_DURATION` (150): animación de rotura de 4 frames por color de bloque. Ojo: `gray` reutiliza los frames de `red`.
  - `loadSpritesheet(cb)`: carga el PNG una sola vez, lo copia a un canvas fuera de pantalla y encola los callbacks hasta que termina. Hay que llamarla (y esperar a que termine) antes de dibujar.
  - `drawSprite(ctx, name, x, y, w, h)`: `name` es `'paddle'`, `'ball'` o `'block_<color>'`; `drawFrame(ctx, frame, ...)` dibuja un frame arbitrario (se usa para las explosiones). Ambas no hacen nada, sin avisar, hasta que el spritesheet está cargado. Escalan el sprite al `w`/`h` pedido, así que cambiar el tamaño de la paleta no requiere tocar el atlas.
- `assets/sounds/ball-bounce.mp3`, `break-sound.mp3`: efectos para rebotes y rotura de bloques. Siempre se reproducen con `playSound()` (clona el `Audio`, aplica `settings.volume` y respeta `settings.muted`).

## Flujo guiado por specs

Las funcionalidades grandes se desarrollan con el flujo **spec-driven**, no programando directamente. Las skills viven en `.agents/skills/spec` y `.agents/skills/spec-impl` (bloqueadas en `skills-lock.json`, de `Klerith/fernando-skills`); `.claude/skills/spec` y `.claude/skills/spec-impl` son enlaces simbólicos a ellas. Ambas leen primero este archivo. `.claude/skills/neko` es una skill de estilo de respuesta, sin relación con lo anterior.

### Ciclo

1. `/spec <descripción en una frase>` → entrevista con preguntas, luego escribe `specs/NN-slug.md` en estado **Borrador**. No escribe código y termina ahí.
2. El usuario relee la spec y cambia **él mismo** el estado a **Aprobado**. Claude nunca aprueba una spec.
3. `/spec-impl NN-slug` → solo funciona con specs aprobadas. Crea y cambia a la rama `spec-NN-slug` (`AutoCreateBranch` en `specs/.spec-config.yml`, ahora `true`), resume la spec y la implementa **paso a paso**, pausando tras cada paso para revisar el diff.
4. Al terminar: verificar los criterios de aceptación uno por uno, pasar la spec a **Implementado** y hacer el commit final antes de fusionar la rama.

### Formato de una spec

- Archivo `specs/NN-slug.md`: número de dos cifras correlativo + slug en kebab-case (`01-arkanoid-mvp`, `02-powerups`, `03-sonido-bolas-niveles`). La siguiente es la `04-`.
- **Escritas en español.** Una spec nueva debe copiar el idioma y los encabezados de las existentes.
- Cabecera en blockquote: `# SPEC NN — Título`, y debajo `> **Estado:**`, `> **Depende de:**`, `> **Fecha:**` (la de `date`, nunca inventada) y `> **Objetivo:**` (una sola frase; si no cabe, hay que dividir la spec).
- Estados: Borrador → En revisión → Aprobado → Implementado → Obsoleto. Las skills los reconocen en cualquier idioma.
- Secciones, en este orden: `## Alcance` (con **Dentro** y **Fuera de alcance**), `## Modelo de datos` (código con nombres reales), `## Plan de implementación` (pasos numerados, cada uno deja el sistema funcional y con una "Prueba:"), `## Criterios de aceptación` (checklist `- [ ]` booleano y verificable), `## Decisiones` (**Sí:** / **No:** con justificación), `## Riesgos` (tabla riesgo/mitigación) y `## Qué **no** entra en esta spec`.
- La plantilla completa está en `.agents/skills/spec/template.md`.

### Reglas al trabajar con specs

- Implementar exactamente lo que dice la spec; si algo parece mejorable, se comenta como observación, pero los cambios van a la spec, no al código por sorpresa.
- Si aparece una ambigüedad, parar y proponer 2–3 opciones concretas en lugar de improvisar.
- Lo que quede fuera del alcance de la spec en curso se anota para la siguiente, no se implementa en esa rama.
- No hacer commits automáticos: el commit lo decide el usuario.
- Los cambios pequeños (ajustes de constantes, retoques) pueden hacerse directamente, pero si contradicen una spec ya implementada hay que dejarlo dicho (ver abajo).

## Specs existentes

| Spec | Contenido | Estado |
| ---- | --------- | ------ |
| `01-arkanoid-mvp` | Canvas 800×600, paleta, bola, bloques, puntuación, récord, sonidos | Implementada |
| `02-powerups` | Cápsulas XL, X3, L (láser) y SB (bola atraviesa bloques) | Implementada |
| `03-sonido-bolas-niveles` | Menú de pausa con volumen/sonido, reserva de bolas, bola extra cada 2000 puntos, niveles aleatorios | Implementada |

### Cambios hechos fuera de spec

Estos cambios están en `game.js` pero **no figuran en ninguna spec** y contradicen a la 03, que describe niveles infinitos sin pantalla de victoria y una paleta de 162 px:

- `PADDLE_W` pasó de 162 a 81 (el power-up XL sigue siendo el doble: 162).
- `MAX_LEVEL = 10`: al limpiar el nivel 10 el estado pasa a `'won'` y se muestra «¡VICTORIA!»; Espacio o Enter reinician.

Si se toca esta zona, conviene registrar el cambio en una spec nueva (`04-…`) o actualizar la 03, en vez de dejar que la divergencia crezca.
