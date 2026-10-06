import { startAsteroids } from "./asteroids";
import type { GameEngine } from "./types";
export const ENGINES: Record<string, GameEngine> = {
  asteroids: startAsteroids,
};
