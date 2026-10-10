"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ENGINES } from "@/lib/engines";
import type { EngineEntry, EngineHandle, SkinId } from "@/lib/engines/types";
import type { Game } from "@/lib/games";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "./session-provider";
const LIVES = 3;
const SKINNED = ["asteroids", "serpentina"]; // juegos con selector de skin
const SKINS: { id: SkinId; label: string }[] = [
  { id: "clasico", label: "CLÁSICO" },
  { id: "neon", label: "NEÓN" },
  { id: "retro", label: "RETRO" },
];
const skinKey = (gameId: string) => `av_skin_${gameId}`;
const CANVAS_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain", // un canvas de otra proporción queda centrado en la pantalla 4:3
} as const;
export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(LIVES);
  const [run, setRun] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const skinRef = useRef<SkinId>("clasico"); // skin inicial al (re)crear el motor
  const entry = ENGINES[game.id] as EngineEntry | undefined;
  const startEngine = entry?.start;
  const skinned = SKINNED.includes(game.id);
  const [skin, setSkin] = useState<SkinId>("clasico");
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  // La sesión se resuelve tras montar: se usa hasta que el jugador edite sus iniciales.
  const name = edited ?? user?.name ?? "INVITADO";
  useEffect(() => {
    if (!startEngine || !canvasRef.current) return;
    const handle = startEngine(
      canvasRef.current,
      {
        onScore: setScore,
        onLives: setLives,
        onLevel: setLevel,
        onGameOver: (final) => {
          setScore(final);
          setOver(true);
        },
      },
      skinRef.current,
    );
    engineRef.current = handle;
    return () => {
      handle.destroy();
      engineRef.current = null;
    };
  }, [startEngine, run]);
  // Skin guardado: se lee tras montar para evitar desajuste de hidratación
  useEffect(() => {
    if (!skinned) return;
    try {
      const saved = localStorage.getItem(skinKey(game.id));
      const found = SKINS.find((s) => s.id === saved);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage tras montar
      if (found) setSkin(found.id);
    } catch {}
  }, [skinned, game.id]);
  useEffect(() => {
    skinRef.current = skin;
    engineRef.current?.setSkin?.(skin); // sin reiniciar la partida
  }, [skin, run, startEngine]);
  const pickSkin = (next: SkinId) => {
    setSkin(next);
    try {
      localStorage.setItem(skinKey(game.id), next);
    } catch {}
  };
  useEffect(() => {
    if (startEngine || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [startEngine, over, paused]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- comportamiento heredado del template
    if (!startEngine && score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [startEngine, score]);
  const restart = () => {
    setScore(0);
    setLevel(1);
    setLives(LIVES);
    setRun((r) => r + 1);
    setPaused(false);
    setOver(false);
    setSaveState("idle");
  };
  const togglePause = () => {
    if (paused) engineRef.current?.resume();
    else engineRef.current?.pause();
    setPaused(!paused);
  };
  const finish = () => {
    if (engineRef.current) engineRef.current.end();
    else setOver(true);
  };
  const save = async () => {
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    try {
      const { error } = await createClient()
        .from("scores")
        .insert({ game_id: game.id, name, score });
      setSaveState(error ? "error" : "saved");
    } catch {
      setSaveState("error");
    }
  };
  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          {skinned &&
            SKINS.map((s) => (
              <button
                key={s.id}
                className={skin === s.id ? "btn" : "btn ghost"}
                aria-pressed={skin === s.id}
                onClick={() => pickSkin(s.id)}
              >
                {s.label}
              </button>
            ))}
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={finish}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>
      <div className="crt">
        <div className="crt-screen">
          {startEngine ? (
            <canvas
              key={run}
              ref={canvasRef}
              width={entry?.width}
              height={entry?.height}
              style={CANVAS_STYLE}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>
      {over && (
        <div className="modal-bd">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="av-over-title"
          >
            <h2 id="av-over-title">FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {saveState !== "saved" ? (
              <>
                <div className="input-row">
                  <input
                    value={name}
                    onChange={(e) =>
                      setEdited(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="TUS INICIALES"
                    disabled={saveState === "saving"}
                  />
                  <button
                    className="btn yellow"
                    onClick={save}
                    disabled={saveState === "saving"}
                  >
                    {saveState === "saving"
                      ? "GUARDANDO…"
                      : saveState === "error"
                        ? "REINTENTAR"
                        : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveState === "error" && (
                  <div className="save-error" role="alert">
                    ▸ NO SE PUDO GUARDAR. REVISA TU CONEXIÓN E INTÉNTALO DE
                    NUEVO.
                  </div>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/games">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
