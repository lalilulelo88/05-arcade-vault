# Skins implementados

Referencia de qué juegos con motor ya tienen skins **implementados en código** (no solo especificados). Lo mantiene el agente `skin-designer` (`.claude/agents/skin-designer.md`).

Estados: `—` sin skin · `spec` spec escrita (Borrador/Aprobado), sin código · `✔` implementado.

| id           | Título     | clasico | neon | retro | Spec |
| ------------ | ---------- | ------- | ---- | ----- | ---- |
| `asteroids`  | ASTEROIDS  | —       | —    | —     | —    |
| `caida`      | THETRIS    | —       | —    | —     | —    |
| `arkanoid`   | ARKANOID   | —       | —    | —     | —    |
| `serpentina` | SERPENTINA | —       | —    | —     | —    |

`clasico` es el skin por defecto: conserva los colores originales del motor.

## Reglas

- Un juego cuenta como "con skins" solo cuando los tres (`clasico`, `neon`, `retro`) están en `✔`.
- Cuando se escribe una spec de skins para un juego, se marca `spec` en sus tres columnas y se enlaza en "Spec".
- Cuando `/spec-impl` la implementa, se pasa a `✔`.
- Los juegos nuevos se añaden aquí al registrarse en `ENGINES` (ver `implemented-games.md`).
