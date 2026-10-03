// ============================================
// Client-side game list helpers (search + sort)
// Pure functions: no fetching, no DOM. The list
// the server returns is filtered/sorted locally
// so typing and sorting are instant.
// ============================================

import { config } from "@/config";

export interface SortableGame {
  title: string;
  importanceScore: number;
  metacriticScore?: number;
  salePrice?: number;
  discountPct?: number;
}

export type GameSortKey =
  | "relevance"
  | "discount"
  | "priceAsc"
  | "metacritic"
  | "name";

/** Quita mayúsculas, acentos y espacios sobrantes para comparar títulos */
function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Filtra la lista por texto en el título (insensible a
 * mayúsculas y acentos). Consulta vacía = lista intacta.
 */
export function filterBySearch<T extends { title: string }>(
  games: T[],
  query: string
): T[] {
  const q = normalizeSearch(query);
  if (!q) return [...games];
  return games.filter((g) => normalizeSearch(g.title).includes(q));
}

function num(value: number | undefined, missing: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : missing;
}

/**
 * Ordena una copia de la lista (nunca muta la entrada).
 * - relevance: orden del servidor (puntuación interna)
 * - discount: mayor descuento primero (sin dato → al final)
 * - priceAsc: menor precio primero (sin dato → al final)
 * - metacritic: mayor nota primero (sin nota → al final)
 * - name: alfabético (español)
 * Los empates se rompen por puntuación interna.
 */
export function sortGames<T extends SortableGame>(
  games: T[],
  sort: GameSortKey
): T[] {
  const list = [...games];
  switch (sort) {
    case "discount":
      list.sort(
        (a, b) =>
          num(b.discountPct, -1) - num(a.discountPct, -1) ||
          b.importanceScore - a.importanceScore
      );
      break;
    case "priceAsc":
      list.sort(
        (a, b) =>
          num(a.salePrice, Infinity) - num(b.salePrice, Infinity) ||
          b.importanceScore - a.importanceScore
      );
      break;
    case "metacritic":
      list.sort(
        (a, b) =>
          num(b.metacriticScore, -1) - num(a.metacriticScore, -1) ||
          b.importanceScore - a.importanceScore
      );
      break;
    case "name":
      list.sort((a, b) => a.title.localeCompare(b.title, "es"));
      break;
    case "relevance":
    default:
      break;
  }
  return list;
}

export interface SavedListPrefs {
  platforms?: string | string[];
  minMetacritic?: unknown;
  maxDealPrice?: unknown;
  minDiscountPct?: unknown;
}

export interface InitialListFilters {
  platformFilter: string;
  minMetacritic: number;
  dealMaxPrice: number;
  dealMinDiscount: number;
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * La lista arranca con lo guardado en Ajustes: si el usuario tiene
 * UNA sola plataforma la preselecciona (con varias o ninguna = todas),
 * más su Metacritic mínimo y sus topes de chollo. Todo saneado a
 * rangos válidos; lo ausente cae a los valores por defecto.
 */
export function initialFiltersFromPrefs(
  prefs: SavedListPrefs
): InitialListFilters {
  const ids = Array.isArray(prefs.platforms)
    ? prefs.platforms
    : String(prefs.platforms ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
  const known = Object.keys(config.platforms);
  const valid = ids.filter((id) => known.includes(id));

  return {
    platformFilter: valid.length === 1 ? valid[0] : "all",
    minMetacritic: clamp(
      Math.round(toNumber(prefs.minMetacritic, config.filtering.minMetacritic)),
      0,
      100
    ),
    dealMaxPrice: clamp(
      toNumber(prefs.maxDealPrice, config.deals.defaultMaxPrice),
      1,
      config.deals.maxPriceCap
    ),
    dealMinDiscount: clamp(
      Math.round(
        toNumber(prefs.minDiscountPct, config.deals.defaultMinDiscount)
      ),
      0,
      99
    ),
  };
}
