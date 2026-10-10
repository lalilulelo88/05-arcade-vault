# SPEC — RANARIA: niveles progresivos, tortugas y cocodrilos

> **Estado:** Borrador
> **Depende de:** 01-ranaria-core
> **Fecha:** 2026-10-10
> **Objetivo:** Hacer que cada nivel de RANARIA sea más difícil mediante velocidad escalada, tortugas que se sumergen y un cocodrilo que acecha en los nenúfares.

## Scope

**In:**

- Tabla de dificultad por nivel en `lib/engines/ranaria.ts` (constante `LEVELS`), usada al iniciar cada nivel (al llenar los 5 nenúfares) y al iniciar la partida.
- Multiplicador de velocidad de todos los carriles: nivel 1 = 1.0, +0.12 por nivel, tope 2.0 (nivel 9+).
- Densidad: cada carril de carretera añade un obstáculo extra a partir de los niveles 3 y 6 (menor `gap`, mínimo 3 celdas para dejar paso).
- Tortugas: desde el nivel 2, los carriles de tortugas se sumergen cíclicamente: 3 s emergidas, 0.6 s de aviso (parpadeo), 1.5 s sumergidas (la rana encima muere). Ciclo desfasado por grupo.
- Cocodrilo: desde el nivel 4, cada 8 s aparece uno en un nenúfar libre al azar durante 3 s (aviso de 1 s con parpadeo antes). Saltar a un nenúfar con cocodrilo mata.
- Tiempo por rana: 30 s en nivel 1, -2 s por nivel, mínimo 16 s.
- Bonus al completar nivel: +100 por nivel superado (se suma a los +1000 del core).
- `onLevel(n)` se emite al iniciar cada nivel (ya definido por el core).

**Fuera de alcance:**

- Sonido y animaciones de transición (spec 03).
- Mapas distintos por nivel, vehículos nuevos, serpientes o moscas bonus.
- Selector de nivel inicial o modo contrarreloj/endless.
- Controles táctiles/mobile.
- Supabase Auth/RLS y Realtime en el leaderboard.
- Cambios en la base de datos o en `GamePlayer`.

## Data model

Sin cambios de SQL. Estructuras internas:

```ts
type LevelConfig = {
  speedMul: number; // multiplicador sobre Lane.speed
  extraObstacles: number; // 0, 1 o 2 por carril de carretera
  turtleDive: boolean;
  crocodile: boolean;
  timeLimitSec: number;
};
const levelConfig = (n: number): LevelConfig => ({
  speedMul: Math.min(2, 1 + 0.12 * (n - 1)),
  extraObstacles: n >= 6 ? 2 : n >= 3 ? 1 : 0,
  turtleDive: n >= 2,
  crocodile: n >= 4,
  timeLimitSec: Math.max(16, 30 - 2 * (n - 1)),
});
// estado nuevo: turtleClock (ms acumulados por dt), croc: { pad: number; msLeft: number } | null
```

## Implementation plan

1. **Config de nivel.** Añadir `levelConfig` y aplicarlo al construir los obstáculos y el reloj al empezar cada nivel. Verificación: `npm run build`; en nivel 2 los obstáculos se mueven 12 % más rápido.
2. **Densidad.** Insertar obstáculos extra respetando `gap >= 3`. Verificación: a nivel 3 y 6 hay más vehículos y siempre hay un hueco para cruzar.
3. **Tortugas que se sumergen.** Reloj con `dt`, parpadeo en aviso, muerte si la rana está encima sumergida. Verificación: nivel 2, tortuga bajo la rana se hunde y mata; la pausa congela el ciclo.
4. **Cocodrilo.** Temporizador con `dt`, dibujado con aviso, muerte al saltar a ese nenúfar. Verificación: nivel 4.
5. **Tiempo por nivel y bonus.** Aplicar `timeLimitSec` y +100 al subir nivel. Verificación: la barra de tiempo se acorta y el puntaje suma el bonus.
6. **Verificación final.** `npm run lint`, `npm run build`, `npx tsc --noEmit`; partida hasta nivel 5+ (se puede probar bajando temporalmente los nenúfares requeridos en local, sin commitear).

## Acceptance criteria

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] La velocidad de los carriles sube 12 % por nivel y no supera 2.0x.
- [ ] En los niveles 3 y 6 hay más obstáculos por carril de carretera y siempre existe un hueco cruzable.
- [ ] Desde el nivel 2 las tortugas parpadean antes de hundirse; una rana encima de una tortuga sumergida muere.
- [ ] Desde el nivel 4 aparece un cocodrilo avisado en un nenúfar libre; saltar a él cuesta una vida y no ocupa el nenúfar.
- [ ] El tiempo por rana baja 2 s por nivel, mínimo 16 s.
- [ ] Al completar un nivel se suman 1000 (core) + 100 x nivel superado y `onLevel` refleja el nuevo nivel una sola vez.
- [ ] PAUSA congela los ciclos de tortugas y cocodrilo.
- [ ] "JUGAR DE NUEVO" vuelve a nivel 1 con la configuración inicial.
- [ ] El comportamiento del nivel 1 es idéntico al de la spec 01.

## Decisions

- **Sí: dificultad calculada por función `levelConfig`** — Razón: una fórmula pequeña cubre todos los niveles sin tabla larga. **No:** tabla fija por nivel ni mapas distintos.
- **Sí: tope de velocidad 2.0x y gap mínimo 3** — Razón: evitar niveles imposibles. **No:** escalado sin límite.
- **Sí: tortugas con aviso visual** — Razón: la muerte debe ser justa y predecible. **No:** hundimiento sin aviso.
- **Sí: cocodrilo solo en nenúfares** — Razón: es lo mínimo que añade riesgo en la meta. **No:** serpientes ni moscas bonus (otra spec).
- **Sí: mismas 3 vidas del core** — Razón: no cambia la mecánica de vidas. **No:** vidas extra por nivel.
- **Sí: relojes basados en `dt`** — Razón: la pausa los congela sin código adicional. **No:** `setTimeout`/`performance.now()` directos.
