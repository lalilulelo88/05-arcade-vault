const W = 800, H = 600;
const PADDLE_W = 81, PADDLE_H = 14;
const MAX_LEVEL = 10;
const BALL_R = 8;
const START_BALLS = 3;
const PARTICLE_COUNT = 24, PARTICLE_MS = 500;
const EXTRA_BALL_EVERY = 2000;          // puntos
const BANNER_MS = 1500;
const MAX_BALL_ICONS = 6;               // a partir de aquí el HUD muestra un icono y ×N
const BALL_SPEED = 360;                 // px/s, constante
const COLS = 10, MIN_ROWS = 4, MAX_ROWS = 10; // 10 filas * 24 = 240 px → hasta y = 300
const BLOCK_W = 64, BLOCK_H = 24;
const GRID_X = 80, GRID_Y = 60;         // 10 * 64 = 640 → margen lateral de 80
const POINTS_PER_HIT = 10;
const HIGHSCORE_KEY = 'arkanoid.highscore';
const COLORS = ['gray', 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
const MAX_BOUNCE_ANGLE = Math.PI / 3;   // 60° desde la vertical
const LAUNCH_ANGLE = Math.PI / 6;       // 30° desde la vertical, hacia la derecha
const POWERUP_DROP_CHANCE = 0.25;
const POWERUP_TYPES = ['XL', 'X3', 'L', 'SB'];
const POWERUP_COLORS = { XL: '#e53935', X3: '#1e88e5', L: '#fdd835', SB: '#43a047' };
const POWERUP_W = 40, POWERUP_H = 20;
const POWERUP_FALL_SPEED = 150;         // px/s
const X3_ANGLES = [-40, 0, 40];         // grados desde la vertical, hacia arriba
const SB_MS = 15000;
const LASER_MS = 20000;
const LASER_COOLDOWN_MS = 300;
const LASER_SPEED = 600;                // px/s
const LASER_W = 4, LASER_H = 14;
const XL_MIN_MS = 30000, XL_MAX_MS = 40000;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// localStorage puede estar bloqueado o tener un valor corrupto: en ese caso el récord vale 0
function loadHighScore() {
  try {
    const n = Number(localStorage.getItem(HIGHSCORE_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function endGame(state) {
  game.state = state;
  if (game.score > game.highScore) {
    game.highScore = game.score;
    try { localStorage.setItem(HIGHSCORE_KEY, String(game.highScore)); } catch {}
  }
}

// Plantillas: ¿hay bloque en la fila r (de `rows`) y columna c?
const SHAPES = {
  rect: () => true,
  pyramid: (r, c, rows) => Math.abs(c + 0.5 - COLS / 2) < (r + 1) / rows * COLS / 2,
  diamond: (r, c, rows) => Math.abs(c + 0.5 - COLS / 2) < (1 - Math.abs(2 * (r + 0.5) / rows - 1)) * COLS / 2,
  checker: (r, c) => (r + c) % 2 === 0,
  stripes: r => r % 2 === 0,
  frame: (r, c, rows) => r === 0 || r === rows - 1 || c === 0 || c === COLS - 1,
};

// Nivel aleatorio: forma y número de filas al azar, color al azar por bloque
function generateLevel() {
  const names = Object.keys(SHAPES);
  let blocks;
  do {
    const has = SHAPES[names[Math.floor(Math.random() * names.length)]];
    const rows = MIN_ROWS + Math.floor(Math.random() * (MAX_ROWS - MIN_ROWS + 1));
    blocks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!has(r, c, rows)) continue;
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        blocks.push({ x: GRID_X + c * BLOCK_W, y: GRID_Y + r * BLOCK_H, color,
                      hits: color === 'gray' ? 2 : 1, exploding: false, explodeStart: 0 });
      }
    }
  } while (blocks.length === 0); // una forma puede dejar la rejilla vacía
  return blocks;
}

const newBall = () => ({ x: 0, y: 0, vx: 0, vy: 0, r: BALL_R });

const game = {
  state: 'ready',        // 'ready' | 'playing' | 'paused' | 'gameover' | 'won'
  score: 0,
  highScore: loadHighScore(), // entero leído de localStorage
  ballsLeft: START_BALLS, // reserva de bolas (incluye la que está en juego)
  level: 1,
  nextExtraAt: EXTRA_BALL_EVERY, // siguiente umbral de puntos para bola extra
  banner: { text: 'NIVEL 1', left: BANNER_MS }, // aviso temporal en pantalla (ms restantes)
  particles: [],         // explosión de bola perdida: { x, y, vx, vy, life, color }
  menuIndex: 0,          // opción del menú de pausa: 0 = volumen, 1 = sonido
  blocks: generateLevel(),
  paddle: { x: (W - PADDLE_W) / 2, y: H - 40, w: PADDLE_W, h: PADDLE_H, speed: 500 },
  balls: [newBall()],
  powerups: [],          // cápsulas cayendo: { type, x, y }
  lasers: [],            // rayos en vuelo: { x, y } (y = parte superior)
  effects: { xlLeft: 0, sbLeft: 0, sbBall: null, laserLeft: 0, laserCooldown: 0 }, // ms restantes; 0 = inactivo
};

const SOUND_BOUNCE = new Audio('assets/sounds/ball-bounce.mp3');
const SOUND_BREAK = new Audio('assets/sounds/break-sound.mp3');

const DEFAULT_VOLUME = 0.1;
const VOLUME_STEP = 0.1;
const SETTINGS_KEY = 'arkanoid.settings'; // JSON { volume, muted }

function loadSettings() {
  const s = { volume: DEFAULT_VOLUME, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved && Number.isFinite(saved.volume)) s.volume = Math.min(1, Math.max(0, saved.volume));
    if (saved && typeof saved.muted === 'boolean') s.muted = saved.muted;
  } catch (e) { /* localStorage bloqueado o JSON corrupto: valores por defecto */ }
  return s;
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* sin persistencia */ }
}

