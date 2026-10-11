import type { EngineEvents, EngineHandle, GameEngine } from "./types";
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
export const FROGGER_W = COLS * CELL; // 640
export const FROGGER_H = ROWS * CELL; // 560
// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;
type Direction = "up" | "down" | "left" | "right";
type Entity = {
  col: number; // en celdas
  width: number; // en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  phase?: number; // ms de desfase del ciclo de inmersión (solo tortugas)
};
type Lane = {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
};
type Frog = {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
};
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
export const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
type LaneDef = {
  row: number;
  dir: 1 | -1;
  speed: number; // px/frame (a 60 fps) en nivel 1
  type: Entity["type"];
  width: number;
  gap: number; // celdas libres entre entidades
};
const ROAD: LaneDef[] = [
  { row: 8, dir: -1, speed: 1.5, type: "truck", width: 3, gap: 4 },
  { row: 9, dir: 1, speed: 2.5, type: "car", width: 1, gap: 4 },
  { row: 10, dir: -1, speed: 2, type: "truck", width: 2, gap: 4 },
  { row: 11, dir: 1, speed: 3, type: "car", width: 1, gap: 3 },
  { row: 12, dir: -1, speed: 4, type: "car", width: 1, gap: 5 },
];
const RIVER: LaneDef[] = [
  { row: 1, dir: 1, speed: 1.2, type: "log", width: 4, gap: 3 },
  { row: 2, dir: -1, speed: 1.5, type: "turtle", width: 3, gap: 3 },
  { row: 3, dir: 1, speed: 2.5, type: "log", width: 3, gap: 3 },
  { row: 4, dir: 1, speed: 1, type: "log", width: 2, gap: 3 },
  { row: 5, dir: -1, speed: 2, type: "turtle", width: 2, gap: 3 },
  { row: 6, dir: 1, speed: 3, type: "log", width: 3, gap: 4 },
];
// Cada nivel sube todas las velocidades un 15 % (acumulativo).
export function buildLanes(level: number): Lane[] {
  const factor = 1.15 ** (level - 1);
  return [...ROAD, ...RIVER].map((d) => {
    const step = d.width + d.gap;
    const count = Math.max(2, Math.ceil(COLS / step));
    const offset = (d.row * 3) % step;
    const entities: Entity[] = Array.from({ length: count }, (_, i) => ({
      col: offset + i * step,
      width: d.width,
      type: d.type,
      ...(d.type === "turtle" && {
        submerged: false,
        phase: i * (TURTLE_CYCLE_MS / count),
      }),
    }));
    return { row: d.row, speed: d.speed * factor, dir: d.dir, entities };
  });
}
type State = "ready" | "playing" | "over";
const JUMP_MS = 120;
const MAX_DT_MS = 50;
const LIVES = 3;
const START_COL = COLS / 2;
const MOUTHS = 5;
const mouthCol = (i: number) => 1 + 3 * i; // cada boca ocupa 2 columnas
const roundTime = (level: number) => Math.max(8000, 15000 - (level - 1) * 1000);
const DELTA: Record<Direction, { c: number; r: number }> = {
  up: { c: 0, r: -1 },
  down: { c: 0, r: 1 },
  left: { c: -1, r: 0 },
  right: { c: 1, r: 0 },
};
const ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};
const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
// Evita el scroll de la página sin tocar los campos de texto
const PAGE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const POINTS_ROW = 10;
const POINTS_GOAL = 50;
const POINTS_ROUND = 200;
const POINTS_TIME = 10; // por segundo restante al ocupar una boca
const inRoad = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
const inRiver = (row: number) => row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
// La rana ocupa [col, col + 1); se usa su centro para ser permisivo en los bordes
const covers = (frog: Frog, e: Entity) => {
  const c = frog.col + 0.5;
  return c >= e.col && c < e.col + e.width;
};
function checkRoadCollision(frog: Frog, lanes: Lane[]) {
  return lanes.some(
    (l) =>
      inRoad(l.row) &&
      l.row === frog.row &&
      l.entities.some((e) => covers(frog, e)),
  );
}
// Entidad que sostiene a la rana en el río (null si cae al agua o la tortuga está sumergida)
function getSupport(frog: Frog, lanes: Lane[]) {
  for (const lane of lanes) {
    if (!inRiver(lane.row) || lane.row !== frog.row) continue;
    const entity = lane.entities.find((e) => covers(frog, e) && !e.submerged);
    if (entity) return { lane, entity };
  }
  return null;
}
// Índice de la boca (0–4) bajo la columna, o -1 si cae en pared
function goalIndex(col: number) {
  const c = Math.round(col);
  for (let i = 0; i < MOUTHS; i++)
    if (c >= mouthCol(i) && c < mouthCol(i) + 2) return i;
  return -1;
}
const CAR_COLORS = ["#e63946", "#f4d35e", "#3a86ff"];
export const startFrogger: GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
): EngineHandle => {
  const ctx = canvas.getContext("2d")!;
  // ── Estado ──────────────────────────────────────────────────────────────────
  let state = "ready" as State;
  let score = 0;
  let bestRow = ROW_START; // fila más alta alcanzada en la ronda (+10 por fila nueva)
  let lives = LIVES;
  let level = 1;
  let lanes = buildLanes(level);
  let timeLeft = roundTime(level);
  let clock = 0; // ms jugados, para el ciclo de las tortugas
  let facing: Direction = "up";
  let pending: Direction | null = null;
  const goals: boolean[] = Array(MOUTHS).fill(false);
  const frog: Frog = {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  const sync = () => {
    if (score !== lastScore) events.onScore((lastScore = score));
    if (lives !== lastLives) events.onLives((lastLives = lives));
    if (level !== lastLevel) events.onLevel((lastLevel = level));
  };
  const finish = () => {
    if (state === "over") return;
    state = "over";
    stop();
    lives = 0;
    draw();
    sync();
    events.onGameOver(score);
  };
  // ── Lógica ──────────────────────────────────────────────────────────────────
  // Ocupa la boca bajo la rana y puntúa; false si no hay boca libre (muerte)
  const landGoal = () => {
    const i = goalIndex(frog.col);
    if (i < 0 || goals[i]) return false;
    goals[i] = true;
    score += POINTS_GOAL + Math.floor(timeLeft / 1000) * POINTS_TIME;
    return true;
  };
  // Rana de vuelta a la fila de inicio con el temporizador reiniciado
  const resetFrog = () => {
    Object.assign(frog, {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: START_COL,
      targetRow: ROW_START,
    });
    facing = "up";
    pending = null;
    timeLeft = roundTime(level);
  };
  const completeRound = () => {
    score += POINTS_ROUND;
    level++;
    lanes = buildLanes(level);
    goals.fill(false);
    resetFrog();
  };
  const killFrog = () => {
    lives--;
    if (lives <= 0)
      finish(); // finish() emite onLives(0) y luego onGameOver
    else resetFrog();
  };
  const startJump = (dir: Direction) => {
    facing = dir;
    const c = Math.round(frog.col) + DELTA[dir].c;
    const r = frog.row + DELTA[dir].r;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return; // sin salir del mapa
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = c;
    frog.targetRow = r;
  };
  const update = (dt: number) => {
    clock += dt;
    for (const lane of lanes)
      for (const e of lane.entities) {
        // speed está en px/frame (60 fps); col y width en celdas
        e.col += (lane.speed * lane.dir * dt) / 16 / CELL;
        if (lane.dir > 0 && e.col >= COLS) e.col = -e.width;
        if (lane.dir < 0 && e.col + e.width <= 0) e.col = COLS;
        if (e.type === "turtle")
          e.submerged =
            (clock + (e.phase ?? 0)) % TURTLE_CYCLE_MS >= TURTLE_VISIBLE_MS;
      }
    if (state !== "playing") return;
    if (!frog.animating && pending) startJump(pending);
    pending = null;
    let dead = false;
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        if (frog.row < bestRow) {
          score += POINTS_ROW * (bestRow - frog.row);
          bestRow = frog.row;
        }
        if (frog.row === ROW_GOALS) {
          if (!landGoal()) dead = true;
          else {
            bestRow = ROW_START; // la rana siguiente vuelve a puntuar por fila
            if (goals.every(Boolean)) completeRound();
            else resetFrog();
          }
        }
      }
    } else if (inRiver(frog.row)) {
      const sup = getSupport(frog, lanes);
      if (sup) frog.col += (sup.lane.speed * sup.lane.dir * dt) / 16 / CELL;
    }
    // Choque, agua o salida lateral del río (solo con la rana quieta)
    if (!frog.animating && frog.row !== ROW_GOALS) {
      dead ||= checkRoadCollision(frog, lanes);
      if (inRiver(frog.row))
        dead ||=
          !getSupport(frog, lanes) || frog.col < -0.5 || frog.col > COLS - 0.5;
    }
    timeLeft = Math.max(0, timeLeft - dt);
    if (dead || timeLeft <= 0) killFrog();
  };
  // ── Dibujado ────────────────────────────────────────────────────────────────
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const drawBackground = () => {
    const zone = (r0: number, r1: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, r0 * CELL, FROGGER_W, (r1 - r0 + 1) * CELL);
    };
    zone(ROW_GOALS, ROW_GOALS, "#0f3d1c");
    zone(ROW_RIVER_TOP, ROW_RIVER_BOT, "#0a2a5e");
    zone(ROW_SAFE_MID, ROW_SAFE_MID, "#14532d");
    zone(ROW_ROAD_TOP, ROW_ROAD_BOT, "#111118");
    zone(ROW_START, ROW_START, "#14532d");
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([16, 16]);
    ctx.lineWidth = 2;
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(FROGGER_W, r * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Bocas destino (tramo inferior de la fila 0; arriba va el HUD)
    for (let i = 0; i < MOUTHS; i++) {
      const x = mouthCol(i) * CELL;
      ctx.fillStyle = "#1d6b2e";
      ctx.fillRect(x, 18, 2 * CELL, CELL - 18);
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, 19, 2 * CELL - 2, CELL - 20);
      if (goals[i]) drawFrog(x + CELL, 30, 0, false, 0.7);
    }
  };
  const drawVehicle = (e: Entity, row: number, dir: 1 | -1) => {
    const x = e.col * CELL;
    const y = row * CELL;
    const w = e.width * CELL;
    if (e.type === "car") {
      ctx.fillStyle = CAR_COLORS[row % CAR_COLORS.length];
      roundRect(x + 3, y + 8, w - 6, 24, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(180,220,255,0.8)";
      ctx.fillRect(x + (dir > 0 ? w - 17 : 8), y + 12, 9, 16);
    } else {
      const cab = 34;
      const cabX = dir > 0 ? x + w - cab : x + 3;
      const trailerX = dir > 0 ? x + 3 : x + cab;
      ctx.fillStyle = "#8d99ae";
      roundRect(trailerX, y + 6, w - cab - 3, 28, 3);
      ctx.fill();
      ctx.fillStyle = "#e07a1f";
      roundRect(cabX, y + 8, cab, 24, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#000";
    const wheels = e.type === "car" ? [0.28, 0.72] : [0.15, 0.4, 0.85];
    for (const k of wheels) {
      for (const wy of [y + 8, y + 32]) {
        ctx.beginPath();
        ctx.arc(x + w * k, wy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  const drawLog = (e: Entity, row: number) => {
    const x = e.col * CELL;
    const y = row * CELL;
    const w = e.width * CELL;
    ctx.fillStyle = "#7b4a21";
    roundRect(x + 2, y + 6, w - 4, 28, 10);
    ctx.fill();
    ctx.strokeStyle = "#4e2d10";
    ctx.lineWidth = 2;
    for (let k = 1; k < e.width * 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (k * CELL) / 2, y + 12);
      ctx.lineTo(x + (k * CELL) / 2 + 6, y + 28);
      ctx.stroke();
    }
  };
  const drawTurtles = (e: Entity, row: number) => {
    for (let k = 0; k < e.width; k++) {
      const cx = (e.col + k + 0.5) * CELL;
      const cy = row * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      if (e.submerged) {
        ctx.strokeStyle = "rgba(120,220,140,0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = "#2f9e44";
      ctx.fill();
      ctx.strokeStyle = "#1b6b2c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
    }
  };
  // (cx, cy) = centro; mira hacia arriba en coordenadas locales y se rota con `rot`
  const drawFrog = (
    cx: number,
    cy: number,
    rot: number,
    jumping: boolean,
    scale = 1,
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#4ade80";
    if (jumping) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 13, 10, 4, 9, s * 0.5, 0, Math.PI * 2);
        ctx.ellipse(s * 12, -9, 3, 7, -s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s * 6, -8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(s * 6, -9, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  const drawHud = () => {
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(`PTS ${score}`, 8, 14);
    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, FROGGER_W / 2, 14);
    ctx.fillStyle = "#4ade80";
    for (let i = 0; i < lives; i++) {
      ctx.beginPath();
      ctx.arc(FROGGER_W - 14 - i * 20, 9, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Barra de tiempo en el borde inferior (la fila 0 ocupa las bocas)
    const ratio = timeLeft / roundTime(level);
    ctx.fillStyle =
      ratio > 0.5 ? "#4ade80" : ratio > 0.25 ? "#facc15" : "#ef4444";
    ctx.fillRect(0, FROGGER_H - 6, FROGGER_W * ratio, 6);
  };
  const draw = () => {
    drawBackground();
    for (const lane of lanes)
      for (const e of lane.entities) {
        if (e.type === "log") drawLog(e, lane.row);
        else if (e.type === "turtle") drawTurtles(e, lane.row);
        else drawVehicle(e, lane.row, lane.dir);
      }
    drawHud();
    const t = frog.animating ? Math.min(frog.animT / JUMP_MS, 1) : 0;
    const fx = frog.col + (frog.targetCol - frog.col) * t;
    const fy = frog.row + (frog.targetRow - frog.row) * t;
    drawFrog(
      (fx + 0.5) * CELL,
      (fy + 0.5) * CELL,
      ANGLE[facing],
      frog.animating,
    );
    if (state === "ready") {
      ctx.fillStyle = "#fff";
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "PULSA UNA FLECHA PARA EMPEZAR",
        FROGGER_W / 2,
        7 * CELL - 8,
      );
    }
  };
  // ── Entrada ─────────────────────────────────────────────────────────────────
  const inField = (e: KeyboardEvent) => {
    const t = e.target;
    return (
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA")
    );
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (inField(e)) return;
    const dir = KEY_DIRS[e.code];
    if (!dir) return; // P / Esc no se tratan: la pausa es de la plataforma
    if (PAGE_KEYS.includes(e.code)) e.preventDefault();
    if (!running || state === "over") return;
    if (state === "ready") state = "playing";
    pending = dir;
  };
  const onBlur = () => {
    pending = null;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  // ── Loop ────────────────────────────────────────────────────────────────────
  let raf = 0;
  let last: number | null = null;
  let running = false;
  const loop = (t: number) => {
    const dt = last === null ? 0 : Math.min(t - last, MAX_DT_MS);
    last = t;
    update(dt);
    sync();
    if (state === "over") return; // finish() ya dibujó el último frame
    draw();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || state === "over") return;
    last = null; // evita un dt grande tras pausa
    running = true;
    raf = requestAnimationFrame(loop);
  };
  function stop() {
    cancelAnimationFrame(raf);
    running = false;
  }
  start();
  return {
    pause: stop,
    resume: start,
    end: finish,
    destroy: () => {
      stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    },
  };
};
