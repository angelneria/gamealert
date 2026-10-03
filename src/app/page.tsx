import { config } from "@/config";
import Link from "next/link";
import { HomeNavCta, HomeHeroCta, HomeBottomCta } from "@/components/home-auth";

/**
 * Preguntas y respuestas visibles en la portada. La MISMA lista alimenta
 * el JSON-LD FAQPage de abajo: si cambias un texto aquí, el SEO lo hereda.
 */
const FAQ = [
  {
    q: "¿Cuánto cuesta GameAlert?",
    a: "Nada. Avisarte de juegos gratis cobrando sería de traca. El proyecto se mantiene con coste cero y sin anuncios.",
  },
  {
    q: "¿Qué significa que un juego sea “gratis”?",
    a: "Que está al 100% de descuento por tiempo limitado y, una vez reclamado, queda en tu biblioteca para siempre. Es distinto del free-to-play (gratis con micropagos) y de las demos o pruebas temporales: eso aquí no entra.",
  },
  {
    q: "¿Cada cuánto llegan los avisos?",
    a: "En cuanto el juego aparece gratis, sin esperas. Los chollos salen en tandas de 10 como máximo para no inundar tu Discord, y ningún título se repite mientras siga activo.",
  },
  {
    q: "¿Necesito Discord sí o sí?",
    a: "No. Puedes recibir los avisos por email. Discord es más rápido y luce mejor, pero funciona igual sin él.",
  },
  {
    q: "¿Por qué me pedís la nota de Metacritic?",
    a: "Porque gratis hay mucho, y bueno no tanto. Con tu nota mínima solo te avisamos de juegos que merecen tu disco duro.",
  },
  {
    q: "¿Vale para consola o móvil?",
    a: "No: solo PC, en Steam, Epic Games Store y GOG. La web se ve bien en el móvil, pero los juegos son de ordenador.",
  },
];

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      {/* Top bar */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-display font-bold text-lg tracking-tight">
              GAMEALERT
            </span>
          </div>
          <nav className="flex items-center gap-8">
            <Link href="/dashboard/games" className="mono-label hover:text-[var(--accent)] transition-colors">
              Juegos
            </Link>
            <Link href="/dashboard/settings" className="mono-label hover:text-[var(--accent)] transition-colors">
              Ajustes
            </Link>
            <HomeNavCta />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24">
        <p className="mono-label mb-6 animate-fade-in-up">
          Solo PC — Steam · Epic · GOG
        </p>
        <h1 className="font-display font-bold leading-[0.9] tracking-tighter text-[clamp(56px,12vw,140px)] animate-fade-in-up stagger-1">
          JUEGOS
          <br />
          <span className="text-outline">GRATIS</span>
          <span className="text-[var(--accent)]">.</span>
        </h1>
        <p className="mt-8 max-w-md text-[var(--muted)] text-lg leading-relaxed animate-fade-in-up stagger-2">
          Epic regala juegos cada jueves a las 18:00. Steam y GOG sueltan
          gratis sin avisar. Te avisamos en tu Discord en cuanto aparecen —
          y solo si pasan tu nota mínima de Metacritic.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 animate-fade-in-up stagger-3">
          <HomeHeroCta />
          <Link href="/dashboard/games" className="btn-ghost">
            Ver juegos gratis
          </Link>
        </div>
      </section>

      {/* Ticker */}
      <div className="border-y border-[var(--border)] py-3 overflow-hidden">
        <div className="ticker-track">
          {[0, 1].map((n) => (
            <div key={n} className="flex items-center gap-8 pr-8 shrink-0">
              {["STEAM", "EPIC GAMES", "GOG", "100% GRATIS", "SIN BASURA", "METACRITIC", "ALERTA INSTANTÁNEA", "SOLO PC"].map((item) => (
                <span key={item} className="font-display font-bold text-sm uppercase tracking-widest whitespace-nowrap flex items-center gap-8">
                  {item}
                  <span className="text-[var(--accent)]">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
          <StatCell number="100%" label="De descuento o no sale aquí. Ni F2P, ni demos." />
          <StatCell number="10" label="Chollos por tanda como máximo. Sin inundar." />
          <StatCell number="18:00" label="Cada jueves, drop de Epic. Avisado al momento." />
        </div>
      </section>

      {/* Epic Countdown */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
          <EpicCountdown />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1200px] mx-auto px-6 pb-16 md:pb-24">
        <h2 className="mono-label mb-10">Por qué GameAlert</h2>
        <div className="border-t border-[var(--border)]">
          <FeatureRow
            index="01"
            title="Gratis significa gratis"
            description="Solo juegos al 100% de descuento por tiempo limitado: una vez reclamados, tuyos para siempre. El free-to-play, las demos y los fines de semana gratis no entran aquí."
          />
          <FeatureRow
            index="02"
            title="Tu nota mínima manda"
            description="Fijas la nota de Metacritic y las tiendas que miramos. Lo que no llegue a tu corte ni te lo enseñamos: cero morralla en tu Discord."
          />
          <FeatureRow
            index="03"
            title="Chollos con correa"
            description="Si un juegazo baja hasta tu precio con tu descuento mínimo, te avisamos. Máximo 10 por tanda para no convertir tu servidor en un tablón."
          />
        </div>
      </section>

      {/* Platforms */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
          <h2 className="mono-label mb-10">Plataformas monitoreadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(config.platforms).map(([id, p]) => (
              <a
                key={id}
                href={p.freeGamesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="panel reticle p-8 group"
              >
                <p className="font-display font-bold text-2xl tracking-tight group-hover:text-[var(--accent)] transition-colors">
                  {p.name}
                </p>
                <p className="mono-label mt-3 flex items-center gap-2">
                  {id}
                  <Arrow />
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
          <h2 className="mono-label mb-10">Cómo funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <Step index="01" title="Regístrate" description="Email y contraseña. Un minuto y sin tarjeta." />
            <Step index="02" title="Pega tu webhook" description="En Ajustes te explicamos cómo crear el de tu Discord. Dos minutos." />
            <Step index="03" title="Suena tu Discord" description="Cada jueves a las 18:00 y siempre que Steam o GOG liberen algo que pase tu filtro." />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
          <h2 className="mono-label mb-10">Dudas razonables</h2>
          <div className="border-t border-[var(--border)]">
            {FAQ.map((item) => (
              <div key={item.q} className="py-8 border-b border-[var(--border)] grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 md:gap-8 items-baseline">
                <h3 className="font-display font-bold text-xl tracking-tight">
                  {item.q}
                </h3>
                <p className="text-[var(--muted)] leading-relaxed max-w-2xl">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-32 text-center">
          <h2 className="font-display font-bold text-[clamp(36px,6vw,72px)] tracking-tighter leading-[0.95]">
            El jueves a las 18:00
            <br />
            <span className="text-outline-accent">hay drop</span>.
          </h2>
          <p className="mt-6 text-[var(--muted)] text-lg">
            Estate dentro cuando Epic regale. Tardas un minuto.
          </p>
          <div className="mt-10">
            <HomeBottomCta />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="mono-label">GameAlert © 2026</span>
          </div>
          <p className="mono-label">
            Hecho para gamers
          </p>
        </div>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect width="28" height="28" fill="var(--accent)" />
      <path
        d="M8 20V10l6-4 6 4v10h-4v-6h-4v6H8z"
        fill="var(--bg)"
      />
    </svg>
  );
}

function Arrow() {
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

function StatCell({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-[var(--bg)] p-8 md:p-10">
      <p className="stat-number text-[var(--accent)]">{number}</p>
      <p className="mono-label mt-4">{label}</p>
    </div>
  );
}

function FeatureRow({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] md:grid-cols-[80px_200px_1fr] gap-4 md:gap-8 items-baseline py-8 border-b border-[var(--border)] group">
      <span className="font-mono text-sm text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
        {index}
      </span>
      <h3 className="font-display font-bold text-xl tracking-tight group-hover:text-[var(--accent)] transition-colors">
        {title}
      </h3>
      <p className="text-[var(--muted)] leading-relaxed md:text-right max-w-sm md:ml-auto">
        {description}
      </p>
    </div>
  );
}

function Step({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <span className="font-mono text-sm text-[var(--accent)]">{index}</span>
      <h3 className="font-display font-bold text-xl tracking-tight mt-3">
        {title}
      </h3>
      <p className="text-[var(--muted)] leading-relaxed mt-3">{description}</p>
    </div>
  );
}

/**
 * Countdown to the next Epic Games Store free game drop.
 * Epic releases free games every Thursday at 18:00 CET (17:00 UTC).
 */
function EpicCountdown() {
  return (
    <div className="panel reticle p-8 md:p-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <p className="mono-label mb-2">Próximo drop de Epic Games</p>
          <p className="font-display font-bold text-2xl tracking-tight">
            Cada jueves — 18:00 CET
          </p>
          <p className="text-[var(--muted)] mt-2 text-sm">
            Epic Games Store regala 1-2 juegos cada semana. Te avisamos cuando estén activos.
          </p>
        </div>
        <div className="flex gap-4">
          <CountdownUnit label="Días" value={getDaysUntilThursday()} />
          <CountdownUnit label="Horas" value={getHoursUntilThursday()} />
          <CountdownUnit label="Min" value={getMinutesUntilThursday()} />
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center min-w-[72px]">
      <p className="font-display font-bold text-4xl md:text-5xl tracking-tight text-[var(--accent)]">
        {String(value).padStart(2, "0")}
      </p>
      <p className="mono-label mt-2">{label}</p>
    </div>
  );
}

function getDaysUntilThursday(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 4=Thu
  let diff = (4 - day + 7) % 7;
  if (diff === 0 && now.getHours() >= 18) diff = 7;
  return diff;
}

function getHoursUntilThursday(): number {
  const now = new Date();
  const days = getDaysUntilThursday();
  const target = new Date(now);
  target.setDate(now.getDate() + days);
  target.setHours(18, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
}

function getMinutesUntilThursday(): number {
  const now = new Date();
  const days = getDaysUntilThursday();
  const target = new Date(now);
  target.setDate(now.getDate() + days);
  target.setHours(18, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
}
