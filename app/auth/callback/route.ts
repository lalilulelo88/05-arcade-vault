import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
const OTP_TYPES = ["signup", "recovery", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];
// Solo rutas del mismo origen: evita open redirect vía ?next=
function safeNext(next: string | null, base: string) {
  if (!next) return "/";
  try {
    const url = new URL(next, base);
    return url.origin === new URL(base).origin
      ? url.pathname + url.search
      : "/";
  } catch {
    return "/";
  }
}
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = OTP_TYPES.find((t) => t === searchParams.get("type")) as
    OtpType | undefined;
  const next = safeNext(searchParams.get("next"), request.url);
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/auth?error=enlace", request.url));
}
