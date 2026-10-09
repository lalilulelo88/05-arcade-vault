import type { EngineEvents, EngineHandle, GameEngine } from "./types";
const W = 800;
const H = 600;
const SPRITE_URL = "/games/arkanoid/spritesheet-breakout.png";
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_SPEED = 500;
const MAX_LEVEL = 10;
const BALL_R = 8;
const START_BALLS = 3;
const EXTRA_BALL_EVERY = 2000; // puntos
const BANNER_MS = 1500;
const BALL_SPEED = 360; // px/s, constante
const COLS = 10;
const MIN_ROWS = 4;
const MAX_ROWS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const GRID_X = 80;
const GRID_Y = 60;
const POINTS_PER_HIT = 10;
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60° desde la vertical
const LAUNCH_ANGLE = Math.PI / 6; // 30° desde la vertical, hacia la derecha
const EXPLOSION_MS = 150;
const MAX_DT = 1 / 30;
// Evita el scroll de la página sin tocar los campos de texto
const PAGE_KEYS = ["ArrowLeft", "ArrowRight", "Space"];
type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";
const COLORS: BlockColor[] = [
  "gray",
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
];
type Rect = { sx: number; sy: number; sw: number; sh: number };
const rect = (sx: number, sy: number, sw: number, sh: number): Rect => ({
  sx,
  sy,
  sw,
  sh,
});
// Atlas de spritesheet-breakout.png (coordenadas del original)
const SPRITE_PADDLE = rect(32, 112, 162, 14);
const SPRITE_BALL = rect(32, 32, 16, 16);
const SPRITE_GRAY_LIGHT = rect(32, 288, 32, 16); // gris tras el primer golpe
const BLOCK_Y: Record<Exclude<BlockColor, "gray">, number> = {
  red: 176,
  cyan: 192,
  green: 208,
  magenta: 224,
  yellow: 240,
  hotpink: 256,
};
const blockSprite = (color: BlockColor, hits: number): Rect => {
  if (color === "gray")
    return hits === 1 ? SPRITE_GRAY_LIGHT : rect(64, 288, 32, 16);
  return rect(32, BLOCK_Y[color], 32, 16);
};
// 4 frames por color; el gris reutiliza los del rojo
const explosionFrame = (color: BlockColor, i: number): Rect =>
  rect(256 + 32 * i, BLOCK_Y[color === "gray" ? "red" : color], 32, 16);
