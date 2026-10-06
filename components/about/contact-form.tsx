"use client";

import { useActionState, useState, type FormEvent } from "react";
import { sendContact } from "@/app/about/actions";
import { CONTACT_LIMITS, validateContact } from "@/lib/contact";

const EMPTY = { name: "", email: "", msg: "" };

// El wrapper remonta el formulario con `key` para restablecer también el estado de useActionState.
export function ContactForm() {
  const [run, setRun] = useState(0);
  return <ContactFormInner key={run} onReset={() => setRun((n) => n + 1)} />;
}

function ContactFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(sendContact, null);
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const invalid = validateContact({
      name: form.name.trim(),
      email: form.email.trim(),
      msg: form.msg.trim(),
    });
    if (invalid.length) {
      e.preventDefault();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const failed = state && !state.ok ? state : null;
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className={"contact-form" + (shake || failed?.error === "validation" ? " shake" : "")}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
    >
      {state?.ok ? (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success" role="status">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.name.toUpperCase()}.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={onReset}>ENVIAR OTRO MENSAJE</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {failed && (
            <div className="contact-error" role="alert">
              {failed.error === "send"
                ? "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO."
                : "REVISA LOS CAMPOS E INTÉNTALO DE NUEVO."}
            </div>
          )}
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name" name="name" value={form.name} onChange={set("name")}
              placeholder="px_kai" maxLength={CONTACT_LIMITS.name} autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email" name="email" type="email" value={form.email} onChange={set("email")}
              placeholder="jugador@vault.gg" maxLength={CONTACT_LIMITS.email} autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg" name="msg" rows={5} value={form.msg} onChange={set("msg")}
              placeholder="Cuéntanos qué tienes en mente…" maxLength={CONTACT_LIMITS.msg}
            ></textarea>
          </div>
          {/* honeypot: invisible para personas, los bots lo rellenan */}
          <div className="hp" aria-hidden="true">
            <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={pending}>
            {pending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      )}
    </form>
  );
}
