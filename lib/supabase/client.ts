import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
// Las referencias a process.env deben ser literales para que Next las inyecte en el bundle del cliente.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url)
    throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
  if (!key)
    throw new Error(
      "Falta la variable de entorno NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  return { url, key };
}
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}