const settings = loadSettings();

// Se clona el Audio para que los sonidos seguidos no se corten entre sí
function playSound(sound) {
  if (settings.muted) return;
  const clone = sound.cloneNode();
  clone.volume = settings.volume;
  clone.play().catch(() => {}); // el navegador puede rechazar play() sin interacción previa
}

const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (game.state === 'ready' && e.code === 'Space') launchBall();
  else if (game.state === 'playing' && e.code === 'Space' && !e.repeat) fireLaser();
  else if ((game.state === 'gameover' || game.state === 'won') && (e.code === 'Space' || e.code === 'Enter')) resetGame();
  if (e.code === 'KeyP' && !e.repeat) {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  }
  if (game.state === 'paused') menuKey(e);
});

// Menú de pausa: ↑/↓ cambian de opción; ←/→ ajustan el volumen o alternan el sonido; Enter alterna el sonido
function menuKey(e) {
  const dir = e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0;
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
    e.preventDefault();
    game.menuIndex = 1 - game.menuIndex;
  } else if (game.menuIndex === 0 && dir) {
    settings.volume = Math.min(1, Math.max(0, Math.round((settings.volume + dir * VOLUME_STEP) * 10) / 10));
    saveSettings();
  } else if (game.menuIndex === 1 && (dir || e.code === 'Enter')) {
    settings.muted = !settings.muted;
    saveSettings();
  }
}
addEventListener('keyup', e => { keys[e.code] = false; });

function stickBallToPaddle() {
  const { paddle: p } = game, b = game.balls[0];
  b.x = p.x + p.w / 2;
  b.y = p.y - b.r;
}

// Quita cápsulas, rayos y efectos, y devuelve la paleta a su ancho normal
function resetEffects() {
  game.powerups = [];
  game.lasers = [];
  game.effects = { xlLeft: 0, sbLeft: 0, sbBall: null, laserLeft: 0, laserCooldown: 0 };
  setPaddleWidth(PADDLE_W);
}

function resetGame() {
  game.score = 0;
  game.ballsLeft = START_BALLS;
  game.nextExtraAt = EXTRA_BALL_EVERY;
  game.level = 1;
  startLevel();
}

// Bloques nuevos, efectos limpios y una sola bola pegada a la paleta; puntos y reserva se conservan
function startLevel() {
  resetEffects();
  game.blocks = generateLevel();
  game.balls = [newBall()];
  game.banner = { text: 'NIVEL ' + game.level, left: BANNER_MS };
  game.state = 'ready';
}

function launchBall() {
  const b = game.balls[0];
  b.vx = BALL_SPEED * Math.sin(LAUNCH_ANGLE);
  b.vy = -BALL_SPEED * Math.cos(LAUNCH_ANGLE);
  game.state = 'playing';
}

