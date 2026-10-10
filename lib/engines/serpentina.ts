import type { EngineEvents, EngineHandle, GameEngine, SkinId } from "./types";
const W = 800;
const H = 800;
const CELL = 40;
const COLS = 20;
const ROWS = 20;
const SPRITE_URL = "/games/serpentina/fruits.png";
const TICK_MS = 140; // velocidad constante, sin niveles
const MAX_DT_MS = 50;
const POINTS_PER_FRUIT = 10;
const START_LENGTH = 3;
const MAX_QUEUE = 2;
const FRUIT_H = 36; // alto en px de la fruta dibujada
const BODY_R = 17;
const HEAD_R = 20;
type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number }; // columna 0–19, fila 0–19
type State = "ready" | "playing" | "over";
const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const KEY_DIRS: Record<string, Dir> = {
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
type FruitSprite = { x: number; y: number; w: number; h: number };
// Atlas de fruits.png (fila mediana pixel-art, y = 136–295; coordenadas de sprites.js)
const FRUITS: Record<string, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
type FruitKey = keyof typeof FRUITS;
const FRUIT_KEYS = Object.keys(FRUITS) as FruitKey[];
type Palette = {
  bg: string;
  grid: string;
  body: (f: number, i: number) => string; // f = 0 cabeza … 1 cola
  glow: number; // shadowBlur de la serpiente, 0 = sin glow
  glowColor: string;
  fruitGlow: number; // shadowBlur de la fruta
  fruitGlowColor: string;
  fruitTint: string | null; // retro: silueta monocroma; null = sprite original
  eyeWhite: string;
  eyePupil: string;
  text: string;
  square: boolean; // retro: segmentos y ojos cuadrados a 2 px
};
const PALETTES: Record<SkinId, Palette> = {
  clasico: {
    bg: "#07070f",
    grid: "rgba(255,255,255,0.08)",
    body: (f) => `hsl(${135 - 25 * f} 100% ${60 - 28 * f}%)`,
    glow: 14,
    glowColor: "#39ff14",
    fruitGlow: 0,
    fruitGlowColor: "#000",
    fruitTint: null,
    eyeWhite: "#fff",
    eyePupil: "#07070f",
    text: "#fff",
    square: false,
  },
  neon: {
    bg: "#05050a",
    grid: "#1a1a2e",
    body: (f) => `hsl(${183 + 3 * f} ${100 - 13 * f}% ${50 - 17 * f}%)`, // #00f5ff → #0a8f9c
    glow: 12,
    glowColor: "#00f5ff",
    fruitGlow: 10,
    fruitGlowColor: "#ff006e",
    fruitTint: null,
    eyeWhite: "#ffffff",
    eyePupil: "#05050a",
    text: "#e6e9ff",
    square: false,
  },
  retro: {
    bg: "#061406",
    grid: "#14381c",
    body: (_f, i) => (i === 0 ? "#33ff66" : "#1f9a40"),
    glow: 0,
    glowColor: "#000",
    fruitGlow: 0,
    fruitGlowColor: "#000",
    fruitTint: "#d98a00",
    eyeWhite: "#d8ffd8",
    eyePupil: "#061406",
    text: "#33ff66",
    square: true,
  },
};
const q2 = (v: number) => Math.round(v / 2) * 2; // cuantiza a 2 px (retro)
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const wrap = (v: number, n: number) => (v + n) % n;
export const startSerpentina: GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
  skin: SkinId = "clasico",
): EngineHandle => {
  const ctx = canvas.getContext("2d")!;
  const pal = PALETTES[skin];
  const tint: HTMLCanvasElement | null = null; // spritesheet en silueta (retro)
  const tintColor = "";
  const img = new Image();
  let loaded = false;
  // ── Estado ──────────────────────────────────────────────────────────────────
  let state = "ready" as State;
  let score = 0;
  let dir: Dir = "right";
  let queue: Dir[] = [];
  let acc = 0; // ms acumulados hacia el siguiente tick
  const cy = Math.floor(ROWS / 2);
  const cx = Math.floor(COLS / 2);
  let snake: Cell[] = Array.from({ length: START_LENGTH }, (_, i) => ({
    x: cx - i,
    y: cy,
  })); // cabeza en [0]
  let prev = snake; // posiciones del tick anterior, para interpolar
  let fruit: { cell: Cell; key: FruitKey } | null = null;
  let lastScore = -1;
  // Silueta monocroma del spritesheet (retro); se descarta si el skin no la usa
  const buildTint = () => {
    if (pal.fruitTint === null || !loaded) {
      tint = null;
      return;
    }
    if (tint && tintColor === pal.fruitTint) return;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const t = c.getContext("2d")!;
    t.drawImage(img, 0, 0);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = pal.fruitTint;
    t.fillRect(0, 0, c.width, c.height);
    tint = c;
    tintColor = pal.fruitTint;
  };
  const sync = () => {
    if (score !== lastScore) {
      lastScore = score;
      events.onScore(score);
    }
  };
  const finish = () => {
    if (state === "over") return;
    state = "over";
    stop();
    if (loaded) draw();
    sync();
    events.onGameOver(score);
  };
  // ── Reglas ──────────────────────────────────────────────────────────────────
  // Devuelve false si el tablero está lleno (no queda celda libre)
  const spawnFruit = () => {
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    if (free.length === 0) {
      fruit = null;
      return false;
    }
    fruit = {
      cell: free[Math.floor(Math.random() * free.length)],
      key: FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)],
    };
    return true;
  };
  const step = () => {
    if (queue.length > 0) dir = queue.shift()!;
    const d = DELTA[dir];
    const head = {
      x: wrap(snake[0].x + d.x, COLS),
      y: wrap(snake[0].y + d.y, ROWS),
    };
    const eats = fruit !== null && same(head, fruit.cell);
    // La cola se libera antes de comprobar la mordida (salvo si come: la serpiente crece)
    const body = eats ? snake : snake.slice(0, -1);
    if (body.some((c) => same(c, head))) return finish(); // el tick fatal no se dibuja
    prev = snake;
    snake = [head, ...body];
    if (eats) {
      score += POINTS_PER_FRUIT;
      if (!spawnFruit()) {
        sync();
        finish(); // tablero lleno: victoria
      }
    }
  };
  // ── Dibujado ────────────────────────────────────────────────────────────────
  // Estilo slither.io: segmentos redondos solapados, gradiente, brillo y ojos.
  // La lógica es de rejilla; aquí se interpola entre `prev` y `snake` con la fracción del tick.
  const drawSnake = () => {
    const t = state === "playing" ? acc / TICK_MS : 0;
    const pts = snake.map((c, i) => {
      const p = prev[i] ?? prev[prev.length - 1];
      // Al cruzar un borde (salto > 1 celda) no se interpola
      const k = Math.abs(c.x - p.x) > 1 || Math.abs(c.y - p.y) > 1 ? 1 : t;
      return {
        x: (p.x + (c.x - p.x) * k + 0.5) * CELL,
        y: (p.y + (c.y - p.y) * k + 0.5) * CELL,
      };
    });
    const color = (i: number) => {
      const f = i / Math.max(1, pts.length - 1);
      return pal.body(f, i);
    };
    ctx.save();
    ctx.shadowColor = pal.glowColor;
    ctx.shadowBlur = pal.glow;
    ctx.lineCap = "round";
    for (let i = pts.length - 1; i >= 0; i--) {
      const r = i === 0 ? HEAD_R : BODY_R;
      ctx.fillStyle = color(i);
      if (pal.square)
        ctx.fillRect(q2(pts[i].x - r), q2(pts[i].y - r), 2 * r, 2 * r);
      else {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      const next = pts[i + 1];
      // Conector hacia el segmento siguiente para solapar; se omite al cruzar un borde
      if (
        next &&
        Math.hypot(next.x - pts[i].x, next.y - pts[i].y) < CELL * 1.6
      ) {
        if (pal.square) {
          const x0 = Math.min(pts[i].x, next.x) - BODY_R;
          const y0 = Math.min(pts[i].y, next.y) - BODY_R;
          ctx.fillRect(
            q2(x0),
            q2(y0),
            Math.abs(next.x - pts[i].x) + 2 * BODY_R,
            Math.abs(next.y - pts[i].y) + 2 * BODY_R,
          );
          continue;
        }
        ctx.strokeStyle = color(i);
        ctx.lineWidth = BODY_R * 2;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Ojos orientados en la dirección de avance
    const d = DELTA[dir];
    const h = pts[0];
    for (const side of [-1, 1]) {
      const ex = h.x + d.x * 8 - d.y * 8 * side;
      const ey = h.y + d.y * 8 + d.x * 8 * side;
      ctx.fillStyle = pal.eyeWhite;
      if (pal.square) {
        ctx.fillRect(q2(ex - 5), q2(ey - 5), 10, 10);
        ctx.fillStyle = pal.eyePupil;
        ctx.fillRect(q2(ex + d.x * 2 - 2), q2(ey + d.y * 2 - 2), 4, 4);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.eyePupil;
      ctx.beginPath();
      ctx.arc(ex + d.x * 2, ey + d.y * 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const draw = () => {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pal.grid;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
    if (fruit && loaded) {
      const s = FRUITS[fruit.key];
      const dh = FRUIT_H;
      const dw = (s.w * dh) / s.h;
      ctx.save();
      if (pal.fruitGlow > 0) {
        ctx.shadowColor = pal.fruitGlowColor;
        ctx.shadowBlur = pal.fruitGlow;
      }
      ctx.imageSmoothingEnabled = pal.fruitTint === null;
      ctx.drawImage(
        tint ?? img,
        s.x,
        s.y,
        s.w,
        s.h,
        fruit.cell.x * CELL + (CELL - dw) / 2,
        fruit.cell.y * CELL + (CELL - dh) / 2,
        dw,
        dh,
      );
      ctx.restore();
    }
    drawSnake();
    if (state === "ready") {
      ctx.fillStyle = pal.text;
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("PULSA UNA FLECHA PARA EMPEZAR", W / 2, 500);
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
    const next = KEY_DIRS[e.code];
    if (!next) return;
    if (PAGE_KEYS.includes(e.code)) e.preventDefault();
    if (!running || state === "over") return; // en pausa o terminada no se juega
    const ref = queue.length > 0 ? queue[queue.length - 1] : dir;
    if (next === OPPOSITE[ref]) return; // sin reversa instantánea
    if (state === "ready") state = "playing"; // la primera tecla válida inicia la partida
    if (next === ref || queue.length >= MAX_QUEUE) return;
    queue.push(next);
  };
  const onBlur = () => {
    queue = [];
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  // ── Loop ────────────────────────────────────────────────────────────────────
  let raf = 0;
  let last: number | null = null;
  let running = false;
  let paused = false;
  let destroyed = false;
  const loop = (t: number) => {
    const dtMs = last === null ? 0 : Math.min(t - last, MAX_DT_MS);
    last = t;
    if (state === "playing") {
      acc += dtMs;
      if (acc >= TICK_MS) {
        acc -= TICK_MS;
        step();
      }
    }
    sync();
    if (state === "over") return; // finish() ya dibujó el último frame
    draw();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || state === "over" || !loaded) return;
    last = null; // evita un dt grande tras pausa
    running = true;
    raf = requestAnimationFrame(loop);
  };
  function stop() {
    cancelAnimationFrame(raf);
    running = false;
  }
  events.onLives(1);
  events.onLevel(1);
  spawnFruit();
  img.onload = () => {
    if (destroyed) return;
    loaded = true;
    buildTint();
    draw();
    if (!paused) start();
  };
  img.onerror = () => console.error("No se pudo cargar el spritesheet");
  img.src = SPRITE_URL;
  return {
    setSkin: (s: SkinId) => {
      pal = PALETTES[s];
      buildTint();
    },
    pause: () => {
      paused = true;
      stop();
    },
    resume: () => {
      paused = false;
      start();
    },
    end: finish,
    destroy: () => {
      destroyed = true;
      stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    },
  };
};
