"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type User = { name: string };

type Session = {
  user: User | null;
  login: (user: User | null) => void;
  signOut: () => void;
};

const KEY = "av_user";
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Invitado hasta montar: evita desajustes de hidratación con localStorage.
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de localStorage tras montar
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const login = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch {}
  }, []);

  const signOut = useCallback(() => login(null), [login]);

  const value = useMemo(() => ({ user, login, signOut }), [user, login, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