// Sonido y explosión tras restar golpes a un bloque; si se rompe, puede soltar un power-up
function afterBlockHit(bl) {
  if (bl.hits > 0) {
    playSound(SOUND_BOUNCE);
    return;
  }
  bl.exploding = true;
  bl.explodeStart = performance.now();
  playSound(SOUND_BREAK);
  if (Math.random() < POWERUP_DROP_CHANCE) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    game.powerups.push({ type, x: bl.x + (BLOCK_W - POWERUP_W) / 2, y: bl.y + (BLOCK_H - POWERUP_H) / 2 });
  }
}

function fireLaser() {
  const fx = game.effects, p = game.paddle;
  if (fx.laserLeft <= 0 || fx.laserCooldown > 0) return;
  fx.laserCooldown = LASER_COOLDOWN_MS;
  game.lasers.push({ x: p.x + 4, y: p.y - LASER_H }, { x: p.x + p.w - 4 - LASER_W, y: p.y - LASER_H });
}

// Avanza los rayos; cada uno resta 1 golpe al bloque más bajo que toca y desaparece
function updateLasers(dt) {
  game.lasers = game.lasers.filter(l => {
    l.y -= LASER_SPEED * dt;
    let target = null;
    for (const bl of game.blocks) {
      if (bl.exploding || l.x + LASER_W <= bl.x || l.x >= bl.x + BLOCK_W || l.y + LASER_H <= bl.y || l.y >= bl.y + BLOCK_H) continue;
      if (!target || bl.y > target.y) target = bl;
    }
    if (target) {
      target.hits--;
      game.score += POINTS_PER_HIT;
      afterBlockHit(target);
      return false;
    }
    return l.y + LASER_H > 0;
  });
}

// Mueve una bola y resuelve sus colisiones; devuelve false si cae por debajo del canvas
// Ráfaga de partículas hacia arriba desde el borde inferior, en la x donde cayó la bola
function explodeBall(b) {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const a = -Math.random() * Math.PI, v = 80 + Math.random() * 220;
    game.particles.push({ x: b.x, y: H - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: PARTICLE_MS,
                          color: ['#fff', '#ffd60a', '#ff9f0a', '#ff453a'][i % 4] });
  }
  playSound(SOUND_BREAK);
}

function updateParticles(dt) {
  for (const q of game.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt * 1000; }
  game.particles = game.particles.filter(q => q.life > 0);
}

function updateBall(b, dt) {
  const p = game.paddle;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); playSound(SOUND_BOUNCE); }
  else if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); playSound(SOUND_BOUNCE); }
  if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); playSound(SOUND_BOUNCE); }

  if (b.y - b.r > H) { explodeBall(b); return false; }

  // Paleta: el ángulo depende del punto de impacto (centro = vertical, borde = 60°)
  if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + p.h &&
      b.x >= p.x - b.r && b.x <= p.x + p.w + b.r) {
    const hit = Math.max(-1, Math.min(1, (b.x - (p.x + p.w / 2)) / (p.w / 2)));
    const angle = hit * MAX_BOUNCE_ANGLE;
    b.vx = BALL_SPEED * Math.sin(angle);
    b.vy = -BALL_SPEED * Math.cos(angle);
    b.y = p.y - b.r;
    playSound(SOUND_BOUNCE);
  }

  // Bloques: se invierte el eje con menor penetración; un bloque por frame
  for (const bl of game.blocks) {
    if (bl.exploding) continue;
    const cx = Math.max(bl.x, Math.min(b.x, bl.x + BLOCK_W));
    const cy = Math.max(bl.y, Math.min(b.y, bl.y + BLOCK_H));
    if ((b.x - cx) ** 2 + (b.y - cy) ** 2 >= b.r ** 2) continue;

    if (b.piercing) {
      // SB: destruye el bloque entero sin rebotar
      game.score += POINTS_PER_HIT * bl.hits;
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
      game.score += POINTS_PER_HIT;
    }
    afterBlockHit(bl);
    if (!b.piercing) break;
  }
  return true;
}

// Cambia el ancho de la paleta manteniendo su centro y sin salirse del canvas
function setPaddleWidth(w) {
  const p = game.paddle;
  p.x = Math.max(0, Math.min(W - w, p.x + (p.w - w) / 2));
  p.w = w;
}

function endSB() {
  if (game.effects.sbBall) game.effects.sbBall.piercing = false;
  game.effects.sbLeft = 0;
  game.effects.sbBall = null;
}

