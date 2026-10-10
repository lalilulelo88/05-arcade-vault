# Juegos implementados

Juegos con motor real en `lib/engines/` (registrados en `ENGINES`) y registro en la tabla `games` de Supabase.

| id           | Título     | Motor                            | Canvas  |
| ------------ | ---------- | -------------------------------- | ------- |
| `asteroids`  | ASTEROIDS  | `lib/engines/asteroids`          | 800×600 |
| `caida`      | THETRIS    | `lib/engines/caida` (Tetris)     | 480×600 |
| `arkanoid`   | ARKANOID   | `lib/engines/arkanoid`           | 800×600 |
| `serpentina` | SERPENTINA | `lib/engines/serpentina` (Snake) | 800×800 |

## En la base de datos pero sin motor (no implementados)

`bloque-buster` (oculto, reemplazado por arkanoid), `duelo-pixel`, `gloton`, `invasores`, `ranaria`, `rocas`.
