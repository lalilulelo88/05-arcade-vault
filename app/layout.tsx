import type { Metadata } from "next";
import { Courier_Prime, JetBrains_Mono, Press_Start_2P } from "next/font/google";
import { Nav } from "@/components/nav";
import { SessionProvider } from "@/components/session-provider";
import "./globals.css";

const pixel = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const courier = Courier_Prime({
  variable: "--font-courier",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Arcade Vault", template: "%s · Arcade Vault" },
  description: "Juega online y compite por la mayor cantidad de puntos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${pixel.variable} ${mono.variable} ${courier.variable}`}
    >
      <body>
        <div className="av-bg" />
        <div className="av-noise" />
        <div id="root">
          <SessionProvider>
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                borderTop: "1px solid var(--line)",
                padding: "20px 32px",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
              }}
            >
              © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
            </footer>
          </SessionProvider>
        </div>
      </body>
    </html>
  );
}
