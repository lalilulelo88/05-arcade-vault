"use client";
import { useState } from "react";
const TOTAL_POKEMON = 1025;
export default function ContadorPage() {
  const [count, setCount] = useState(0);
  // ponytail: el sprite sale de la PokeAPI por número; vuelve a 1 tras el 1025
  const id = ((count - 1) % TOTAL_POKEMON) + 1;
  return (
    <div className="fade-in flex flex-col items-center gap-6 py-12">
      <div className="kicker pixel neon-yellow">▸ CONTADOR</div>
      <div className="pixel text-6xl neon-cyan" aria-live="polite">
        {count}
      </div>
      <div className="flex h-72 w-72 items-center justify-center">
        {count > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`}
            alt={`Pokémon número ${id}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="pixel text-sm">HAZ CLIC PARA EMPEZAR</span>
        )}
      </div>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="pixel border-2 border-current px-8 py-4 text-xl hover:opacity-80"
      >
        +1
      </button>
    </div>
  );
}
