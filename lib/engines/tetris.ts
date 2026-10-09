import type { EngineEvents, EngineHandle, GameEngine } from "./types";
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = 480;
const H = 600;
const BOARD_W = COLS * BLOCK; // el panel lateral empieza aquí
const PREVIEW = 4 * BLOCK; // caja 4×4 de HOLD y NEXT
const PANEL_X = BOARD_W + 30;
// índice = tipo de pieza: 1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L
const T_TYPE = 3;
const COLORS = [
  "",
  "#4dd0e1",
  "#ffd54f",
  "#ba68c8",
  "#81c784",
  "#e57373",
  "#7986cb",
  "#ffb74d",
];
const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  [
    [2, 2],
    [2, 2],
  ],
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
];
const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PERFECT_CLEAR = 2000;
const FLASH_MS = 1200;
const KICKS = [0, -1, 1, -2, 2];
const SOFT_DROP_POINTS = 1;
const HARD_DROP_POINTS = 2;
// Evita el scroll de la página sin tocar los campos de texto
const PAGE_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];
const speedFor = (level: number) => Math.max(100, 1000 - (level - 1) * 90);
const randomType = () => Math.floor(Math.random() * 7) + 1;
const rotateCW = (shape: number[][]) =>
  shape[0].map((_, c) => shape.map((row) => row[c]).reverse());
