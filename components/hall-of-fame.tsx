"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GAMES } from "@/lib/games";
import { createClient } from "@/lib/supabase/client";

type LeaderRow = { name: string; score: number; created_at: string };
// El resultado lleva el juego al que pertenece: si no coincide con la pestaña activa, se considera "cargando".
type Result = { game: string; rows: LeaderRow[]; error: boolean };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtScore = (n: number) => n.toLocaleString("es-ES");

export function HallOfFame() {
  const [tab, setTab] = useState(GAMES[0].id);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let stale = false;
    createClient()
      .from("scores")
      .select("name, score, created_at")
      .eq("game_id", tab)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(12)
      .then(({ data, error }) => {
        if (!stale) setResult({ game: tab, rows: data ?? [], error: !!error });
      });
    return () => {
      stale = true;
    };
  }, [tab]);

  const loading = result?.game !== tab;
  const rows = loading ? [] : result.rows;
  const error = !loading && result.error;
  const podium = rows.slice(0, 3);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button key={g.id} className={"chip" + (tab === g.id ? " active" : "")} onClick={() => setTab(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      {loading || error || rows.length === 0 ? (
        <div className="hall-status pixel" role={error ? "alert" : "status"}>
          {loading ? "CARGANDO PUNTAJES…" : error ? "NO SE PUDO CARGAR EL SALÓN. INTÉNTALO DE NUEVO." : "SIN PUNTAJES TODAVÍA"}
        </div>
      ) : (
        <>
          <div className="podium">
            {podium[1] ? (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{podium[1].name}</div>
                <div className="score">{fmtScore(podium[1].score)}</div>
                <div className="date">{fmtDate(podium[1].created_at)}</div>
              </div>
            ) : (
              <div className="podium-empty" aria-hidden />
            )}
            <div className="podium-slot gold">
              <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>CAMPEÓN</div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>01</div>
              <div className="name">{podium[0].name}</div>
              <div className="score" style={{ fontSize: 20 }}>{fmtScore(podium[0].score)}</div>
              <div className="date">{fmtDate(podium[0].created_at)}</div>
            </div>
            {podium[2] ? (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{podium[2].name}</div>
                <div className="score">{fmtScore(podium[2].score)}</div>
                <div className="date">{fmtDate(podium[2].created_at)}</div>
              </div>
            ) : (
              <div className="podium-empty" aria-hidden />
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={`${tab}-${i}`}
                className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{fmtScore(r.score)}</div>
                <div className="dt">{fmtDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/games">VOLVER A LA BIBLIOTECA</Link>
      </div>
    </div>
  );
}
