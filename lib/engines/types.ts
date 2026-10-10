export type EngineEvents = {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // se emite una sola vez por partida
};
export type SkinId = "clasico" | "neon" | "retro";
export type EngineHandle = {
  pause: () => void;
  resume: () => void;
  end: () => void; // termina la partida (botón FIN): emite onGameOver con el puntaje actual
  destroy: () => void; // detiene el loop y retira listeners
  setSkin?: (skin: SkinId) => void; // solo motores con skins
};
export type GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
  skin?: SkinId,
) => EngineHandle;
export type EngineEntry = {
  start: GameEngine;
  width: number; // resolución interna del canvas
  height: number;
};