type Piece = { type: number; shape: number[][]; x: number; y: number };
type Flash = { text: string; points: number; left: number };
export const startTetris: GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
): EngineHandle => {
  const ctx = canvas.getContext("2d")!;
  // ── Estado ──────────────────────────────────────────────────────────────────
  const board: number[][] = Array.from({ length: ROWS }, () =>
    new Array<number>(COLS).fill(0),
  );
  let score = 0;
  let lines = 0;
  let level = 1;
  let combo = 0;
  let b2b = false;
  let lastRotate = false;
  let hold = 0; // tipo reservado, 0 = vacío
  let holdUsed = false;
  let flash: Flash | null = null;
  let dropInterval = speedFor(level);
  let dropAccum = 0;
  let over = false;
  const makePiece = (type: number): Piece => {
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  };
  let next = randomType();
  let current = makePiece(randomType());
  // ── Eventos (solo cuando el valor cambia) ───────────────────────────────────
  let sentScore = -1;
  let sentLevel = -1;
  const sync = () => {
    if (score !== sentScore) events.onScore((sentScore = score));
    if (level !== sentLevel) events.onLevel((sentLevel = level));
  };
  events.onLives(1); // Tetris no tiene vidas: HUD fijo
  sync();
  const finish = () => {
    if (over) return;
    over = true;
    stop();
    draw();
    sync();
    events.onGameOver(score);
  };
  // ── Reglas ──────────────────────────────────────────────────────────────────
  const collide = (shape: number[][], ox: number, oy: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  };
  const cellFilled = (x: number, y: number) =>
    x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0);
  // regla de 3 esquinas: T, última acción fue rotar y ≥3 de las 4 esquinas ocupadas
  const isTSpin = () => {
    if (current.type !== T_TYPE || !lastRotate) return false;
    const { x, y } = current;
    return (
      [
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
      ].filter(([dx, dy]) => cellFilled(x + dx, y + dy)).length >= 3
    );
  };
  const ghostY = () => {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  };
  const clearLines = () => {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    return cleared;
  };
  const scoreLock = (cleared: number, tspin: boolean) => {
    const labels: string[] = [];
    let pts = 0;
    if (!cleared) {
      combo = 0;
      if (tspin) {
        pts = TSPIN_SCORES[0] * level;
        labels.push("T-SPIN");
      }
    } else {
      const difficult = cleared === 4 || tspin;
      pts = (tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared]) * level;
      if (tspin) labels.push("T-SPIN");
      if (cleared === 4) labels.push("TETRIS");
      if (difficult && b2b) {
        pts = Math.floor(pts * 1.5);
        labels.push("B2B");
      }
      b2b = difficult;
      combo++;
      if (combo >= 2) {
        pts *= combo;
        labels.push(`COMBO x${combo}`);
      }
      if (board.every((row) => row.every((v) => !v))) {
        pts += PERFECT_CLEAR * level;
        labels.push("PERFECT CLEAR");
      }
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = speedFor(level);
    }
    score += pts;
    if (labels.length) {
      flash = { text: labels.join(" + "), points: pts, left: FLASH_MS };
    }
  };
  const spawn = () => {
    current = makePiece(next);
    next = randomType();
    holdUsed = false;
    lastRotate = false;
    if (collide(current.shape, current.x, current.y)) finish();
  };
  const lockPiece = () => {
    const tspin = isTSpin();
    current.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v) board[current.y + r][current.x + c] = v;
      }),
    );
    scoreLock(clearLines(), tspin);
    spawn();
  };
  const move = (dx: number) => {
    if (collide(current.shape, current.x + dx, current.y)) return;
    current.x += dx;
    lastRotate = false;
  };
  const rotate = () => {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        lastRotate = true;
        return;
      }
    }
  };
  const softDrop = () => {
    if (collide(current.shape, current.x, current.y + 1)) return lockPiece();
    current.y++;
    lastRotate = false;
    score += SOFT_DROP_POINTS;
  };
  const hardDrop = () => {
    const gy = ghostY();
    score += (gy - current.y) * HARD_DROP_POINTS;
    if (gy > current.y) lastRotate = false;
    current.y = gy;
    lockPiece();
  };
  const holdPiece = () => {
    if (holdUsed) return;
    const type = current.type;
    if (hold) {
      current = makePiece(hold);
      if (collide(current.shape, current.x, current.y)) finish();
    } else {
      spawn();
    }
    hold = type;
    holdUsed = true;
    lastRotate = false;
  };
  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (PAGE_KEYS.includes(e.code)) e.preventDefault();
    if (!running || over) return; // en pausa o terminada no se juega
    switch (e.code) {
      case "ArrowLeft":
        move(-1);
        break;
      case "ArrowRight":
        move(1);
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        rotate();
        break;
      case "Space":
        hardDrop();
        break;
      case "KeyC":
      case "ShiftLeft":
      case "ShiftRight":
        holdPiece();
        break;
      default:
        return;
    }
    sync();
    if (!over) draw();
  };
  window.addEventListener("keydown", onKeyDown);
  // ── Draw ────────────────────────────────────────────────────────────────────
  const drawBlock = (
    gx: number,
    gy: number,
    type: number,
    ox = 0,
    oy = 0,
    alpha = 1,
  ) => {
    if (!type) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(
      ox + gx * BLOCK + 1,
      oy + gy * BLOCK + 1,
      BLOCK - 2,
      BLOCK - 2,
    );
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(ox + gx * BLOCK + 1, oy + gy * BLOCK + 1, BLOCK - 2, 4);
    ctx.globalAlpha = 1;
  };
  const drawPreview = (type: number, y: number, alpha: number) => {
    ctx.strokeStyle = "rgba(0,245,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(PANEL_X + 0.5, y + 0.5, PREVIEW, PREVIEW);
    if (!type) return;
    const shape = PIECES[type];
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    shape.forEach((row, r) =>
      row.forEach((v, c) =>
        drawBlock(offX + c, offY + r, v, PANEL_X, y, alpha),
      ),
    );
  };
  const label = (text: string, y: number) => {
    ctx.fillStyle = "#8aa0a8";
    ctx.font = "13px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, PANEL_X, y);
  };
  const value = (text: string, y: number) => {
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, PANEL_X, y);
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    // cuadrícula y borde del tablero
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(BOARD_W, r * BLOCK);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,245,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(BOARD_W + 0.5, 0);
    ctx.lineTo(BOARD_W + 0.5, H);
    ctx.stroke();
    // tablero, ghost y pieza actual
    board.forEach((row, r) => row.forEach((v, c) => drawBlock(c, r, v)));
    const gy = ghostY();
    current.shape.forEach((row, r) =>
      row.forEach((v, c) => drawBlock(current.x + c, gy + r, v, 0, 0, 0.2)),
    );
    current.shape.forEach((row, r) =>
      row.forEach((v, c) => drawBlock(current.x + c, current.y + r, v)),
    );
    // panel lateral
    label("HOLD", 24);
    drawPreview(hold, 34, holdUsed ? 0.35 : 1);
    label("NEXT", 190);
    drawPreview(next, 200, 1);
    label("LÍNEAS", 370);
    value(String(lines), 400);
    label("COMBO", 450);
    value(combo > 1 ? `x${combo}` : "-", 480);
    // destello de combos
    if (flash) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flash.left / 400);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.fillStyle = "#ff006e";
      ctx.font = "bold 16px monospace";
      const x = BOARD_W / 2;
      const y = H / 3;
      const pts = `+${flash.points}`;
      ctx.strokeText(flash.text, x, y, BOARD_W - 10);
      ctx.fillText(flash.text, x, y, BOARD_W - 10);
      ctx.strokeText(pts, x, y + 22);
      ctx.fillText(pts, x, y + 22);
      ctx.restore();
    }
  };
  // ── Loop ────────────────────────────────────────────────────────────────────
  let raf = 0;
  let lastTime: number | null = null;
  let running = false;
  const loop = (ts: number) => {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    if (flash && (flash.left -= dt) <= 0) flash = null;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (collide(current.shape, current.x, current.y + 1)) lockPiece();
      else {
        current.y++;
        lastRotate = false;
      }
    }
    sync();
    if (over) return; // finish() ya dibujó el último frame
    draw();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || over) return;
    lastTime = null; // evita un dt grande tras pausa
    running = true;
    raf = requestAnimationFrame(loop);
  };
  function stop() {
    cancelAnimationFrame(raf);
    running = false;
  }
  draw();
  start();
  return {
    pause: stop,
    resume: start,
    end: finish,
    destroy: () => {
      stop();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
};
