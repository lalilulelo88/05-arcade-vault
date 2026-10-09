import { createClient } from "@/lib/supabase/server";
export type LeaderRow = { name: string; score: number; created_at: string };
// Mejor puntaje por juego (0 si no hay puntajes o la consulta falla).
export async function getBestScores(
  ids: string[],
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const best = await Promise.all(
    ids.map(async (id) => {
      const { data } = await supabase
        .from("scores")
        .select("score")
        .eq("game_id", id)
        .order("score", { ascending: false })
        .limit(1);
      return [id, data?.[0]?.score ?? 0] as const;
    }),
  );
  return Object.fromEntries(best);
}
// Top 10 y total de partidas guardadas de un juego.
export async function getGameBoard(
  id: string,
): Promise<{ top: LeaderRow[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("scores")
    .select("name, score, created_at", { count: "exact" })
    .eq("game_id", id)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);
  return { top: data ?? [], total: count ?? 0 };
}
