"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { config } from "@/config";
import {
  filterBySearch,
  sortGames,
  initialFiltersFromPrefs,
  type GameSortKey,
} from "@/lib/game-list";

function getPlatformName(platform: string) {
  const names: Record<string, string> = {
    steam: "Steam",
    epic: "Epic Games",
    gog: "GOG",
  };
  return names[platform] || platform;
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-[var(--accent)]";
  if (score >= 60) return "text-[var(--text)]";
  return "text-[var(--muted)]";
}

interface Game {
  title: string;
  platform: string;
  storeUrl: string;
  imageUrl: string;
  description: string;
  publisher: string;
  genre: string;
  importanceScore: number;
  isFree: boolean;
  metacriticScore?: number;
  originalPrice?: number;
  salePrice?: number;
  discountPct?: number;
}

/** Retrasa el valor para no disparar una petición por cada paso del slider */
function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function DashboardGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"free" | "deals">("free");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [minMetacritic, setMinMetacritic] = useState(
    config.filtering.minMetacritic
  );
  const [dealMaxPrice, setDealMaxPrice] = useState(config.deals.defaultMaxPrice);
  const [dealMinDiscount, setDealMinDiscount] = useState(
    config.deals.defaultMinDiscount
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<GameSortKey>("relevance");
  const [totalScraped, setTotalScraped] = useState(0);
  const [error, setError] = useState("");
  const [now, setNow] = useState("");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const debouncedDealMaxPrice = useDebounced(dealMaxPrice);
  const debouncedDealMinDiscount = useDebounced(dealMinDiscount);

  useEffect(() => {
    setNow(new Date().toLocaleTimeString("es-ES"));
    const interval = setInterval(
      () => setNow(new Date().toLocaleTimeString("es-ES")),
      1000
    );
    return () => clearInterval(interval);
  }, []);

  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (minMetacritic > 0) params.set("minMetacritic", String(minMetacritic));

      const res = await fetch(`/api/games?${params}`, {
        next: { revalidate: 0 },
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGames(data.games || []);
      setTotalScraped(data.totalScraped || 0);
    } catch (err) {
      setError("Error al cargar los juegos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [platformFilter, minMetacritic]);

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("maxPrice", String(debouncedDealMaxPrice));
      params.set("minDiscount", String(debouncedDealMinDiscount));
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (minMetacritic > 0) params.set("minMetacritic", String(minMetacritic));

      const res = await fetch(`/api/deals?${params}`, {
        next: { revalidate: 0 },
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGames(data.deals || []);
      setTotalScraped(data.totalScraped || 0);
    } catch (err) {
      setError("Error al cargar los chollos");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [platformFilter, minMetacritic, debouncedDealMaxPrice, debouncedDealMinDiscount]);

  // Carga según la pestaña activa; cambiar de pestaña refresca la lista
  useEffect(() => {
    if (mode === "free") fetchGames();
  }, [mode, fetchGames]);
  useEffect(() => {
    if (mode === "deals") fetchDeals();
  }, [mode, fetchDeals]);

  // La lista arranca con lo guardado en Ajustes (plataforma si es una
  // sola, Metacritic y topes de chollo). Solo toca los filtros que el
  // usuario aún no ha cambiado, para no pisar nada a mitad de uso.
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.user) return;
        const init = initialFiltersFromPrefs(d.user);
        setPlatformFilter((prev) =>
          prev === "all" ? init.platformFilter : prev
        );
        setMinMetacritic((prev) =>
          prev === config.filtering.minMetacritic ? init.minMetacritic : prev
        );
        setDealMaxPrice((prev) =>
          prev === config.deals.defaultMaxPrice ? init.dealMaxPrice : prev
        );
        setDealMinDiscount((prev) =>
          prev === config.deals.defaultMinDiscount ? init.dealMinDiscount : prev
        );
      })
      .catch(() => {});
  }, []);

  // Búsqueda y orden se aplican en local (instantáneo, sin más peticiones)
  const visibleGames = useMemo(
    () => sortGames(filterBySearch(games, search), sort),
    [games, search, sort]
  );

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedGame) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedGame]);

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
            <span className="mono-label hidden md:block">{now}</span>
            <Link href="/dashboard" className="mono-label hover:text-[var(--accent)] transition-colors">
              Panel
            </Link>
            <Link href="/dashboard/settings" className="mono-label hover:text-[var(--accent)] transition-colors">
              Ajustes
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-12 animate-fade-in-up">
          <p className="mono-label mb-2">
            {totalScraped > 0
              ? `${totalScraped} analizados${visibleGames.length < games.length ? ` · ${visibleGames.length} en lista` : ""}`
              : "Cargando..."}
          </p>
          <h1 className="font-display font-bold text-[clamp(40px,7vw,80px)] tracking-tighter leading-[0.9]">
            JUEGOS
            <br />
            <span className="text-outline">
              {mode === "deals" ? "CHOLLOS" : "GRATIS"}
            </span>
          </h1>
        </div>

        {/* Filters */}
        <div className="panel p-6 md:p-8 mb-12 animate-fade-in-up stagger-1">
          <div className="flex gap-2 mb-6">
            <FilterButton
              active={mode === "free"}
              onClick={() => {
                setMode("free");
                setSort("relevance");
              }}
            >
              Gratis
            </FilterButton>
            <FilterButton
              active={mode === "deals"}
              onClick={() => {
                setMode("deals");
                setSort("relevance");
              }}
            >
              Chollos
            </FilterButton>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="mono-label">Metacritic mínimo</span>
                <span className="font-mono text-sm text-[var(--accent)]">
                  {minMetacritic}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={minMetacritic}
                onChange={(e) => setMinMetacritic(Number(e.target.value))}
              />
              <div className="flex justify-between mt-2">
                <span className="mono-label">Todos</span>
                <span className="mono-label">100</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <FilterButton
                active={platformFilter === "all"}
                onClick={() => setPlatformFilter("all")}
              >
                Todos
              </FilterButton>
              {Object.entries(config.platforms).map(([id, p]) => (
                <FilterButton
                  key={id}
                  active={platformFilter === id}
                  onClick={() => setPlatformFilter(id)}
                >
                  {p.name}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* Búsqueda y orden (en local, instantáneo) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-[var(--border)]">
            <div>
              <label htmlFor="game-search" className="mono-label block mb-3">
                Buscar
              </label>
              <input
                id="game-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre…"
                autoComplete="off"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="game-sort" className="mono-label block mb-3">
                Ordenar
              </label>
              <select
                id="game-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as GameSortKey)}
                className="input-field"
              >
                <option value="relevance">Relevancia</option>
                {mode === "deals" && (
                  <>
                    <option value="discount">Mayor descuento</option>
                    <option value="priceAsc">Menor precio</option>
                  </>
                )}
                <option value="metacritic">Metacritic</option>
                <option value="name">Nombre (A–Z)</option>
              </select>
            </div>
          </div>

          {/* Deal-only controls */}
          {mode === "deals" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-[var(--border)]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="mono-label">Precio máximo</span>
                  <span className="font-mono text-sm text-[var(--accent)]">
                    ${dealMaxPrice}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={dealMaxPrice}
                  onChange={(e) => setDealMaxPrice(Number(e.target.value))}
                />
                <div className="flex justify-between mt-2">
                  <span className="mono-label">$1</span>
                  <span className="mono-label">$30</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="mono-label">Descuento mínimo</span>
                  <span className="font-mono text-sm text-[var(--accent)]">
                    -{dealMinDiscount}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={dealMinDiscount}
                  onChange={(e) => setDealMinDiscount(Number(e.target.value))}
                />
                <div className="flex justify-between mt-2">
                  <span className="mono-label">-50%</span>
                  <span className="mono-label">-95%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="border border-[var(--danger)] px-5 py-4 mb-8 text-[var(--danger)] animate-fade-in">
            {error}
          </div>
        )}

        {/* Games list */}
        {loading ? (
          <div className="border-t border-[var(--border)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-6 items-center py-8 border-b border-[var(--border)]">
                <div className="space-y-3">
                  <div className="h-5 w-48 bg-[var(--surface-2)] animate-pulse" />
                  <div className="h-4 w-32 bg-[var(--surface-2)] animate-pulse" />
                </div>
                <div className="h-8 w-16 bg-[var(--surface-2)] animate-pulse" />
              </div>
            ))}
          </div>
        ) : visibleGames.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-display font-bold text-3xl text-[var(--muted)] tracking-tight">
              Sin resultados
            </p>
            <p className="text-[var(--muted)] mt-3">
              {search.trim()
                ? `Nada coincide con «${search.trim()}». Prueba con otro nombre o quita filtros.`
                : mode === "deals"
                  ? `Ahora mismo no hay chollos de hasta $${debouncedDealMaxPrice} con -${debouncedDealMinDiscount}% o más. Sube el precio máximo, baja el descuento mínimo o quita filtros.`
                  : minMetacritic > 0
                    ? `Ningún juego gratis tiene Metacritic ${minMetacritic}+ ahora mismo. Prueba a bajar el umbral.`
                    : "No hay ofertas del 100% activas. Vuelve más tarde."}
            </p>
            <button
              onClick={mode === "deals" ? fetchDeals : fetchGames}
              className="btn-ghost mt-8"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="border-t border-[var(--border)]">
            {visibleGames.map((game, index) => (
              <GameRow
                key={`${game.platform}-${game.title}-${index}`}
                game={game}
                onSelect={() => setSelectedGame(game)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="mono-label">
            Datos en tiempo real — Sin almacenamiento
          </p>
          <div className="flex gap-6">
            {Object.entries(config.platforms).map(([id, p]) => (
              <a
                key={id}
                href={p.freeGamesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mono-label hover:text-[var(--accent)] transition-colors"
              >
                {p.name}
              </a>
            ))}
          </div>
        </footer>
      </main>

      {/* Game Details Modal */}
      {selectedGame && (
        <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all ${
        active
          ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]"
          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-bright)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function GameRow({
  game,
  onSelect,
}: {
  game: Game;
  onSelect: () => void;
}) {
  const score = game.metacriticScore || 0;

  return (
    <button
      onClick={onSelect}
      className="game-row group w-full text-left cursor-pointer"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h3 className="font-display font-bold text-xl tracking-tight group-hover:text-[var(--accent)] transition-colors">
            {game.title}
          </h3>
          <span className="mono-label">{getPlatformName(game.platform)}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm text-[var(--muted)]">
          {game.publisher && game.publisher !== "Unknown" && (
            <span>{game.publisher}</span>
          )}
          {!game.isFree && game.salePrice !== undefined ? (
            <>
              <span className="font-mono font-semibold text-[var(--accent)]">
                ${game.salePrice.toFixed(2)}
              </span>
              {game.originalPrice && game.originalPrice > 0 && (
                <span className="line-through">
                  ${game.originalPrice.toFixed(2)}
                </span>
              )}
              {game.discountPct !== undefined && (
                <span className="font-mono text-xs border border-[var(--danger)] text-[var(--danger)] px-2 py-0.5">
                  -{game.discountPct}%
                </span>
              )}
            </>
          ) : (
            game.originalPrice &&
            game.originalPrice > 0 && (
              <span className="line-through">${game.originalPrice}</span>
            )
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {score > 0 ? (
          <span className={`font-display font-bold text-3xl tracking-tight ${getScoreColor(score)}`}>
            {score}
          </span>
        ) : (
          <span className="font-mono text-xs text-[var(--muted)] border border-[var(--border)] px-3 py-1.5">
            SIN PUNTUAR
          </span>
        )}
      </div>
    </button>
  );
}

function GameModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const score = game.metacriticScore || 0;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${game.title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border-bright)] max-h-[90vh] overflow-y-auto animate-fade-in-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
          aria-label="Cerrar"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        {/* Image */}
        {game.imageUrl && (
          <div className="aspect-video w-full overflow-hidden border-b border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.imageUrl}
              alt={game.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 md:p-10">
          <p className="mono-label mb-3">{getPlatformName(game.platform)}</p>
          <h2 className="font-display font-bold text-[clamp(28px,4vw,44px)] tracking-tighter leading-[0.95]">
            {game.title}
          </h2>

          {/* Score */}
          <div className="flex items-center gap-6 mt-6 pb-6 border-b border-[var(--border)]">
            {score > 0 ? (
              <div>
                <p className={`font-display font-bold text-5xl tracking-tight ${getScoreColor(score)}`}>
                  {score}
                </p>
                <p className="mono-label mt-1">Metacritic</p>
              </div>
            ) : (
              <div>
                <p className="font-mono text-sm text-[var(--muted)] border border-[var(--border)] px-4 py-2">
                  SIN PUNTUAR
                </p>
                <p className="mono-label mt-2">Metacritic</p>
              </div>
            )}
            {!game.isFree && game.salePrice !== undefined ? (
              <>
                <div>
                  <p className="font-display font-bold text-2xl tracking-tight text-[var(--accent)]">
                    ${game.salePrice.toFixed(2)}
                  </p>
                  <p className="mono-label mt-1">Ahora</p>
                </div>
                {game.originalPrice && game.originalPrice > 0 && (
                  <div>
                    <p className="font-display font-bold text-2xl tracking-tight text-[var(--muted)] line-through">
                      ${game.originalPrice.toFixed(2)}
                    </p>
                    <p className="mono-label mt-1">Antes</p>
                  </div>
                )}
                {game.discountPct !== undefined && (
                  <div>
                    <p className="font-display font-bold text-2xl tracking-tight text-[var(--danger)]">
                      -{game.discountPct}%
                    </p>
                    <p className="mono-label mt-1">Descuento</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {game.originalPrice && game.originalPrice > 0 && (
                  <div>
                    <p className="font-display font-bold text-2xl tracking-tight text-[var(--muted)] line-through">
                      ${game.originalPrice}
                    </p>
                    <p className="mono-label mt-1">Precio original</p>
                  </div>
                )}
                <div>
                  <p className="font-display font-bold text-2xl tracking-tight text-[var(--accent)]">
                    GRATIS
                  </p>
                  <p className="mono-label mt-1">Ahora</p>
                </div>
              </>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 py-6 border-b border-[var(--border)]">
            {game.publisher && game.publisher !== "Unknown" && (
              <div>
                <p className="mono-label mb-1">Editor</p>
                <p className="font-display font-semibold">{game.publisher}</p>
              </div>
            )}
            {game.genre && game.genre !== "Free" && game.genre !== "Free Promotion" && (
              <div>
                <p className="mono-label mb-1">Género</p>
                <p className="font-display font-semibold">{game.genre}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {game.description && (
            <p className="text-[var(--muted)] leading-relaxed py-6 border-b border-[var(--border)]">
              {game.description}
            </p>
          )}

          {/* CTA */}
          <div className="pt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={game.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex-1 justify-center"
            >
              Ir a {getPlatformName(game.platform)}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            </a>
            <button onClick={onClose} className="btn-ghost flex-1 justify-center">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