type Block = {
  x: number;
  y: number;
  color: BlockColor;
  hits: number;
  exploding: boolean;
  explodeLeft: number; // ms
};
type Ball = { x: number; y: number; vx: number; vy: number; r: number };
// Plantillas: ¿hay bloque en la fila r (de `rows`) y columna c?
const SHAPES: ((r: number, c: number, rows: number) => boolean)[] = [
  () => true, // rect
  (r, c, rows) => Math.abs(c + 0.5 - COLS / 2) < (((r + 1) / rows) * COLS) / 2, // pyramid
  (r, c, rows) =>
    Math.abs(c + 0.5 - COLS / 2) <
    ((1 - Math.abs((2 * (r + 0.5)) / rows - 1)) * COLS) / 2, // diamond
  (r, c) => (r + c) % 2 === 0, // checker
  (r) => r % 2 === 0, // stripes
  (r, c, rows) => r === 0 || r === rows - 1 || c === 0 || c === COLS - 1, // frame
];
const randomInt = (n: number) => Math.floor(Math.random() * n);
// Nivel aleatorio: forma y filas al azar, color al azar por bloque
const generateLevel = (): Block[] => {
  let blocks: Block[];
  do {
    const has = SHAPES[randomInt(SHAPES.length)];
    const rows = MIN_ROWS + randomInt(MAX_ROWS - MIN_ROWS + 1);
    blocks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!has(r, c, rows)) continue;
        const color = COLORS[randomInt(COLORS.length)];
        blocks.push({
          x: GRID_X + c * BLOCK_W,
          y: GRID_Y + r * BLOCK_H,
          color,
          hits: color === "gray" ? 2 : 1,
          exploding: false,
          explodeLeft: 0,
        });
      }
    }
  } while (blocks.length === 0); // una forma puede dejar la rejilla vacía
  return blocks;
};
const newBall = (): Ball => ({ x: 0, y: 0, vx: 0, vy: 0, r: BALL_R });
type State = "ready" | "playing" | "over";
export const startArkanoid: GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
): EngineHandle => {
  const ctx = canvas.getContext("2d")!;
  // ── Estado ──────────────────────────────────────────────────────────────────
  let state = "ready" as State;
  let score = 0;
  let ballsLeft = START_BALLS; // reserva (incluye la bola en juego)
  let level = 1;
  let nextExtraAt = EXTRA_BALL_EVERY;
  let banner = { text: "NIVEL 1", left: BANNER_MS };
  let blocks = generateLevel();
  let balls: Ball[] = [newBall()];
  const paddle = {
    x: (W - PADDLE_W) / 2,
    y: H - 40,
    w: PADDLE_W,
    h: PADDLE_H,
  };
  const keys: Record<string, boolean> = {};
  // ── Eventos (solo cuando el valor cambia) ───────────────────────────────────
  let sentScore = -1;
  let sentLives = -1;
  let sentLevel = -1;
  const sync = () => {
    if (score !== sentScore) events.onScore((sentScore = score));
    if (ballsLeft !== sentLives) events.onLives((sentLives = ballsLeft));
    if (level !== sentLevel) events.onLevel((sentLevel = level));
  };
  sync();
  const finish = () => {
    if (state === "over") return;
    state = "over";
    stop();
    if (loaded) draw();
    sync();
    events.onGameOver(score);
  };
  // ── Reglas ──────────────────────────────────────────────────────────────────
  const stickBall = () => {
    balls[0].x = paddle.x + paddle.w / 2;
    balls[0].y = paddle.y - balls[0].r;
  };
  const startLevel = () => {
    blocks = generateLevel();
    balls = [newBall()];
    banner = { text: `NIVEL ${level}`, left: BANNER_MS };
    state = "ready";
    stickBall();
  };
  const launch = () => {
    balls[0].vx = BALL_SPEED * Math.sin(LAUNCH_ANGLE);
    balls[0].vy = -BALL_SPEED * Math.cos(LAUNCH_ANGLE);
    state = "playing";
  };
  // Resta un golpe ya aplicado: si el bloque se rompe, arranca su explosión
  const afterBlockHit = (bl: Block) => {
    if (bl.hits > 0) return;
    bl.exploding = true;
    bl.explodeLeft = EXPLOSION_MS;
  };
  // Mueve una bola y resuelve sus colisiones; devuelve false si cae por abajo
  const updateBall = (b: Ball, dt: number) => {
    const p = paddle;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
    } else if (b.x + b.r > W) {
      b.x = W - b.r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
    }
    if (b.y - b.r > H) return false;
    // Paleta: el ángulo depende del punto de impacto (centro = vertical, borde = 60°)
    if (
      b.vy > 0 &&
      b.y + b.r >= p.y &&
      b.y - b.r <= p.y + p.h &&
      b.x >= p.x - b.r &&
      b.x <= p.x + p.w + b.r
    ) {
      const hit = Math.max(
        -1,
        Math.min(1, (b.x - (p.x + p.w / 2)) / (p.w / 2)),
      );
      const angle = hit * MAX_BOUNCE_ANGLE;
      b.vx = BALL_SPEED * Math.sin(angle);
      b.vy = -BALL_SPEED * Math.cos(angle);
      b.y = p.y - b.r;
    }
    // Bloques: se invierte el eje con menor penetración; un bloque por frame
    for (const bl of blocks) {
      if (bl.exploding) continue;
      const cx = Math.max(bl.x, Math.min(b.x, bl.x + BLOCK_W));
      const cy = Math.max(bl.y, Math.min(b.y, bl.y + BLOCK_H));
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 >= b.r ** 2) continue;
      const penX = Math.min(b.x + b.r - bl.x, bl.x + BLOCK_W - (b.x - b.r));
      const penY = Math.min(b.y + b.r - bl.y, bl.y + BLOCK_H - (b.y - b.r));
      if (penX < penY) {
        const left = b.x < bl.x + BLOCK_W / 2;
        b.x = left ? bl.x - b.r : bl.x + BLOCK_W + b.r;
        b.vx = left ? -Math.abs(b.vx) : Math.abs(b.vx);
      } else {
        const top = b.y < bl.y + BLOCK_H / 2;
        b.y = top ? bl.y - b.r : bl.y + BLOCK_H + b.r;
        b.vy = top ? -Math.abs(b.vy) : Math.abs(b.vy);
      }
      bl.hits--;
      score += POINTS_PER_HIT;
      afterBlockHit(bl);
      break;
    }
    return true;
  };
  const update = (dt: number) => {
    banner.left = Math.max(0, banner.left - dt * 1000);
    // while: si un golpe supera varios umbrales a la vez, se dan todas las bolas
    while (score >= nextExtraAt) {
      ballsLeft++;
      nextExtraAt += EXTRA_BALL_EVERY;
      banner = { text: "+1 BOLA", left: BANNER_MS };
    }
    const dir =
      (keys.ArrowRight || keys.KeyD ? 1 : 0) -
      (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    paddle.x = Math.max(
      0,
      Math.min(W - paddle.w, paddle.x + dir * PADDLE_SPEED * dt),
    );
    if (state === "ready") {
      stickBall();
      return;
    }
    balls = balls.filter((b) => updateBall(b, dt));
    if (balls.length === 0) {
      ballsLeft--;
      if (ballsLeft > 0) {
        balls = [newBall()];
        state = "ready";
        stickBall();
      } else finish();
      return;
    }
    for (const bl of blocks) if (bl.exploding) bl.explodeLeft -= dt * 1000;
    blocks = blocks.filter((bl) => !bl.exploding || bl.explodeLeft > 0);
    if (blocks.length === 0) {
      if (level === MAX_LEVEL) finish();
      else {
        level++;
        startLevel();
      }
    }
  };
  // ── Dibujo ──────────────────────────────────────────────────────────────────
  const img = new Image();
  let loaded = false;
  const sprite = (s: Rect, x: number, y: number, w: number, h: number) =>
    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, x, y, w, h);
  const draw = () => {
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, W, H);
    for (const bl of blocks) {
      if (bl.exploding) {
        // EXPLOSION_MS se reparte entre los 4 frames
        const i = Math.min(
          3,
          Math.floor(((EXPLOSION_MS - bl.explodeLeft) / EXPLOSION_MS) * 4),
        );
        sprite(explosionFrame(bl.color, i), bl.x, bl.y, BLOCK_W, BLOCK_H);
      } else {
        sprite(blockSprite(bl.color, bl.hits), bl.x, bl.y, BLOCK_W, BLOCK_H);
      }
    }
    sprite(SPRITE_PADDLE, paddle.x, paddle.y, paddle.w, paddle.h);
    for (const b of balls)
      sprite(SPRITE_BALL, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    ctx.textAlign = "center";
    if (banner.left > 0) {
      ctx.globalAlpha = Math.min(1, banner.left / 300);
      ctx.fillStyle = "#ffd60a";
      ctx.font = "bold 32px monospace";
      ctx.fillText(banner.text, W / 2, 420);
      ctx.globalAlpha = 1;
    }
    if (state === "ready") {
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText("ESPACIO PARA LANZAR", W / 2, 500);
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
    if (PAGE_KEYS.includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (!running || state === "over") return; // en pausa o terminada no se juega
    if (e.code === "Space" && state === "ready") launch();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  const onBlur = () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  // ── Loop ────────────────────────────────────────────────────────────────────
  let raf = 0;
  let last: number | null = null;
  let running = false;
  let paused = false;
  let destroyed = false;
  const loop = (t: number) => {
    const dt = last === null ? 0 : Math.min((t - last) / 1000, MAX_DT);
    last = t;
    update(dt);
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
  img.onload = () => {
    if (destroyed) return;
    loaded = true;
    stickBall();
    draw();
    if (!paused) start();
  };
  img.onerror = () => console.error("No se pudo cargar el spritesheet");
  img.src = SPRITE_URL;
  return {
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
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
};
