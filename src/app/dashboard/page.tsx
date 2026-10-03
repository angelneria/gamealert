"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserData {
  email: string;
  platforms: string;
  discordWebhookUrl: string;
  discordEnabled: boolean;
  emailEnabled: boolean;
  minMetacritic: number;
  cooldownHours: number;
  notifications: Array<{
    id: string;
    gameTitle: string;
    platform: string;
    channel: string;
    status: string;
    sentAt: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  sent: "enviado",
  failed: "error",
  skipped: "omitido",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifyResult, setNotifyResult] = useState("");
  const [sending, setSending] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (data.user) {
        const notifRes = await fetch("/api/notifications?limit=10");
        const notifData = notifRes.ok ? await notifRes.json() : { notifications: [] };
        setUser({ ...data.user, notifications: notifData.notifications || [] });
      }
    } catch {
      // redirigir en error de red sostenido
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const sendNotifications = async () => {
    setSending(true);
    setNotifyResult("");
    try {
      const res = await fetch("/api/notify", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setNotifyResult(data.message);
        loadUser();
      } else {
        setNotifyResult(data.error || "Error");
      }
    } catch {
      setNotifyResult("Error al enviar alertas");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-[var(--accent)] animate-blink">CARGANDO_</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header onLogout={handleLogout} />

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-fade-in-up">
          <div>
            <p className="mono-label mb-2">{user?.email}</p>
            <h1 className="font-display font-bold text-[clamp(36px,5vw,56px)] tracking-tighter leading-[0.95]">
              PANEL<span className="text-[var(--accent)]">.</span>
            </h1>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/settings" className="btn-ghost !px-5 !py-3 text-sm">
              Ajustes
            </Link>
            <Link href="/dashboard/games" className="btn-ghost !px-5 !py-3 text-sm">
              Ver juegos
            </Link>
          </div>
        </div>

        {/* Auto-notice */}
        <div className="panel p-6 mb-12 animate-fade-in-up stagger-1">
          <p className="mono-label mb-2">Sistema automático</p>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            Las alertas te llegan <strong className="text-[var(--text)]">solas, sin que tengas que hacer nada</strong>.{" "}
            Si no quieres esperar, usa el botón de abajo para buscar ahora mismo.
          </p>
        </div>

        {/* Send alerts */}
        <div className="panel reticle p-8 md:p-10 mb-12 animate-fade-in-up stagger-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="font-display font-bold text-2xl tracking-tight">
                Buscar ahora
              </h2>
              <p className="text-[var(--muted)] mt-2">
                Comprueba juegos gratis nuevos y envía alertas a tu Discord y/o email
              </p>
            </div>
            <button
              onClick={sendNotifications}
              disabled={sending}
              className="btn-primary shrink-0"
            >
              {sending ? "Buscando..." : "Buscar y notificar"}
            </button>
          </div>
          {notifyResult && (
            <p className="mt-4 text-sm text-[var(--muted)]">{notifyResult}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)] mb-12 animate-fade-in-up stagger-2">
          <StatCell
            value={user?.discordEnabled ? "ON" : "OFF"}
            label="Discord"
            active={user?.discordEnabled}
          />
          <StatCell
            value={user?.emailEnabled ? "ON" : "OFF"}
            label="Email"
            active={user?.emailEnabled}
          />
          <StatCell
            value={String(
              user?.platforms
                ? user.platforms.split(",").filter(Boolean).length
                : 0
            )}
            label="Plataformas"
          />
          <StatCell
            value={String(user?.notifications?.length || 0)}
            label="Alertas"
          />
        </div>

        {/* Discord warning */}
        {user && !user.discordWebhookUrl && (
          <div className="border border-[var(--danger)] px-5 py-4 mb-12 animate-fade-in">
            <p className="text-[var(--danger)] text-sm">
              No tienes configurado un webhook de Discord.{" "}
              <Link href="/dashboard/settings" className="underline font-medium">
                Configúralo aquí
              </Link>{" "}
              para recibir alertas en tu servidor.
            </p>
          </div>
        )}

        {/* Recent notifications */}
        <div className="animate-fade-in-up stagger-3">
          <p className="mono-label mb-6">Notificaciones recientes</p>
          <div className="border-t border-[var(--border)]">
            {(user?.notifications || []).length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-display font-bold text-2xl text-[var(--muted)] tracking-tight">
                  Sin notificaciones aún
                </p>
                <p className="text-[var(--muted)] text-sm mt-2">
                  Las llegará la próxima vez que aparezca un juego que cumpla tus criterios.
                </p>
              </div>
            ) : (
              (user?.notifications || []).map((n) => (
                <div
                  key={n.id}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto] gap-4 items-center py-5 border-b border-[var(--border)]"
                >
                  <div>
                    <p className="font-display font-semibold tracking-tight">
                      {n.gameTitle}
                    </p>
                    <p className="mono-label mt-1">
                      {n.platform} — {new Date(n.sentAt).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[var(--muted)] border border-[var(--border)] px-3 py-1.5">
                    {n.channel}
                  </span>
                  <span
                    className={`font-mono text-xs px-3 py-1.5 border ${
                      n.status === "sent"
                        ? "text-[var(--accent)] border-[var(--accent-dim)]"
                        : n.status === "skipped"
                          ? "text-[var(--muted)] border-[var(--border)]"
                          : "text-[var(--danger)] border-[var(--danger)]"
                    }`}
                  >
                    {STATUS_LABELS[n.status] ?? n.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Header({ onLogout }: { onLogout: () => void }) {
  return (
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
          <Link href="/" className="mono-label hover:text-[var(--accent)] transition-colors">
            Inicio
          </Link>
          <button
            onClick={onLogout}
            className="mono-label hover:text-[var(--danger)] transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

function StatCell({
  value,
  label,
  active,
}: {
  value: string;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="bg-[var(--bg)] p-6">
      <p
        className={`font-display font-bold text-3xl tracking-tight ${
          active === undefined ? "" : active ? "text-[var(--accent)]" : "text-[var(--muted)]"
        }`}
      >
        {value}
      </p>
      <p className="mono-label mt-2">{label}</p>
    </div>
  );
}
