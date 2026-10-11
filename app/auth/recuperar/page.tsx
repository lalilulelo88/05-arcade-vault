import type { Metadata } from "next";
import { RecoverForm } from "@/components/password-forms";
export const metadata: Metadata = { title: "Recuperar contraseña" };
export default function RecuperarPage() {
  return <RecoverForm />;
}
