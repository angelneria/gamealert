// ============================================
// Pure filter & parsing functions
// Extracted for testability - NO network, NO side effects
// Every rule that decides "is this game worth showing?"
// lives here so it can be unit tested exhaustively.
// ============================================

import type { ScrapedGame } from "./api-client";

// --------------------------------------------
// Steam
// --------------------------------------------

/** A Steam deal is "temporarily free" only at exactly -100% discount */
export function isSteam100PercentDiscount(discount: number): boolean {
  return discount === -100;
}

/** Steam HTML rows mark demos via title text or CSS markers */
export function isSteamDemo(title: string, row: string): boolean {
  return (
    title.toLowerCase().includes("demo") ||
    row.includes("Demo</div>") ||
    row.includes('class="demo"')
  );
}

/** Steam always-free games carry the "Free to Play" tag */
export function isSteamF2P(row: string): boolean {
  return row.includes("Free to Play") || row.includes("free_to_play");
}

/** Full gate for a Steam search row */
export function isSteamTemporarilyFreeGame(
  title: string,
  row: string,
  discount: number
): boolean {
  if (!isSteam100PercentDiscount(discount)) return false;
  if (isSteamDemo(title, row)) return false;
  if (isSteamF2P(row)) return false;
  return true;
}

/** Extract app id from a `data-ds-appid=` split row */
export function parseSteamRowId(row: string): string | null {
  const m = row.match(/^"(\d+)"/);
  return m ? m[1] : null;
}

/** Extract game title from a Steam search row */
export function parseSteamRowTitle(row: string): string | null {
  const m = row.match(/<span class="title">([^<]+)<\/span>/);
  return m ? m[1].trim() : null;
}

/** Extract discount percentage as a negative number (e.g. -70) */
export function parseSteamDiscount(row: string): number {
  const m = row.match(/discount_pct">(-?\d+)%</);
  return m ? parseInt(m[1], 10) : 0;
}

/** Resolve the best image URL for a Steam app */
export function resolveSteamImage(row: string, id: string): string {
  const m = row.match(
    /src="(https:\/\/shared\.[a-z]+\.steamstatic\.com[^"]+)"/
  );
  let imageUrl = m
    ? m[1]
    : `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;
  if (imageUrl.includes("capsule_231x87")) {
    imageUrl = imageUrl.replace("capsule_231x87.jpg", "header.jpg");
  }
  return imageUrl;
}

// --------------------------------------------
// Epic Games Store
// --------------------------------------------

export interface EpicPrice {
  discountPrice: number;
  originalPrice: number;
}

/**
 * Epic promo counts as "temporarily free" only when:
 * - it costs 0 now AND
 * - it had a positive original price (not an always-free F2P title)
 */
export function isEpicTemporarilyFree(price: EpicPrice | null | undefined): boolean {
  if (!price) return false;
  if (price.discountPrice !== 0) return false;
  if (!price.originalPrice || price.originalPrice <= 0) return false;
  return true;
}

/** Build a deep store link from an Epic catalog entry */
export function buildEpicStoreUrl(entry: {
  catalogNs?: { mappings?: Array<{ pageSlug?: string }> };
  offerMappings?: Array<{ pageSlug?: string }>;
  productSlug?: string;
  urlSlug?: string;
}): string {
  const pageSlug =
    entry.catalogNs?.mappings?.[0]?.pageSlug ||
    entry.offerMappings?.[0]?.pageSlug ||
    entry.productSlug ||
    entry.urlSlug ||
    "";
  return pageSlug
    ? `https://store.epicgames.com/p/${pageSlug}`
    : "https://store.epicgames.com/free-games";
}

/** Pick the widest available key image */
export function pickEpicImage(
  images: Array<{ type: string; url: string }>
): string {
  const wide = images.find((i) => i.type === "OfferImageWide");
  const tall = images.find((i) => i.type === "OfferImageTall");
  return wide?.url || tall?.url || "";
}

// --------------------------------------------
// GOG
// --------------------------------------------

export interface GogProduct {
  slug?: string;
  title?: string;
  productType?: string;
  coverHorizontal?: string;
  logo?: string;
  price?: { finalAmount?: number };
  reviewsRating?: number;
  publishers?: Array<{ name?: string }>;
}

/** Slug/title/productType markers that indicate DLC, demos, mods, etc. */
export function isGogExcludedProduct(p: GogProduct): boolean {
  const slug = (p.slug || "").toLowerCase();
  const title = (p.title || "").toLowerCase();

  return (
    slug.includes("dlc") ||
    slug.includes("demo") ||
    slug.includes("mod_") ||
    slug.includes("unrated") ||
    slug.includes("season") ||
    slug.includes("expansion") ||
    slug.includes("pack") ||
    slug.includes("color_variation") ||
    slug.includes("digital_poster") ||
    slug.includes("unit_") ||
    title.includes("dlc") ||
    title.includes("demo") ||
    title.includes(" mod ") ||
    title.includes("unrated") ||
    title.includes("4k resolution") ||
    title.includes("resolution mode") ||
    p.productType === "dlc" ||
    p.productType === "expansion"
  );
}

