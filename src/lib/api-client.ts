import axios from "axios";
import {
  isSteamTemporarilyFreeGame,
  parseSteamRowId,
  parseSteamRowTitle,
  parseSteamDiscount,
  resolveSteamImage,
  isEpicTemporarilyFree,
  buildEpicStoreUrl,
  pickEpicImage,
  isGogFreeGame,
  gogQualityScore,
  dedupeGames,
  parseCheapsharkDeal,
  passesDealPrice,
} from "./filters";

// ============================================
// DYNAMIC SCRAPING - PC platforms
// Strategy:
// - CheapShark: free deals WITH Metacritic scores (primary)
// - Steam: 100% discount deals (temporarily free) + Metacritic via appdetails
// - Epic: weekly free promotions
// - GOG: free games with reviewsRating filter
//
// Quality filtering:
// - Exclude demos, DLC, F2P (always-free) games
// - Min Metacritic threshold (default 60)
// - Sort by quality score
// ============================================

export interface ScrapedGame {
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
  steamAppId?: string;
  /** Precio rebajado actual en USD (solo chollos, isFree=false) */
  salePrice?: number;
  /** Porcentaje de descuento (solo chollos, isFree=false) */
  discountPct?: number;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHEAPSHARK_UA = "GameAlert/1.0 (contact@gamealert.app)";

// In-memory Metacritic cache (avoids re-fetching)
const metacriticCache = new Map<string, { score: number; time: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Metacritic score for a Steam game via appdetails API
 * Rate-limited to 1 request per second
 */
async function fetchSteamMetacritic(
  appId: string
): Promise<{ score: number; reviews: number; publisher: string; genre: string }> {
  const cached = metacriticCache.get(appId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return { score: cached.score, reviews: 0, publisher: "", genre: "" };
  }

  try {
    const r = await axios.get(
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      { headers: { "User-Agent": UA }, timeout: 10000 }
    );
    const data = r.data[appId]?.data;
    if (!data) return { score: 0, reviews: 0, publisher: "", genre: "" };

    const score = data.metacritic?.score || 0;
    const reviews = data.recommendations?.total || 0;
    const publisher = data.publishers?.[0] || "";
    const genre = data.genres?.[0]?.description || "";

    metacriticCache.set(appId, { score, time: Date.now() });

    // Rate limit: 1 request per second
    await new Promise((resolve) => setTimeout(resolve, 1100));

    return { score, reviews, publisher, genre };
  } catch {
    return { score: 0, reviews: 0, publisher: "", genre: "" };
  }
}

// ============================================
// CheapShark - Free deals WITH Metacritic
// Best source: aggregates deals across stores
// with quality scores
// ============================================

async function getCheapSharkFreeGames(): Promise<ScrapedGame[]> {
  try {
    const response = await axios.get(
      "https://www.cheapshark.com/api/1.0/deals?upperPrice=0&pageSize=50",
      {
        headers: { "User-Agent": CHEAPSHARK_UA },
        timeout: 15000,
      }
    );

    const storeMap: Record<string, string> = {
      "1": "steam",
      "7": "gog",
      "11": "humble",
      "13": "ubisoft",
      "15": "greenman",
      "21": "humble",
      "23": "greenman",
      "25": "epic",
      "27": "greenman",
      "28": "greenman",
      "30": "greenman",
      "35": "greenman",
    };

    const games: ScrapedGame[] = [];

    for (const deal of response.data) {
      const platform = storeMap[deal.storeID] || `store_${deal.storeID}`;
      const metaScore = parseInt(deal.metacriticScore) || 0;

      // Image: use Steam header if available
      let imageUrl = deal.thumb || "";
      if (deal.steamAppID) {
        imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${deal.steamAppID}/header.jpg`;
      }

      // Store URL
      const storeUrls: Record<string, string> = {
        steam: deal.steamAppID
          ? `https://store.steampowered.com/app/${deal.steamAppID}/`
          : "https://store.steampowered.com/",
        gog: "https://www.gog.com/",
        epic: "https://store.epicgames.com/free-games",
        humble: "https://www.humblebundle.com/store",
        ubisoft: "https://store.ubisoft.com/",
        greenman: "https://www.greenmangaming.com/",
      };

      // If we have a steamAppID, fetch full Metacritic (more reliable)
      let finalMeta = metaScore;
      let publisher = "Various";
      let genre = "Free";
      if (deal.steamAppID) {
        const details = await fetchSteamMetacritic(String(deal.steamAppID));
        if (details.score > 0) finalMeta = details.score;
        if (details.publisher) publisher = details.publisher;
        if (details.genre) genre = details.genre;
      }

      games.push({
        title: deal.title,
        platform,
        storeUrl:
          storeUrls[platform] ||
          `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
        imageUrl,
        description: `Free on ${platform} - Normally $${deal.normalPrice}`,
        publisher,
        genre,
        importanceScore: finalMeta > 0 ? finalMeta : 50,
        isFree: true,
        metacriticScore: finalMeta,
        originalPrice: parseFloat(deal.normalPrice),
        steamAppId: deal.steamAppID ? String(deal.steamAppID) : undefined,
      });
    }

    console.log(`📊 CheapShark: ${games.length} free deals (with Metacritic)`);
    return games;
  } catch (error) {
    console.error("[CheapShark] Failed:", (error as Error).message);
    return [];
  }
}

// ============================================
// CheapShark - Discounted games (chollos)
// Paid games on sale from Steam/GOG/Epic with
// price, discount % and Metacritic in one call.
// ============================================

/**
 * Fetch discounted games up to a price cap (USD).
 * Free games (salePrice 0) are excluded — they belong to the free list.
 * The per-user discount/Metacritic gates are applied by callers
 * (pure filters in lib/filters + notification-filter).
 * Upstream errors resolve to [] so a CheapShark outage never breaks callers.
 */
export async function scrapeDeals(maxPriceUsd: number): Promise<ScrapedGame[]> {
  try {
    const response = await axios.get("https://www.cheapshark.com/api/1.0/deals", {
      params: {
        storeID: "1,7,25", // Steam, GOG, Epic
        upperPrice: Math.max(1, Math.ceil(maxPriceUsd)),
        pageSize: 60,
      },
      headers: { "User-Agent": CHEAPSHARK_UA },
      timeout: 15000,
    });

    const deals: ScrapedGame[] = [];
    for (const row of response.data ?? []) {
      const deal = parseCheapsharkDeal(row);
      if (!deal) continue;
      if (!passesDealPrice(deal, maxPriceUsd)) continue;
      deals.push(deal);
    }

    console.log(`📊 CheapShark deals: ${deals.length} (≤ $${maxPriceUsd})`);
    return deals;
  } catch (error) {
    console.error("[CheapShark deals] Failed:", (error as Error).message);
    return [];
  }
}

// ============================================
// Steam - 100% discount deals (temporarily free)
// NOT F2P games - only paid games that are
// currently 100% off (like "Elden Ring free day")
// ============================================

async function getSteamFreeGames(): Promise<ScrapedGame[]> {
  try {
    // Search Steam specials (games on sale)
    const response = await axios.get(
      "https://store.steampowered.com/search/?specials=1&category1=998",
      {
        headers: { "User-Agent": UA },
        timeout: 20000,
      }
    );

    const html = response.data;
    const rows = html.split('data-ds-appid=');
    const games: ScrapedGame[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const idMatch = parseSteamRowId(row);
      if (!idMatch) continue;
      const id = idMatch;

      const titleMatch = parseSteamRowTitle(row);
      if (!titleMatch) continue;
      const title = titleMatch;

      // Get discount percentage (e.g. "-70%" or "-100%")
      const discount = parseSteamDiscount(row);

      // ONLY 100% discount (temporarily free, normally paid), never demos or F2P
      if (!isSteamTemporarilyFreeGame(title, row, discount)) continue;

      // Get image
      const imageUrl = resolveSteamImage(row, id);

      // Fetch Metacritic for quality score
      const details = await fetchSteamMetacritic(id);

      games.push({
        title,
        platform: "steam",
        storeUrl: `https://store.steampowered.com/app/${id}/`,
        imageUrl,
        description: `Temporarily FREE on Steam - normally paid`,
        publisher: details.publisher || "Various",
        genre: details.genre || "Free",
        importanceScore: details.score > 0 ? details.score : 50,
        isFree: true,
        metacriticScore: details.score,
        originalPrice: 0,
        steamAppId: id,
      });
    }

    console.log(`📊 Steam: ${games.length} games at 100% discount`);
    return games;
  } catch (error) {
    console.error("[Steam] Failed:", (error as Error).message);
    return [];
  }
}

// ============================================
// Epic Games Store - Free promotions
// Weekly freebies (temporarily free)
// ============================================

async function getEpicFreeGames(): Promise<ScrapedGame[]> {
  try {
    const response = await axios.get(
      "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US",
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
        timeout: 10000,
      }
    );

    const elements =
      response.data?.data?.Catalog?.searchStore?.elements || [];
    const games: ScrapedGame[] = [];

    for (const entry of elements) {
      const price = entry.price?.totalPrice;
      if (!isEpicTemporarilyFree(price)) continue;

      const images = entry.keyImages || [];
      const imageUrl = pickEpicImage(images);

      const storeUrl = buildEpicStoreUrl(entry);

      const promo =
        entry.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0];
      const endDate = promo?.endDate || "";

      games.push({
        title: entry.title || "Unknown Game",
        platform: "epic",
        storeUrl,
        imageUrl,
        description: endDate
          ? `Free until ${new Date(endDate).toLocaleDateString()}`
          : "Free on Epic Games Store",
        publisher: entry.seller?.name || "Epic Games",
        genre: "Free Promotion",
        importanceScore: 80,
        isFree: true,
        metacriticScore: 0,
        originalPrice: price.originalPrice / 100,
      });
    }

    console.log(`📊 Epic Games: ${games.length} free promotions`);
    return games;
  } catch (error) {
    console.error("[Epic] Failed:", (error as Error).message);
    return [];
  }
}

