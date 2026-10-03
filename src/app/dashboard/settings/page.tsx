"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { config } from "@/config";

export default function SettingsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [notifiedCount, setNotifiedCount] = useState(0);
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    platforms: ["steam", "epic", "gog"] as string[],
    minMetacritic: 60,
    cooldownHours: 24,
    discordEnabled: true,
    emailEnabled: true,
    dealsEnabled: false,
    maxDealPrice: 10,
    minDiscountPct: 75,
  });

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data.user) {
        setEmail(data.user.email);
        setWebhookUrl(data.user.discordWebhookUrl || "");
        setPreferences((prev) => ({
          ...prev,
          platforms: data.user.platforms
            ? data.user.platforms.split(",").filter(Boolean)
            : prev.platforms,
          discordEnabled: data.user.discordEnabled ?? prev.discordEnabled,
          emailEnabled: data.user.emailEnabled ?? prev.emailEnabled,
          minMetacritic: data.user.minMetacritic ?? prev.minMetacritic,
          cooldownHours: data.user.cooldownHours ?? prev.cooldownHours,
          dealsEnabled: data.user.dealsEnabled ?? prev.dealsEnabled,
          maxDealPrice: data.user.maxDealPrice ?? prev.maxDealPrice,
          minDiscountPct: data.user.minDiscountPct ?? prev.minDiscountPct,
        }));
      }
      const notifRes = await fetch("/api/notifications?limit=1");
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifiedCount(notifData.total || 0);
      }
    } catch {
      // silencio: se reintenta con guardar
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const togglePlatform = (platformId: string) => {
    setPreferences((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter((p) => p !== platformId)
        : [...prev.platforms, platformId],
    }));
  };

  const handleSave = async () => {
    if (preferences.platforms.length === 0) {
      setTestResult("Selecciona al menos una plataforma");
      return;
    }
    if (preferences.discordEnabled && !webhookUrl.trim()) {
      setTestResult("Para Discord: pega un webhook o desactiva el canal");
      return;
    }

    try {
      const res = await fetch("/api/auth/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: preferences.platforms,
          discordWebhookUrl: webhookUrl.trim(),
          minMetacritic: preferences.minMetacritic,
          cooldownHours: preferences.cooldownHours,
          emailEnabled: preferences.emailEnabled,
          discordEnabled: preferences.discordEnabled,
          dealsEnabled: preferences.dealsEnabled,
          maxDealPrice: preferences.maxDealPrice,
          minDiscountPct: preferences.minDiscountPct,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        setTestResult("Preferencias guardadas");
      } else {
        setTestResult(data.error || "Error al guardar");
      }
    } catch {
      setTestResult("Error al guardar preferencias");
    }
  };

  const testNotification = async () => {
    const target = webhookUrl.trim();
    if (!target) {
      setTestResult("Primero pega tu webhook URL de Discord");
      return;
    }

    setTesting(true);
    setTestResult("");

    try {
      // No toca preferencias ni notifica a otros: solo prueba TU webhook
      const res = await fetch("/api/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: target }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult("Mensaje de prueba enviado. Revisa tu servidor de Discord.");
      } else {
        setTestResult(data.error || "Error al enviar");
      }
    } catch {
      setTestResult("Error al enviar notificación");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
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
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="mono-label hover:text-[var(--accent)] transition-colors">
              Panel
            </Link>
            <button
              onClick={handleLogout}
              className="mono-label hover:text-[var(--danger)] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12 animate-fade-in-up">
          <p className="mono-label mb-2">Ajustes</p>
          <h1 className="font-display font-bold text-[clamp(40px,7vw,80px)] tracking-tighter leading-[0.9]">
            CONFIGURA
            <br />
            <span className="text-outline">CIÓN</span>
          </h1>
          {loading && (
            <p className="mono-label mt-4 animate-blink text-[var(--accent)]">
              SINCRONIZANDO_
            </p>
          )}
        </div>

        <fieldset
          disabled={loading}
          className="border-0 p-0 m-0 min-w-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12"
        >
          {/* Main column */}
          <div className="space-y-12">
            {/* Account */}
            <section className="animate-fade-in-up stagger-1">
              <p className="mono-label mb-6">Tu cuenta</p>
              <div>
                <label className="mono-label block mb-3">Email (solo lectura)</label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="input-field opacity-60 cursor-not-allowed"
                />
              </div>
            </section>

            {/* Discord */}
            <section className="animate-fade-in-up stagger-2">
              <p className="mono-label mb-6">Servidor de Discord</p>
              <p className="text-[var(--muted)] text-sm mb-4">
                <a
                  href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:underline"
                >
                  ¿Cómo crear un webhook?
                </a>
              </p>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="input-field font-mono text-sm"
              />
            </section>

            {/* Platforms */}
            <section className="animate-fade-in-up stagger-3">
              <p className="mono-label mb-6">Plataformas</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(config.platforms).map(([id, platform]) => (
                  <button
                    key={id}
                    onClick={() => togglePlatform(id)}
                    className={`px-5 py-3 font-mono text-xs uppercase tracking-wider border transition-all ${
                      preferences.platforms.includes(id)
                        ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-bright)] hover:text-[var(--text)]"
                    }`}
                  >
                    {platform.name}
                  </button>
                ))}
              </div>
            </section>

            {/* Filters */}
            <section className="animate-fade-in-up stagger-4">
              <p className="mono-label mb-6">Filtros de calidad</p>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--muted)]">Metacritic mínimo</span>
                    <span className="font-mono text-sm text-[var(--accent)]">
                      {preferences.minMetacritic}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={preferences.minMetacritic}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        minMetacritic: Number(e.target.value),
                      })
                    }
                  />
                  <div className="flex justify-between mt-2">
                    <span className="mono-label">Todos</span>
                    <span className="mono-label">100</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--muted)]">
                      Cooldown por juego (anti-spam)
                    </span>
                    <span className="font-mono text-sm text-[var(--accent)]">
                      {preferences.cooldownHours}h
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="72"
                    value={preferences.cooldownHours}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        cooldownHours: Number(e.target.value),
                      })
                    }
                  />
                  <div className="flex justify-between mt-2">
                    <span className="mono-label">1h</span>
                    <span className="mono-label">72h</span>
                  </div>
                  <p className="text-[var(--muted)] text-sm mt-3">
                    Los juegos nuevos se avisan siempre al aparecer; esto solo evita
                    repetir el mismo título.
                  </p>
                </div>
              </div>
            </section>

            {/* Deals */}
            <section className="animate-fade-in-up stagger-5">
              <p className="mono-label mb-6">Chollos (juegos rebajados)</p>
              <div className="panel p-5 flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="font-display font-semibold tracking-tight">
                    Avisarme de chollos
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.dealsEnabled}
                  aria-label="Activar alertas de chollos"
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      dealsEnabled: !preferences.dealsEnabled,
                    })
                  }
                  className={`toggle shrink-0 ${preferences.dealsEnabled ? "checked" : ""}`}
                />
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--muted)]">
                      Precio máximo a pagar
                    </span>
                    <span className="font-mono text-sm text-[var(--accent)]">
                      ${preferences.maxDealPrice}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={preferences.maxDealPrice}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        maxDealPrice: Number(e.target.value),
                      })
                    }
                  />
                  <div className="flex justify-between mt-2">
                    <span className="mono-label">$1</span>
                    <span className="mono-label">$30</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--muted)]">
                      Descuento mínimo
                    </span>
                    <span className="font-mono text-sm text-[var(--accent)]">
                      -{preferences.minDiscountPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={preferences.minDiscountPct}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        minDiscountPct: Number(e.target.value),
                      })
                    }
                  />
                  <div className="flex justify-between mt-2">
                    <span className="mono-label">-50%</span>
                    <span className="mono-label">-95%</span>
                  </div>
                </div>

                <p className="text-[var(--muted)] text-sm">
                  Precios en dólares (USD).
                </p>
              </div>
            </section>

            {/* Channels */}
            <section className="animate-fade-in-up stagger-6">
              <p className="mono-label mb-6">Canales de notificación</p>
              <div className="space-y-3">
                <ChannelToggle
                  title="Discord"
                  checked={preferences.discordEnabled}
                  onChange={(checked) =>
                    setPreferences({ ...preferences, discordEnabled: checked })
                  }
                />
                <ChannelToggle
                  title="Email"
                  checked={preferences.emailEnabled}
                  onChange={(checked) =>
                    setPreferences({ ...preferences, emailEnabled: checked })
                  }
                />
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="panel p-6 animate-fade-in-up stagger-2">
              <p className="mono-label mb-4">Acciones</p>
              <div className="space-y-3">
                <button
                  onClick={handleSave}
                  className="btn-primary w-full justify-center !py-3 text-sm"
                >
                  {saved ? "Guardado" : "Guardar preferencias"}
                </button>
                <button
                  onClick={testNotification}
                  disabled={testing || !webhookUrl.trim()}
                  className="btn-ghost w-full justify-center !py-3 text-sm"
                >
                  {testing ? "Enviando..." : "Probar Discord"}
                </button>
              </div>
              {testResult && (
                <p className="text-sm text-[var(--muted)] mt-4 animate-fade-in">
                  {testResult}
                </p>
              )}
            </div>

            <div className="panel p-6 animate-fade-in-up stagger-3">
              <p className="mono-label mb-3">Estadísticas</p>
              <p className="font-display font-bold text-4xl tracking-tight text-[var(--accent)]">
                {notifiedCount}
              </p>
              <p className="text-[var(--muted)] text-sm mt-1">juegos notificados</p>
            </div>
          </aside>
        </fieldset>
      </main>
    </div>
  );
}

function ChannelToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="panel p-5 flex items-center justify-between gap-4">
      <div>
        <p className="font-display font-semibold tracking-tight">{title}</p>
        {description && (
          <p className="text-[var(--muted)] text-sm mt-1">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Activar canal ${title}`}
        onClick={() => onChange(!checked)}
        className={`toggle shrink-0 ${checked ? "checked" : ""}`}
      />
    </div>
  );
}
