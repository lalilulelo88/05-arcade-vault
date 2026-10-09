import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES } from "@/lib/games";
import { getGameBoard } from "@/lib/scores";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/juegos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  return game ? { title: game.title, description: game.short } : {};
}

export default async function GameDetail({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();
  const { top, total } = await getGameBoard(id);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div><div className="l">Partidas</div><div className="v">{total.toLocaleString("es-ES")}</div></div>
            <div>
              <div className="l">Mejor global</div>
              <div className="v" style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}>
                {(top[0]?.score ?? 0).toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div className="v" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>★ ★ ★ ☆ ☆</div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/jugar/${game.id}`}>▶  JUGAR AHORA</Link>
            <Link className="btn ghost lg" href="/games">VOLVER AL VAULT</Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {top.length === 0 && <div className="lb-row">SIN PUNTAJES TODAVÍA</div>}
          {top.map((r, i) => (
            <div key={i} className={"lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>{new Date(r.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
              </div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
