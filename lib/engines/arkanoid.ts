import type { EngineEvents, EngineHandle, GameEngine, SkinId } from "./types";
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
const PARTICLE_COUNT = 24;
const PARTICLE_MS = 500;
const POWERUP_DROP_CHANCE = 0.25;
const POWERUP_W = 40;
const POWERUP_H = 20;
const POWERUP_FALL_SPEED = 150; // px/s
const X3_ANGLES = [-40, 0, 40]; // grados desde la vertical, hacia arriba
const SB_MS = 15000;
const LASER_MS = 20000;
const LASER_COOLDOWN_MS = 300;
const LASER_SPEED = 600; // px/s
const LASER_W = 4;
const LASER_H = 14;
const XL_MIN_MS = 30000;
const XL_MAX_MS = 40000;
type PowerupType = "XL" | "X3" | "L" | "SB";
const POWERUP_TYPES: PowerupType[] = ["XL", "X3", "L", "SB"];
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
type Palette = {
  sprites: boolean; // true = spritesheet (clasico); false = vectorial
  bg: string;
  paddle: string;
  ball: string;
  ballPierce: string[] | null; // SB: parpadeo entre tonos; null = arcoíris
  blocks: Record<BlockColor, string>; // solo vectorial
  laser: string;
  powerup: Record<PowerupType, string>;
  powerupText: string;
  particles: string[];
  banner: string;
  hint: string;
  glow: number; // shadowBlur en px, 0 = sin glow
  pixel: boolean; // enteros, bola cuadrada, cápsulas rectas, trazo 2 px
};
const PALETTES: Record<SkinId, Palette> = {
  clasico: {
    sprites: true,
    bg: "#2b2b2b",
    paddle: "#fff",
    ball: "#fff",
    ballPierce: null,
    blocks: {} as Palette["blocks"], // sin uso: clasico dibuja el spritesheet
    laser: "#ff3b30",
    powerup: { XL: "#e53935", X3: "#1e88e5", L: "#fdd835", SB: "#43a047" },
    powerupText: "#000",
    particles: ["#fff", "#ffd60a", "#ff9f0a", "#ff453a"],
    banner: "#ffd60a",
    hint: "#fff",
    glow: 0,
    pixel: false,
  },
  neon: {
    sprites: false,
    bg: "#05050a",
    paddle: "#00f5ff",
    ball: "#ffffff",
    ballPierce: null,
    blocks: {
      gray: "#7a7a99",
      red: "#ff8a00",
      yellow: "#f5ff00",
      cyan: "#4d6dff",
      magenta: "#b266ff",
      hotpink: "#ff006e",
      green: "#00ff88",
    },
    laser: "#00f5ff",
    powerup: { XL: "#ff8a00", X3: "#00f5ff", L: "#ff006e", SB: "#00ff88" },
    powerupText: "#05050a",
    particles: ["#ffffff", "#f5ff00", "#ff8a00", "#ff006e"],
    banner: "#f5ff00",
    hint: "#e6e9ff",
    glow: 10,
    pixel: false,
  },
  retro: {
    sprites: false,
    bg: "#061406",
    paddle: "#33ff66",
    ball: "#ffb000",
    ballPierce: ["#ffb000", "#d8ffd8"],
    blocks: {
      gray: "#d8ffd8",
      red: "#2ea84f",
      yellow: "#2ea84f",
      green: "#2ea84f",
      cyan: "#7fbf7f",
      magenta: "#7fbf7f",
      hotpink: "#7fbf7f",
    },
    laser: "#ffb000",
    powerup: { XL: "#ffb000", X3: "#ffb000", L: "#ffb000", SB: "#ffb000" },
    powerupText: "#061406",
    particles: ["#d8ffd8", "#ffb000", "#33ff66", "#2ea84f"],
    banner: "#ffb000",
    hint: "#d8ffd8",
    glow: 0,
    pixel: true,
  },
};
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
type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  piercing?: boolean;
};
type Powerup = { type: PowerupType; x: number; y: number };
type Laser = { x: number; y: number }; // y = parte superior
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};
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
  skin?: SkinId,
): EngineHandle => {
  const ctx = canvas.getContext("2d")!;
  let pal = PALETTES[skin ?? "clasico"];
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
  let particles: Particle[] = [];
  let powerups: Powerup[] = [];
  let lasers: Laser[] = [];
  // ms restantes; 0 = inactivo
  const fx = { xlLeft: 0, sbLeft: 0, laserLeft: 0, laserCooldown: 0 };
  let sbBall = null as Ball | null;
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
  // Cambia el ancho de la paleta manteniendo su centro y sin salirse del canvas
  const setPaddleWidth = (w: number) => {
    paddle.x = Math.max(0, Math.min(W - w, paddle.x + (paddle.w - w) / 2));
    paddle.w = w;
  };
  const endSB = () => {
    if (sbBall) sbBall.piercing = false;
    fx.sbLeft = 0;
    sbBall = null;
  };
  // Quita cápsulas, rayos y efectos, y devuelve la paleta a su ancho normal
  const resetEffects = () => {
    powerups = [];
    lasers = [];
    fx.xlLeft = fx.sbLeft = fx.laserLeft = fx.laserCooldown = 0;
    sbBall = null;
    setPaddleWidth(PADDLE_W);
  };
  const applyPowerup = (type: PowerupType) => {
    if (type === "XL" && fx.xlLeft === 0) {
      fx.xlLeft = XL_MIN_MS + Math.random() * (XL_MAX_MS - XL_MIN_MS);
      setPaddleWidth(PADDLE_W * 2);
    } else if (type === "X3") {
      const { x, y } = balls[0];
      for (const deg of X3_ANGLES) {
        const a = (deg * Math.PI) / 180;
        balls.push({
          ...newBall(),
          x,
          y,
          vx: BALL_SPEED * Math.sin(a),
          vy: -BALL_SPEED * Math.cos(a),
        });
      }
    } else if (type === "SB") {
      endSB(); // un SB nuevo traslada el efecto a la bola más baja y reinicia los 15 s
      sbBall = balls.reduce((a, c) => (c.y > a.y ? c : a));
      sbBall.piercing = true;
      fx.sbLeft = SB_MS;
    } else if (type === "L") {
      fx.laserLeft = LASER_MS;
    }
  };
  const fireLaser = () => {
    if (fx.laserLeft <= 0 || fx.laserCooldown > 0) return;
    fx.laserCooldown = LASER_COOLDOWN_MS;
    lasers.push(
      { x: paddle.x + 4, y: paddle.y - LASER_H },
      { x: paddle.x + paddle.w - 4 - LASER_W, y: paddle.y - LASER_H },
    );
  };
  // Avanza los rayos; cada uno resta 1 golpe al bloque más bajo que toca y desaparece
  const updateLasers = (dt: number) => {
    lasers = lasers.filter((l) => {
      l.y -= LASER_SPEED * dt;
      let target: Block | null = null;
      for (const bl of blocks) {
        if (
          bl.exploding ||
          l.x + LASER_W <= bl.x ||
          l.x >= bl.x + BLOCK_W ||
          l.y + LASER_H <= bl.y ||
          l.y >= bl.y + BLOCK_H
        )
          continue;
        if (!target || bl.y > target.y) target = bl;
      }
      if (target) {
        target.hits--;
        score += POINTS_PER_HIT;
        afterBlockHit(target);
        return false;
      }
      return l.y + LASER_H > 0;
    });
  };
  // Ráfaga de partículas hacia arriba desde el borde inferior, donde cayó la bola
  const explodeBall = (b: Ball) => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = -Math.random() * Math.PI;
      const v = 80 + Math.random() * 220;
      particles.push({
        x: b.x,
        y: H - 2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: PARTICLE_MS,
        color: pal.particles[i % 4],
      });
    }
  };
  const startLevel = () => {
    resetEffects();
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
    if (Math.random() < POWERUP_DROP_CHANCE) {
      powerups.push({
        type: POWERUP_TYPES[randomInt(POWERUP_TYPES.length)],
        x: bl.x + (BLOCK_W - POWERUP_W) / 2,
        y: bl.y + (BLOCK_H - POWERUP_H) / 2,
      });
    }
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
    if (b.y - b.r > H) {
      explodeBall(b);
      return false;
    }
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
      if (b.piercing) {
        // SB: destruye el bloque entero sin rebotar
        score += POINTS_PER_HIT * bl.hits;
        bl.hits = 0;
      } else {
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
      }
      afterBlockHit(bl);
      if (!b.piercing) break;
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
    for (const q of particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt * 1000;
    }
    particles = particles.filter((q) => q.life > 0);
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
      resetEffects();
      if (ballsLeft > 0) {
        balls = [newBall()];
        state = "ready";
        stickBall();
      } else finish();
      return;
    }
    for (const pu of powerups) pu.y += POWERUP_FALL_SPEED * dt;
    powerups = powerups.filter((pu) => {
      const caught =
        pu.y + POWERUP_H >= paddle.y &&
        pu.y <= paddle.y + paddle.h &&
        pu.x + POWERUP_W >= paddle.x &&
        pu.x <= paddle.x + paddle.w;
      if (caught) applyPowerup(pu.type);
      return !caught && pu.y < H;
    });
    if (fx.xlLeft > 0) {
      fx.xlLeft = Math.max(0, fx.xlLeft - dt * 1000);
      if (fx.xlLeft === 0) setPaddleWidth(PADDLE_W);
    }
    if (fx.sbLeft > 0) {
      fx.sbLeft -= dt * 1000;
      if (fx.sbLeft <= 0 || !sbBall || !balls.includes(sbBall)) endSB();
    }
    fx.laserLeft = Math.max(0, fx.laserLeft - dt * 1000);
    fx.laserCooldown = Math.max(0, fx.laserCooldown - dt * 1000);
    updateLasers(dt);
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
  // Glow acotado a un solo dibujo; shadowBlur vuelve a 0 al terminar
  const glowing = (color: string, fn: () => void) => {
    if (pal.glow > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = pal.glow;
    }
    fn();
    ctx.shadowBlur = 0;
  };
  const px = (v: number) => (pal.pixel ? Math.round(v) : v);
  // Bloque vectorial: gris = relleno con 2 golpes, solo borde con 1
  const vectorBlock = (bl: Block) => {
    const x = px(bl.x) + 1;
    const y = px(bl.y) + 1;
    const w = BLOCK_W - 2;
    const h = BLOCK_H - 2;
    const c = pal.blocks[bl.color];
    ctx.lineWidth = pal.pixel ? 2 : 1;
    if (bl.color === "gray" && bl.hits === 1) {
      ctx.strokeStyle = c;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      return;
    }
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(x, y, w, 2); // borde superior más claro
  };
  const draw = () => {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    for (const bl of blocks) {
      if (bl.exploding) {
        // EXPLOSION_MS se reparte entre los 4 frames
        const i = Math.min(
          3,
          Math.floor(((EXPLOSION_MS - bl.explodeLeft) / EXPLOSION_MS) * 4),
        );
        if (pal.sprites)
          sprite(explosionFrame(bl.color, i), bl.x, bl.y, BLOCK_W, BLOCK_H);
        else {
          ctx.globalAlpha = 1 - i / 4;
          ctx.fillStyle = "#fff";
          ctx.fillRect(px(bl.x) + 1, px(bl.y) + 1, BLOCK_W - 2, BLOCK_H - 2);
          ctx.globalAlpha = 1;
        }
      } else if (pal.sprites) {
        sprite(blockSprite(bl.color, bl.hits), bl.x, bl.y, BLOCK_W, BLOCK_H);
      } else vectorBlock(bl);
    }
    if (pal.sprites)
      sprite(SPRITE_PADDLE, paddle.x, paddle.y, paddle.w, paddle.h);
    else {
      ctx.fillStyle = pal.paddle;
      glowing(pal.paddle, () =>
        ctx.fillRect(px(paddle.x), px(paddle.y), px(paddle.w), paddle.h),
      );
    }
    for (const b of balls) {
      const color = b.piercing
        ? pal.ballPierce
          ? pal.ballPierce[Math.floor(performance.now() / 100) % 2]
          : `hsl(${(performance.now() / 4) % 360}, 100%, 60%)` // SB: colores cambiantes
        : pal.ball;
      if (pal.sprites && !b.piercing) {
        sprite(SPRITE_BALL, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        continue;
      }
      ctx.fillStyle = color;
      glowing(color, () => {
        if (pal.pixel)
          ctx.fillRect(px(b.x - b.r), px(b.y - b.r), b.r * 2, b.r * 2);
        else {
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
    for (const q of particles) {
      ctx.globalAlpha = q.life / PARTICLE_MS;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.laser;
    for (const l of lasers)
      glowing(pal.laser, () =>
        ctx.fillRect(px(l.x), px(l.y), LASER_W, LASER_H),
      );
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const pu of powerups) {
      ctx.fillStyle = pal.powerup[pu.type];
      glowing(pal.powerup[pu.type], () => {
        if (pal.pixel) ctx.fillRect(px(pu.x), px(pu.y), POWERUP_W, POWERUP_H);
        else {
          ctx.beginPath();
          ctx.roundRect(pu.x, pu.y, POWERUP_W, POWERUP_H, 10);
          ctx.fill();
        }
      });
      ctx.fillStyle = pal.powerupText;
      ctx.fillText(pu.type, pu.x + POWERUP_W / 2, pu.y + POWERUP_H / 2 + 1);
    }
    ctx.textBaseline = "alphabetic";
    // Efectos con tiempo activos, abajo a la izquierda
    const active: [PowerupType, number][] = [
      ["XL", fx.xlLeft],
      ["L", fx.laserLeft],
      ["SB", fx.sbLeft],
    ];
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    active
      .filter(([, ms]) => ms > 0)
      .forEach(([name, ms], i) => {
        ctx.fillStyle = pal.powerup[name];
        ctx.fillText(`${name} ${Math.ceil(ms / 1000)}s`, 10, H - 10 - i * 20);
      });
    ctx.textAlign = "center";
    if (banner.left > 0) {
      ctx.globalAlpha = Math.min(1, banner.left / 300);
      ctx.fillStyle = pal.banner;
      ctx.font = "bold 32px monospace";
      ctx.fillText(banner.text, W / 2, 420);
      ctx.globalAlpha = 1;
    }
    if (state === "ready") {
      ctx.fillStyle = pal.hint;
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
    if (e.code !== "Space") return;
    if (state === "ready") launch();
    else if (!e.repeat) fireLaser();
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
    setSkin: (next) => {
      pal = PALETTES[next];
    },
    destroy: () => {
      destroyed = true;
      stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
};
