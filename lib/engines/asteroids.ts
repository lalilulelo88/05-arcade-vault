import type { EngineEvents, EngineHandle, GameEngine, SkinId } from "./types";
const W = 800;
const H = 600;
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño
type Palette = {
  bg: string;
  ship: string;
  asteroid: string;
  bullet: string;
  powerUp: string;
  flame: string;
  particle: string; // "r,g,b" para componer el alpha
  glow: { ship: number; asteroid: number; bullet: number; powerUp: number }; // shadowBlur en px, 0 = sin glow
  lineWidth: number; // trazo de nave y asteroides
  pixel: boolean; // redondeo a 2 px, uniones miter, balas cuadradas
};
const NO_GLOW = { ship: 0, asteroid: 0, bullet: 0, powerUp: 0 };
const PALETTES: Record<SkinId, Palette> = {
  clasico: {
    bg: "#000",
    ship: "#fff",
    asteroid: "#fff",
    bullet: "#fff",
    powerUp: "#0ff",
    flame: "rgba(255, 130, 0, 0.85)",
    particle: "255,255,255",
    glow: NO_GLOW,
    lineWidth: 1.5,
    pixel: false,
  },
  neon: {
    bg: "#05050a",
    ship: "#00f5ff",
    asteroid: "#ff006e",
    bullet: "#f5ff00",
    powerUp: "#00ff88",
    flame: "#ff8a00",
    particle: "230,233,255",
    glow: { ship: 10, asteroid: 6, bullet: 8, powerUp: 8 },
    lineWidth: 1.5,
    pixel: false,
  },
  retro: {
    bg: "#061406",
    ship: "#33ff66",
    asteroid: "#2ea84f",
    bullet: "#d8ffd8",
    powerUp: "#ffb000",
    flame: "#ffb000",
    particle: "46,168,79",
    glow: NO_GLOW,
    lineWidth: 2,
    pixel: true,
  },
};
export const startAsteroids: GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
  skin: SkinId = "clasico",
): EngineHandle => {
  const ctx = canvas.getContext("2d")!;
  let pal = PALETTES[skin] ?? PALETTES.clasico;
  const snap = (v: number) => (pal.pixel ? Math.round(v / 2) * 2 : v);
  const glow = (color: string, blur: number) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  };
  // ── Input ───────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  // Evita el scroll de la página (y el clic en botones enfocados) sin tocar los campos de texto
  const GAME_KEYS = ["ArrowLeft", "ArrowUp", "ArrowRight", "Space"];
  const blocksPage = (e: KeyboardEvent) =>
    GAME_KEYS.includes(e.code) &&
    !(
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    );

  const onKeyDown = (e: KeyboardEvent) => {
    if (blocksPage(e)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (blocksPage(e)) e.preventDefault();
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const pressed = (code: string) => {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  };
  // ── Entidades ───────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;
    constructor(x: number, y: number, angle: number) {
      const SPEED = 520;
      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }
    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
    draw() {
      ctx.save();
      ctx.fillStyle = pal.bullet;
      glow(pal.bullet, pal.glow.bullet);
      if (pal.pixel) {
        ctx.fillRect(snap(this.x) - 1, snap(this.y) - 1, 3, 3);
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed = rand(-1.2, 1.2);
    rot = rand(0, Math.PI * 2);
    verts: [number, number][] = [];
    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];
      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }
    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }
    draw() {
      ctx.save();
      ctx.translate(snap(this.x), snap(this.y));
      ctx.rotate(this.rot);
      ctx.strokeStyle = pal.asteroid;
      glow(pal.asteroid, pal.glow.asteroid);
      ctx.lineWidth = pal.lineWidth;
      ctx.lineJoin = pal.pixel ? "miter" : "round";
      ctx.beginPath();
      ctx.moveTo(snap(this.verts[0][0]), snap(this.verts[0][1]));
      for (let i = 1; i < this.verts.length; i++)
        ctx.lineTo(snap(this.verts[i][0]), snap(this.verts[i][1]));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }
  class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius = 12;
    ttl = POWERUP_TTL;
    dead = false;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }
    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
    draw() {
      if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
      const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
      ctx.save();
      ctx.translate(snap(this.x), snap(this.y));
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = pal.powerUp;
      glow(pal.powerUp, pal.glow.powerUp);
      ctx.lineWidth = 2;
      ctx.lineJoin = pal.pixel ? "miter" : "round";
      const r = this.radius * pulse;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.fillStyle = pal.powerUp; // texto sin glow
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3x", this.x, this.y);
    }
  }
  class Ship {
    x = W / 2;
    y = H / 2;
    angle = -Math.PI / 2;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 3;
    shootCooldown = 0;
    dead = false;
    tripleShot = 0;
    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }
    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;
      const ROT = 3.5; // rad/s
      const THRUST = 260; // px/s²
      const DRAG = 0.987;
      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;
      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }
      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }
    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        return [
          new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }
    draw() {
      if (this.dead) return;
      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
        return;
      ctx.save();
      ctx.translate(snap(this.x), snap(this.y));
      ctx.rotate(this.angle);
      ctx.strokeStyle = pal.ship;
      glow(pal.ship, pal.glow.ship);
      ctx.lineWidth = pal.lineWidth;
      ctx.lineJoin = pal.pixel ? "miter" : "round";
      // Silueta clásica: triángulo con muesca trasera
      ctx.beginPath();
      ctx.moveTo(20, 0); // nariz
      ctx.lineTo(-12, -9); // ala izquierda
      ctx.lineTo(-7, 0); // muesca trasera
      ctx.lineTo(-12, 9); // ala derecha
      ctx.closePath();
      ctx.stroke();
      // Llama del propulsor (sin glow)
      ctx.shadowBlur = 0;
      if (this.thrusting && Math.random() > 0.35) {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = pal.flame;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life = rand(0.4, 1.1);
    ttl = this.life;
    dead = false;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }
    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }
    draw() {
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = `rgba(${pal.particle},${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }
  // ── Estado ──────────────────────────────────────────────────────────────────
  const ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: "playing" | "dead" | "gameover" = "playing";
  let deadTimer = 0;
  let finished = false; // onGameOver se emite una sola vez
  const setScore = (v: number) => {
    if (v === score) return;
    score = v;
    events.onScore(score);
  };
  const setLives = (v: number) => {
    if (v === lives) return;
    lives = v;
    events.onLives(lives);
  };
  const setLevel = (v: number) => {
    if (v === level) return;
    level = v;
    events.onLevel(level);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    state = "gameover";
    events.onGameOver(score);
  };
  const spawnAsteroids = (count: number) => {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  };
  const nextLevel = () => {
    setLevel(level + 1);
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  };
  const explode = (x: number, y: number, count = 8) => {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  };
  const killShip = () => {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    setLives(lives - 1);
    if (lives <= 0) {
      finish();
    } else {
      state = "dead";
      deadTimer = 2;
    }
  };
  spawnAsteroids(4);
  // ── Update ──────────────────────────────────────────────────────────────────
  const update = (dt: number) => {
    if (state === "gameover") return;
    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }
    if (pressed("Space")) bullets.push(...ship.tryShoot());
    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));
    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }
    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          setScore(score + POINTS[a.size]);
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);
    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }
    // Nivel completado
    if (state === "playing" && asteroids.length === 0) nextLevel();
  };
  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = () => {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerUps.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();
    // Único texto en el canvas: el HUD de la plataforma cubre el resto
    if (ship.tripleShot > 0) {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = pal.powerUp;
      ctx.font = "15px monospace";
      ctx.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 26);
    }
  };
  // ── Loop ────────────────────────────────────────────────────────────────────
  let raf = 0;
  let lastTime: number | null = null;
  let running = false;
  const loop = (ts: number) => {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    // update() puede terminar la partida: se congela el último frame
    raf = state === "gameover" ? 0 : requestAnimationFrame(loop);
    running = raf !== 0;
  };
  const start = () => {
    if (running || state === "gameover") return;
    lastTime = null; // evita un dt grande tras pausa
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    running = false;
  };
  start();
  return {
    pause: stop,
    resume: start,
    end: () => {
      stop();
      finish();
    },
    setSkin: (next) => {
      pal = PALETTES[next] ?? PALETTES.clasico;
    },
    destroy: () => {
      stop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
};
