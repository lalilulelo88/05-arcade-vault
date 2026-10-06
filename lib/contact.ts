export type ContactInput = { name: string; email: string; msg: string };

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "validation" | "send"; fields?: (keyof ContactInput)[] };

export const CONTACT_LIMITS = { name: 60, email: 120, msg: 2000 } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve los campos inválidos (vacío = todo correcto). Espera valores ya recortados con trim().
export function validateContact({ name, email, msg }: ContactInput): (keyof ContactInput)[] {
  const bad: (keyof ContactInput)[] = [];
  if (!name || name.length > CONTACT_LIMITS.name) bad.push("name");
  if (!email || email.length > CONTACT_LIMITS.email || !EMAIL_RE.test(email)) bad.push("email");
  if (!msg || msg.length > CONTACT_LIMITS.msg) bad.push("msg");
  return bad;
}
