"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { config } from "@/config";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["steam"]);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const PLATFORMS = Object.entries(config.platforms).map(([id, p]) => ({
    id,
    label: p.name,
  }));

  const togglePlatform = (platformId: string) => {
    setPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, platforms, discordWebhookUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error en el registro");
      }

      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center animate-fade-in-up">
          <p className="font-display font-bold text-[clamp(40px,8vw,80px)] tracking-tighter text-[var(--accent)]">
            LISTO<span className="animate-blink">_</span>
          </p>
          <p className="text-[var(--muted)] mt-4">
            Te hemos registrado. Recibirás alertas cuando caigan juegos gratis de calidad.
          </p>
        </div>
      </div>
    );
  }

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
          <Link href="/login" className="mono-label hover:text-[var(--accent)] transition-colors">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg animate-fade-in-up">
          <p className="mono-label mb-4">Registro</p>
          <h1 className="font-display font-bold text-[clamp(36px,5vw,56px)] tracking-tighter leading-[0.95]">
            Configura tus
            <br />
            <span className="text-outline">alertas</span>
          </h1>

          <form onSubmit={handleSubmit} className="mt-12 space-y-8">
            {/* Email */}
            <div>
              <label className="mono-label block mb-3">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="input-field"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mono-label block mb-3">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
                minLength={8}
                className="input-field"
              />
            </div>

            {/* Discord Webhook */}
            <div>
              <label className="mono-label block mb-3">
                Webhook de Discord <span className="text-[var(--muted)] normal-case tracking-normal">(opcional)</span>
              </label>
              <input
                type="url"
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="input-field font-mono text-sm"
              />
              <p className="text-[var(--muted)] text-sm mt-3 leading-relaxed">
                Pega tu webhook para recibir alertas en tu servidor.{" "}
                <a
                  href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  ¿Cómo crear uno?
                </a>
              </p>
            </div>

            {/* Platforms */}
            <div>
              <label className="mono-label block mb-3">Plataformas a monitorear</label>
              <div className="space-y-2">
                {PLATFORMS.map((platform) => (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => togglePlatform(platform.id)}
                    className={`w-full flex items-center justify-between px-5 py-4 border transition-all ${
                      platforms.includes(platform.id)
                        ? "border-[var(--accent)] bg-[var(--surface)]"
                        : "border-[var(--border)] hover:border-[var(--border-bright)]"
                    }`}
                  >
                    <span className="font-display font-semibold tracking-tight">
                      {platform.label}
                    </span>
                    <span
                      className={`font-mono text-sm ${
                        platforms.includes(platform.id)
                          ? "text-[var(--accent)]"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {platforms.includes(platform.id) ? "[×]" : "[ ]"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="border border-[var(--danger)] px-5 py-4 text-[var(--danger)] text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password || platforms.length === 0}
              className="btn-primary w-full justify-center text-base"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta y activar alertas"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
