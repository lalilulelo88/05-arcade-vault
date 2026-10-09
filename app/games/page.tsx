import type { Metadata } from "next";
import { Library } from "@/components/library";
import { ENGINES } from "@/lib/engines";
import { getBestScores } from "@/lib/scores";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function GamesPage() {
  const best = await getBestScores(Object.keys(ENGINES));
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>
      <Library best={best} />
    </div>
  );
}
