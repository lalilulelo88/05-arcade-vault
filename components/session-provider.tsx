"use client";
import type { User as AuthUser } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
export type User = { name: string };
type Session = {
  user: User | null;
  signOut: () => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);
function toUser(u: AuthUser | null | undefined): User | null {
  if (!u) return null;
  const username = u.user_metadata?.username;
  const name =
    typeof username === "string" && username
      ? username
      : (u.email ?? "").split("@")[0];
  return { name: name.toUpperCase() };
}
export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Invitado hasta montar: evita desajustes de hidratación.
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    try {
      // Limpieza de la sesión simulada anterior.
      localStorage.removeItem("av_user");
    } catch {}
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(toUser(data.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(toUser(session?.user)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, signOut }), [user, signOut]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
