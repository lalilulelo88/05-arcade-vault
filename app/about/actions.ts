"use server";

import { Resend } from "resend";
import { validateContact, type ContactResult } from "@/lib/contact";

const DEFAULT_FROM = "Arcade Vault <onboarding@resend.dev>";

const field = (data: FormData, key: string) => String(data.get(key) ?? "").trim();

export async function sendContact(
  _prev: ContactResult | null,
  data: FormData,
): Promise<ContactResult> {
  const input = { name: field(data, "name"), email: field(data, "email"), msg: field(data, "msg") };

  // Honeypot: un bot rellena el campo oculto; se responde éxito sin enviar nada.
  if (field(data, "website")) return { ok: true, name: input.name };

  const fields = validateContact(input);
  if (fields.length) return { ok: false, error: "validation", fields };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[contact] Faltan RESEND_API_KEY o CONTACT_TO_EMAIL");
    return { ok: false, error: "send" };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM || DEFAULT_FROM,
      to,
      replyTo: input.email,
      subject: `[Arcade Vault] Mensaje de ${input.name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${input.name}\nCorreo: ${input.email}\n\n${input.msg}`,
    });
    if (error) {
      console.error("[contact] Resend rechazó el envío:", error);
      return { ok: false, error: "send" };
    }
    return { ok: true, name: input.name };
  } catch (err) {
    console.error("[contact] Error al enviar:", err);
    return { ok: false, error: "send" };
  }
}
