"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
const COOLDOWN = 60;
const errorStyle = {
  color: "var(--magenta)",
  fontSize: 12,
  marginTop: 10,
  lineHeight: 1.5,
} as const;
const noticeStyle = {
  color: "var(--green)",
  fontSize: 13,
  lineHeight: 1.6,
} as const;
export function authError(error: { code?: string; message: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Debes confirmar tu correo antes de entrar.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "weak_password":
      return "La contraseña es demasiado débil.";
    default:
      return "No se pudo completar la operación. Inténtalo de nuevo.";
  }
}
function validate(
  tab: "in" | "up",
  username: string,
  email: string,
  pass: string,
) {
  if (tab === "up" && !/^[A-Za-z0-9_]{3,10}$/.test(username))
    return "El usuario debe tener 3–10 caracteres (letras, números o _).";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Introduce un correo válido.";
  if (pass.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}
export function AuthForm({ linkError = false }: { linkError?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "El enlace no es válido o ha caducado." : null,
  );
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // correo al que se envió la confirmación
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const switchTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
    setUnconfirmed(false);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate(tab, username, email, pass);
    if (invalid) return setError(invalid);
    setError(null);
    setUnconfirmed(false);
    setBusy(true);
    const supabase = createClient();
    if (tab === "in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      setBusy(false);
      if (error) {
        setUnconfirmed(error.code === "email_not_confirmed");
        return setError(authError(error));
      }
      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { username } },
      });
      setBusy(false);
      if (error) return setError(authError(error));
      // Si el correo ya existe Supabase no lo revela: se muestra el mismo aviso.
      setPending(email);
      setCooldown(COOLDOWN);
    }
  };
  const resend = async (to: string) => {
    setError(null);
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: to,
    });
    if (error) return setError(authError(error));
    setPending(to);
    setCooldown(COOLDOWN);
  };
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>
        {pending ? (
          <div role="status" style={{ marginTop: 18 }}>
            <p style={noticeStyle}>
              Te enviamos un correo de confirmación a <strong>{pending}</strong>
              . Ábrelo y pulsa el enlace para activar tu cuenta.
            </p>
            {error && (
              <p role="alert" style={errorStyle}>
                {error}
              </p>
            )}
            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", marginTop: 14 }}
              disabled={cooldown > 0}
              onClick={() => resend(pending)}
            >
              {cooldown > 0
                ? `REENVIAR CORREO (${cooldown}s)`
                : "REENVIAR CORREO"}
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => {
                setPending(null);
                switchTab("in");
              }}
            >
              VOLVER A INICIAR SESIÓN
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                type="button"
                className={tab === "in" ? "on" : ""}
                onClick={() => switchTab("in")}
              >
                INICIAR SESIÓN
              </button>
              <button
                type="button"
                className={tab === "up" ? "on" : ""}
                onClick={() => switchTab("up")}
              >
                CREAR CUENTA
              </button>
            </div>
            <form onSubmit={submit} noValidate>
              {tab === "up" && (
                <div className="field slide-in">
                  <label htmlFor="av-user">Usuario</label>
                  <input
                    id="av-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="px_kai"
                    maxLength={10}
                    autoComplete="username"
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="av-email">Correo electrónico</label>
                <input
                  id="av-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label htmlFor="av-pass">Contraseña</label>
                <input
                  id="av-pass"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    tab === "in" ? "current-password" : "new-password"
                  }
                />
              </div>
              {error && (
                <p role="alert" style={errorStyle}>
                  {error}
                </p>
              )}
              {unconfirmed && (
                <button
                  type="button"
                  className="btn ghost"
                  style={{ width: "100%", marginTop: 10 }}
                  disabled={cooldown > 0}
                  onClick={() => resend(email)}
                >
                  {cooldown > 0
                    ? `REENVIAR CORREO (${cooldown}s)`
                    : "REENVIAR CORREO DE CONFIRMACIÓN"}
                </button>
              )}
              <button
                className="btn lg"
                type="submit"
                disabled={busy}
                style={{ width: "100%", marginTop: 8 }}
              >
                {busy
                  ? "ENVIANDO…"
                  : tab === "in"
                    ? "ENTRAR AL VAULT"
                    : "CREAR CUENTA"}
              </button>
            </form>
            {tab === "in" && (
              <div style={{ marginTop: 12, textAlign: "center", fontSize: 12 }}>
                <Link href="/auth/recuperar" style={{ color: "var(--cyan)" }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}
            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", marginTop: 14 }}
              onClick={() => router.push("/")}
            >
              JUGAR COMO INVITADO
            </button>
          </>
        )}
        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
