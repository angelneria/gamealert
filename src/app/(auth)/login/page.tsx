"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
      }

      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
              <rect width="28" height="28" fill="var(--accent)" />
              <path d="M8 20V10l6-4 6 4v10h-4v-6h-4v6H8z" fill="var(--bg)" />
            </svg>
            <span className="font-display font-bold text-lg tracking-tight">
              GAMEALERT
            </span>
          </Link>
          <Link
            href="/register"
            className="mono-label hover:text-[var(--accent)] transition-colors"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md animate-fade-in-up">
          <p className="mono-label mb-4">Acceso</p>
          <h1 className="font-display font-bold text-[clamp(36px,5vw,56px)] tracking-tighter leading-[0.95]">
            Inicia
            <br />
            <span className="text-outline">sesión</span>
          </h1>

          <form onSubmit={handleSubmit} className="mt-12 space-y-8">
            <div>
              <label className="mono-label block mb-3">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="mono-label block mb-3">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="input-field"
              />
            </div>

            {error && (
              <div className="border border-[var(--danger)] px-5 py-4 text-[var(--danger)] text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full justify-center text-base"
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-[var(--muted)] text-sm mt-8">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
