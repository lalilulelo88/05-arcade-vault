import type { Metadata } from "next";
import { ResetForm } from "@/components/password-forms";
export const metadata: Metadata = { title: "Nueva contraseña" };
export default function RestablecerPage() {
  return <ResetForm />;
}
