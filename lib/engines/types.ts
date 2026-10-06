export type EngineEvents = {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // se emite una sola vez por partida
};
export type EngineHandle = {
  pause: () => void;
  resume: () => void;
  end: () => void; // termina la partida (botón FIN): emite onGameOver con el puntaje actual
  destroy: () => void; // detiene el loop y retira listeners
};
export type GameEngine = (
  canvas: HTMLCanvasElement,
  events: EngineEvents,
) => EngineHandle;