// ============================================
// GOG Free Games
// Uses embedded JSON, filters DLC/demos
// Uses reviewsRating as quality indicator
// ============================================

async function getGOGFreeGames(): Promise<ScrapedGame[]> {
  try {
    const response = await axios.get("https://www.gog.com/en/games/free", {
      headers: { "User-Agent": UA },
      timeout: 20000,
    });

    const html = response.data;

    const prodIdx = html.indexOf('"products":[');
    if (prodIdx < 0) {
      console.log("📊 GOG: No products JSON found");
      return [];
    }

    let start = html.indexOf("[", prodIdx);
    let depth = 0;
    let end = start;
    for (let i = start; i < html.length; i++) {
      if (html[i] === "[") depth++;
      if (html[i] === "]") depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }

    const products = JSON.parse(html.substring(start, end));
    const games: ScrapedGame[] = [];

    for (const p of products) {
      // Exclude DLC, demos, mods, expansions, unrated; require image + free price
      if (!isGogFreeGame(p)) continue;

      const slug = p.slug || "";
      const title = p.title || "";
      const imageUrl = p.coverHorizontal || p.logo || "";

      // Quality: use reviewsRating (0-100) as proxy
      // GOG free games often lack ratings, so use a lower threshold
      const qualityScore = gogQualityScore(p);

      games.push({
        title,
        platform: "gog",
        storeUrl: `https://www.gog.com/game/${slug}`,
        imageUrl,
        description: "Free on GOG",
        publisher: p.publishers?.[0]?.name || "GOG",
        genre: "Free",
        importanceScore: qualityScore,
        isFree: true,
        metacriticScore: qualityScore,
      });
    }

    console.log(`📊 GOG: ${games.length} free games`);
    return games;
  } catch (error) {
    console.error("[GOG] Failed:", (error as Error).message);
    return [];
  }
}