function applyPowerup(type) {
  if (type === 'XL' && game.effects.xlLeft === 0) {
    game.effects.xlLeft = XL_MIN_MS + Math.random() * (XL_MAX_MS - XL_MIN_MS);
    setPaddleWidth(PADDLE_W * 2);
  } else if (type === 'X3') {
    const { x, y } = game.balls[0];
    for (const deg of X3_ANGLES) {
      const a = deg * Math.PI / 180;
      game.balls.push({ ...newBall(), x, y, vx: BALL_SPEED * Math.sin(a), vy: -BALL_SPEED * Math.cos(a) });
    }
  } else if (type === 'SB') {
    endSB(); // ponytail: un SB nuevo mientras hay otro activo traslada el efecto a la bola más baja y reinicia los 15 s
    const fx = game.effects;
    fx.sbBall = game.balls.reduce((a, c) => (c.y > a.y ? c : a));
    fx.sbBall.piercing = true;
    fx.sbLeft = SB_MS;
  } else if (type === 'L') {
    game.effects.laserLeft = LASER_MS;
  }
}

function update(dt) {
  const p = game.paddle;
  if (game.state === 'paused') return;
  game.banner.left = Math.max(0, game.banner.left - dt * 1000);
  // while: si un golpe supera varios umbrales a la vez, se dan todas las bolas pendientes
  while (game.score >= game.nextExtraAt) {
    game.ballsLeft++;
    game.nextExtraAt += EXTRA_BALL_EVERY;
    game.banner = { text: '+1 BOLA', left: BANNER_MS };
  }
  updateParticles(dt); // también en gameover, para que termine la explosión de la última bola
  if (game.state === 'gameover' || game.state === 'won') return;
  const dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  p.x = Math.max(0, Math.min(W - p.w, p.x + dir * p.speed * dt));

  if (game.state === 'ready') {
    stickBallToPaddle();
    return;
  }

  game.balls = game.balls.filter(b => updateBall(b, dt));
  if (game.balls.length === 0) {
    game.ballsLeft--;
    resetEffects();
    if (game.ballsLeft > 0) {
      game.balls = [newBall()];
      game.state = 'ready';
    } else endGame('gameover');
    return;
  }
  for (const pu of game.powerups) pu.y += POWERUP_FALL_SPEED * dt;
  game.powerups = game.powerups.filter(pu => {
    const caught = pu.y + POWERUP_H >= p.y && pu.y <= p.y + p.h && pu.x + POWERUP_W >= p.x && pu.x <= p.x + p.w;
    if (caught) applyPowerup(pu.type);
    return !caught && pu.y < H;
  });
  if (game.effects.xlLeft > 0) {
    game.effects.xlLeft = Math.max(0, game.effects.xlLeft - dt * 1000);
    if (game.effects.xlLeft === 0) setPaddleWidth(PADDLE_W);
  }
  const fx = game.effects;
  if (fx.sbLeft > 0) {
    fx.sbLeft -= dt * 1000;
    if (fx.sbLeft <= 0 || !game.balls.includes(fx.sbBall)) endSB();
  }
  fx.laserLeft = Math.max(0, fx.laserLeft - dt * 1000);
  fx.laserCooldown = Math.max(0, fx.laserCooldown - dt * 1000);
  updateLasers(dt);
  const now = performance.now();
  game.blocks = game.blocks.filter(bl => !bl.exploding || now - bl.explodeStart < EXPLOSION_DURATION);
  if (game.blocks.length === 0) {
    if (game.level === MAX_LEVEL) endGame('won');
    else { game.level++; startLevel(); }
  }
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '48px monospace';
  ctx.fillText(title, W / 2, H / 2);
  ctx.font = '20px monospace';
  ctx.fillText(subtitle, W / 2, H / 2 + 40);
}

function drawPauseMenu() {
  drawOverlay('PAUSA', 'Pulsa P para continuar');
  const pct = Math.round(settings.volume * 100);
  const items = ['Volumen: ' + '█'.repeat(pct / 10) + '░'.repeat(10 - pct / 10) + ' ' + pct + '%',
                 'Sonido: ' + (settings.muted ? 'OFF' : 'ON')];
  ctx.font = '20px monospace';
  items.forEach((text, i) => {
    ctx.fillStyle = i === game.menuIndex ? '#ffd60a' : '#fff';
    ctx.fillText((i === game.menuIndex ? '> ' : '  ') + text, W / 2, H / 2 + 90 + i * 30);
  });
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('↑/↓ opción · ←/→ cambiar', W / 2, H / 2 + 170);
}

