"use client";
import { useCallback, useEffect, useRef } from "react";
type PadButton = {
  code: string; // KeyboardEvent.code que reconoce el motor
  key: string; // KeyboardEvent.key
  label: string; // texto visible
  aria: string; // aria-label en español
  repeat?: boolean; // reemite keydown mientras se mantiene (Caída)
  area: "move" | "action";
};
const arrow = (
  dir: "Up" | "Down" | "Left" | "Right",
  label: string,
  aria: string,
  repeat?: boolean,
): PadButton => ({
  code: `Arrow${dir}`,
  key: `Arrow${dir}`,
  label,
  aria,
  repeat,
  area: "move",
});
const action = (
  code: string,
  key: string,
  label: string,
  aria: string,
): PadButton => ({ code, key, label, aria, area: "action" });
const LEFT = arrow("Left", "◀", "Izquierda");
const RIGHT = arrow("Right", "▶", "Derecha");
const FIRE = action("Space", " ", "DISPARAR", "Disparar");
const PADS: Record<string, PadButton[]> = {
  serpentina: [
    arrow("Up", "▲", "Arriba"),
    LEFT,
    arrow("Down", "▼", "Abajo"),
    RIGHT,
  ],
  caida: [
    { ...LEFT, repeat: true },
    { ...RIGHT, repeat: true },
    arrow("Down", "▼", "Bajada suave", true),
    { ...action("Space", " ", "▲", "Caída directa"), area: "move" },
    action("ArrowUp", "ArrowUp", "ROTAR", "Rotar pieza"),
    action("KeyC", "c", "GUARDAR", "Guardar pieza"),
  ],
  arkanoid: [LEFT, RIGHT, FIRE],
  asteroids: [
    LEFT,
    RIGHT,
    action("ArrowUp", "ArrowUp", "EMPUJE", "Empuje"),
    FIRE,
  ],
};
const REPEAT_DELAY = 220; // ms hasta el primer auto-repeat
const REPEAT_EVERY = 90; // ms entre repeticiones
const emit = (type: "keydown" | "keyup", b: PadButton, repeat = false) =>
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code: b.code,
      key: b.key,
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
// Botonera táctil: traduce toques a eventos de teclado en `window`, que es lo único que leen los motores.
export function TouchControls({
  gameId,
  active,
}: {
  gameId: string;
  active: boolean; // false en pausa o fin de partida: no responde y suelta lo pulsado
}) {
  const pad = PADS[gameId];
  const held = useRef(new Map<string, () => void>()); // code → soltar (keyup + limpiar timers)
  const press = useCallback(
    (b: PadButton) => {
      if (!active || held.current.has(b.code)) return;
      emit("keydown", b);
      let delay: ReturnType<typeof setTimeout> | undefined;
      let every: ReturnType<typeof setInterval> | undefined;
      if (b.repeat) {
        delay = setTimeout(() => {
          every = setInterval(() => emit("keydown", b, true), REPEAT_EVERY);
        }, REPEAT_DELAY);
      }
      held.current.set(b.code, () => {
        clearTimeout(delay);
        clearInterval(every);
        emit("keyup", b);
      });
    },
    [active],
  );
  const release = useCallback((b: PadButton) => {
    held.current.get(b.code)?.();
    held.current.delete(b.code);
  }, []);
  useEffect(() => {
    const map = held.current;
    const releaseAll = () => {
      map.forEach((stop) => stop());
      map.clear();
    };
    if (!active) releaseAll();
    return releaseAll;
  }, [active]);
  if (!pad) return null;
  const render = (area: PadButton["area"]) =>
    pad
      .filter((b) => b.area === area)
      .map((b) => (
        <button
          key={b.code}
          type="button"
          className="tc-btn"
          data-code={b.code}
          aria-label={b.aria}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            press(b);
          }}
          onPointerUp={() => release(b)}
          onPointerCancel={() => release(b)}
          onLostPointerCapture={() => release(b)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {b.label}
        </button>
      ));
  return (
    <div className="touch-pad" data-game={gameId}>
      <div className="tc-move">{render("move")}</div>
      <div className="tc-action">{render("action")}</div>
    </div>
  );
}
