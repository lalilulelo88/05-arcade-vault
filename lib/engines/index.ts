import { startAsteroids } from "./asteroids";
import type { EngineEntry } from "./types";
export const ENGINES: Record<string, EngineEntry> = {
  asteroids: { start: startAsteroids, width: 800, height: 600 },
};
