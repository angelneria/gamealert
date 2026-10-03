"use client";

/**
 * Session-aware slots for the landing page.
 *
 * The page itself stays a Server Component (SEO intact: crawlers and
 * no-JS visitors always see the guest version). After hydration these
 * slots ask GET /api/auth once and, when a session exists, swap the
 * "register" calls-to-action for "go to my panel" ones — so clicking
 * "Inicio" never *looks* like you were logged out.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

let sessionPromise: Promise<boolean> | null = null;

/** Una sola comprobación de sesión por carga de página */
function checkSession(): Promise<boolean> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/auth")
      .then((r) => r.ok)
      .catch(() => false);
  }
  return sessionPromise;
}

/** null = aún sin saber (renderiza la versión de invitado, igual que el SSR) */
export function useLoggedIn(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    checkSession().then((ok) => {
      if (alive) setLoggedIn(ok);
    });
    return () => {
      alive = false;
    };
  }, []);
  return loggedIn;
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 8h11M9 3.5L13.5 8 9 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Nav superior: "Empezar" → "Panel" cuando hay sesión */
export function HomeNavCta() {
  const loggedIn = useLoggedIn();
  if (loggedIn) {
    return (
      <Link
        href="/dashboard"
        data-home-auth="nav"
        className="font-display font-bold text-sm uppercase tracking-tight px-5 py-2.5 border border-[var(--accent)] text-[var(--accent)] transition-all"
      >
        Panel
      </Link>
    );
  }
  return (
    <Link
      href="/register"
      data-home-auth="nav"
      className="font-display font-bold text-sm uppercase tracking-tight px-5 py-2.5 border border-[var(--border-bright)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
    >
      Empezar
    </Link>
  );
}

/** CTA principal del hero: "Activar alertas" → "Ir a mi panel" */
export function HomeHeroCta() {
  const loggedIn = useLoggedIn();
  if (loggedIn) {
    return (
      <Link href="/dashboard" data-home-auth="hero" className="btn-primary">
        Ir a mi panel
        <ArrowIcon />
      </Link>
    );
  }
  return (
    <Link href="/register" data-home-auth="hero" className="btn-primary">
      Activar alertas
      <ArrowIcon />
    </Link>
  );
}

/** CTA final: "Crear cuenta gratis" → "Abrir mi panel" */
export function HomeBottomCta() {
  const loggedIn = useLoggedIn();
  if (loggedIn) {
    return (
      <Link
        href="/dashboard"
        data-home-auth="bottom"
        className="btn-primary text-lg"
      >
        Abrir mi panel
        <ArrowIcon />
      </Link>
    );
  }
  return (
    <Link
      href="/register"
      data-home-auth="bottom"
      className="btn-primary text-lg"
    >
      Crear cuenta gratis
      <ArrowIcon />
    </Link>
  );
}