// ============================================
// Main Scraper - PC platforms with quality filter
// ============================================

export async function scrapeAllPlatforms(): Promise<ScrapedGame[]> {
  console.log("🎮 Starting dynamic scrape of PC platforms...");

  const [cheapsharkGames, steamGames, epicGames, gogGames] = await Promise.all([
    getCheapSharkFreeGames(),
    getSteamFreeGames(),
    getEpicFreeGames(),
    getGOGFreeGames(),
  ]);

  // Combine
  const allGames = [
    ...cheapsharkGames,
    ...steamGames,
    ...epicGames,
    ...gogGames,
  ];

  // Deduplicate by normalized title (first source wins)
  const uniqueGames = dedupeGames(allGames);

  // Sort by importance score (Metacritic first)
  uniqueGames.sort((a, b) => b.importanceScore - a.importanceScore);

  console.log(
    `\n✅ Scraped ${uniqueGames.length} unique free games:`
  );
  console.log(
    `   CheapShark: ${cheapsharkGames.length} | Steam: ${steamGames.length} | Epic: ${epicGames.length} | GOG: ${gogGames.length}`
  );

  return uniqueGames;
}

export function calculateImportance(game: ScrapedGame): number {
  let score = game.importanceScore;
  if (game.metacriticScore && game.metacriticScore > 0) {
    score = Math.max(score, game.metacriticScore);
  }
  return Math.min(score, 100);
}

export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    steam: "Steam",
    epic: "Epic Games Store",
    gog: "GOG",
  };
  return names[platform] || platform;
}
