"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authError } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/client";
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
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{title}</h2>
        </div>
        {children}
        <div style={{ marginTop: 18, textAlign: "center", fontSize: 12 }}>
          <Link href="/auth" style={{ color: "var(--cyan)" }}>
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email))
      return setError("Introduce un correo válido.");
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email);
    setBusy(false);
    if (error) return setError(authError(error));
    setSent(true); // mismo aviso exista o no el correo
  };
  return (
    <Card title="RECUPERAR CONTRASEÑA">
      {sent ? (
        <p role="status" style={{ ...noticeStyle, marginTop: 18 }}>
          Si existe una cuenta con <strong>{email}</strong>, te enviamos un
          enlace para crear una contraseña nueva.
        </p>
      ) : (
        <form onSubmit={submit} noValidate style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="av-rec-email">Correo electrónico</label>
            <input
              id="av-rec-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
            />
          </div>
          {error && (
            <p role="alert" style={errorStyle}>
              {error}
            </p>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            {busy ? "ENVIANDO…" : "ENVIAR ENLACE"}
          </button>
        </form>
      )}
    </Card>
  );
}
export function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sin sesión de recuperación no hay nada que restablecer.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) =>
        data.user ? setReady(true) : router.replace("/auth/recuperar"),
      );
  }, [router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.length < 8)
      return setError("La contraseña debe tener al menos 8 caracteres.");
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pass });
    setBusy(false);
    if (error) return setError(authError(error));
    router.push("/");
    router.refresh();
  };
  return (
    <Card title="NUEVA CONTRASEÑA">
      {ready && (
        <form onSubmit={submit} noValidate style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="av-new-pass">Contraseña nueva</label>
            <input
              id="av-new-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p role="alert" style={errorStyle}>
              {error}
            </p>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            {busy ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
          </button>
        </form>
      )}
    </Card>
  );
}