// HUD arriba a la derecha: un icono por bola de reserva, o un icono y ×N si hay muchas
function drawBallsLeft() {
  const n = game.ballsLeft, step = BALL_R * 2 + 4;
  const icons = n > MAX_BALL_ICONS ? 1 : n;
  let x = W - 10;
  if (n > MAX_BALL_ICONS) {
    ctx.textAlign = 'right';
    ctx.fillText('×' + n, x, 30);
    x -= ctx.measureText('×' + n).width + 4;
  }
  for (let i = 0; i < icons; i++) {
    x -= BALL_R * 2;
    drawSprite(ctx, 'ball', x, 30 - BALL_R * 2 + 4, BALL_R * 2, BALL_R * 2);
    x -= step - BALL_R * 2;
  }
  ctx.textAlign = 'right';
  ctx.fillText('Bolas:', x - 2, 30);
}

function draw() {
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(0, 0, W, H);

  const now = performance.now();
  for (const bl of game.blocks) {
    if (bl.exploding) {
      // EXPLOSION_DURATION es la duración total; se reparte entre los 4 frames
      const frames = EXPLOSION_FRAMES[bl.color];
      const i = Math.min(frames.length - 1, Math.floor((now - bl.explodeStart) / EXPLOSION_DURATION * frames.length));
      drawFrame(ctx, frames[i], bl.x, bl.y, BLOCK_W, BLOCK_H);
    } else {
      drawSprite(ctx, 'block_' + (bl.color === 'gray' && bl.hits === 1 ? 'grayLight' : bl.color), bl.x, bl.y, BLOCK_W, BLOCK_H);
    }
  }

  const p = game.paddle;
  drawSprite(ctx, 'paddle', p.x, p.y, p.w, p.h);
  for (const b of game.balls) {
    if (b.piercing) {
      ctx.fillStyle = 'hsl(' + (now / 4) % 360 + ', 100%, 60%)'; // SB: colores cambiantes
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    } else drawSprite(ctx, 'ball', b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }

  for (const q of game.particles) {
    ctx.globalAlpha = q.life / PARTICLE_MS;
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ff3b30';
  for (const l of game.lasers) ctx.fillRect(l.x, l.y, LASER_W, LASER_H);

  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pu of game.powerups) {
    ctx.fillStyle = POWERUP_COLORS[pu.type];
    ctx.beginPath();
    ctx.roundRect(pu.x, pu.y, POWERUP_W, POWERUP_H, 10);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillText(pu.type, pu.x + POWERUP_W / 2, pu.y + POWERUP_H / 2 + 1);
  }
  ctx.textBaseline = 'alphabetic';

  if (game.banner.left > 0) {
    ctx.globalAlpha = Math.min(1, game.banner.left / 300);
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(game.banner.text, W / 2, 420);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#fff';
  ctx.font = '20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Puntos: ' + game.score, 10, 30);
  ctx.textAlign = 'center';
  ctx.fillText('Nivel ' + game.level + '  ·  Récord: ' + game.highScore, W / 2, 30);
  ctx.textAlign = 'right';
  drawBallsLeft();
  // Efectos con tiempo activos, abajo a la izquierda
  const fx = game.effects;
  const active = [['XL', fx.xlLeft], ['L', fx.laserLeft], ['SB', fx.sbLeft]].filter(([, ms]) => ms > 0);
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  active.forEach(([name, ms], i) => {
    ctx.fillStyle = POWERUP_COLORS[name];
    ctx.fillText(name + ' ' + Math.ceil(ms / 1000) + 's', 10, H - 10 - i * 20);
  });

  if (game.state === 'paused') drawPauseMenu();
  else if (game.state === 'gameover') drawOverlay('GAME OVER', 'Espacio o Enter para reiniciar');
  else if (game.state === 'won') drawOverlay('¡VICTORIA!', 'Espacio o Enter para jugar de nuevo');
}

let last = 0;
function frame(t) {
  const dt = Math.min((t - last) / 1000, 1 / 30);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// drawSprite no hace nada hasta que el spritesheet está cargado
loadSpritesheet(() => requestAnimationFrame(t => { last = t; frame(t); }));
