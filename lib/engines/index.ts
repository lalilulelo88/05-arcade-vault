import { startAsteroids } from "./asteroids";
import { startTetris } from "./tetris";
import type { EngineEntry } from "./types";
export const ENGINES: Record<string, EngineEntry> = {
  asteroids: { start: startAsteroids, width: 800, height: 600 },
  caida: { start: startTetris, width: 480, height: 600 },
};
