import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { GAMES } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/jugar/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  return game ? { title: `Jugando ${game.title}` } : {};
}

export default async function PlayPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}
