"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

type Section = "inicio" | "biblioteca" | "salon" | "about" | "auth";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useSession();

  const isActive = (name: Section) => {
    switch (name) {
      case "inicio": return pathname === "/";
      case "salon": return pathname.startsWith("/salon");
      case "about": return pathname.startsWith("/about");
      case "auth": return pathname.startsWith("/auth");
      default: return pathname.startsWith("/games") || pathname.startsWith("/juegos") || pathname.startsWith("/jugar");
    }
  };
  const cls = (name: Section) => (isActive(name) ? "active" : "");
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={cls("inicio")} href="/">Inicio</Link>
          <Link className={cls("biblioteca")} href="/games">Biblioteca</Link>
          <Link className={cls("salon")} href="/salon">Salón de la Fama</Link>
          <Link className={cls("about")} href="/about">Acerca de</Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>{user.name} ▾</button>
        ) : (
          <Link className="btn auth-btn" href="/auth">Iniciar Sesión</Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">≡</button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close}></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>MENÚ</div>
        <Link className={cls("inicio")} href="/" onClick={close}>Inicio</Link>
        <Link className={cls("biblioteca")} href="/games" onClick={close}>Biblioteca</Link>
        <Link className={cls("salon")} href="/salon" onClick={close}>Salón de la Fama</Link>
        <Link className={cls("about")} href="/about" onClick={close}>Acerca de</Link>
        <Link className={cls("auth")} href="/auth" onClick={close}>{user ? "Cuenta" : "Iniciar Sesión"}</Link>
        <div style={{ flex: 1 }}></div>
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>CRÉDITOS · 03</div>
      </aside>
    </>
  );
}