/** A GOG product qualifies when it passes the exclusion filter, has an
 *  image, and costs nothing right now */
export function isGogFreeGame(p: GogProduct): boolean {
  if (isGogExcludedProduct(p)) return false;
  const imageUrl = p.coverHorizontal || p.logo || "";
  if (!imageUrl) return false;
  if (p.price && (p.price.finalAmount ?? 0) > 0) return false;
  return true;
}

/** GOG's 0-100 reviewsRating as quality proxy (default 50 when unrated) */
export function gogQualityScore(p: GogProduct): number {
  return p.reviewsRating || 50;
}

// --------------------------------------------
// CheapShark deals (chollos — juegos rebajados)
// --------------------------------------------

/** CheapShark store id → our platform id (null = store we don't monitor) */
export function cheapsharkStoreToPlatform(storeId: string | number): string | null {
  const map: Record<string, string> = {
    "1": "steam",
    "7": "gog",
    "25": "epic",
  };
  return map[String(storeId)] ?? null;
}

/** Shape of a CheapShark /deals row (only the fields we consume) */
export interface CheapsharkDeal {
  title?: string;
  storeID?: string | number;
  salePrice?: string;
  normalPrice?: string;
  savings?: string;
  metacriticScore?: string;
  steamAppID?: string | number | null;
  thumb?: string;
  dealID?: string;
}

/**
 * Convert a CheapShark deal row into a ScrapedGame.
 * Returns null when the row is unusable: unknown store, no title,
 * free (salePrice 0 — free games belong to the GRATIS list), or no link.
 */
export function parseCheapsharkDeal(deal: CheapsharkDeal): ScrapedGame | null {
  const platform = cheapsharkStoreToPlatform(deal.storeID ?? "");
  if (!platform) return null;

  const title = (deal.title || "").trim();
  if (!title) return null;

  const salePrice = parseFloat(deal.salePrice || "0");
  const normalPrice = parseFloat(deal.normalPrice || "0");
  if (!(salePrice > 0)) return null;
  if (!(normalPrice > 0)) return null;

  const discountPct = Math.round(parseFloat(deal.savings || "0"));
  const metacriticScore = parseInt(deal.metacriticScore || "0", 10) || 0;
  const steamAppId = deal.steamAppID ? String(deal.steamAppID) : undefined;

  // Steam gets a deep link; other stores go through CheapShark's redirect
  // (its dealID already comes URL-encoded).
  let storeUrl = "";
  if (steamAppId) {
    storeUrl = `https://store.steampowered.com/app/${steamAppId}/`;
  } else if (deal.dealID) {
    storeUrl = `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`;
  } else {
    return null;
  }

  const imageUrl = steamAppId
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/header.jpg`
    : deal.thumb || "";

  return {
    title,
    platform,
    storeUrl,
    imageUrl,
    description: `Rebajado un ${discountPct}% — antes $${normalPrice.toFixed(2)}`,
    publisher: "",
    genre: "",
    importanceScore: metacriticScore,
    isFree: false,
    metacriticScore,
    originalPrice: normalPrice,
    salePrice,
    discountPct,
    steamAppId,
  };
}

/**
 * A discounted game fits the user's budget (USD).
 * Free games bypass this gate — they have no price.
 */
export function passesDealPrice(
  game: Pick<ScrapedGame, "isFree" | "salePrice">,
  maxPriceUsd: number
): boolean {
  if (game.isFree) return true;
  const price = game.salePrice;
  if (price === undefined || !(price > 0)) return false;
  return price <= maxPriceUsd;
}

/**
 * A discounted game meets the user's minimum discount.
 * Free games bypass this gate (100% off already).
 */
export function passesDealDiscount(
  game: Pick<ScrapedGame, "isFree" | "discountPct">,
  minDiscountPct: number
): boolean {
  if (game.isFree) return true;
  const pct = game.discountPct;
  if (pct === undefined || pct < 0) return false;
  return pct >= minDiscountPct;
}

// --------------------------------------------
// Shared
// --------------------------------------------

/** Normalize a title for dedup/cooldown comparison */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Deduplicate a mixed-platform game list by normalized title.
 * First occurrence wins (callers should pass higher-quality sources first).
 */
export function dedupeGames<T extends { title: string }>(
  games: T[]
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const game of games) {
    const key = normalizeTitle(game.title);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(game);
    }
  }
  return unique;
}

/**
 * Core quality gate used by the /api/games filter and the notifier:
 * a game passes when its effective score meets the user's threshold.
 * Unrated games (score 0) only pass when the threshold is 0.
 */
export function passesQualityThreshold(
  game: Pick<ScrapedGame, "importanceScore" | "metacriticScore">,
  minMetacritic: number
): boolean {
  const effective = Math.max(
    game.importanceScore,
    game.metacriticScore ?? 0
  );
  return effective >= minMetacritic;
}
