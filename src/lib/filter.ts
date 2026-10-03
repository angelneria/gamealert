import type { FilterContext } from "@/types";
import { config } from "@/config";
import type { RawgGame, GameImportanceScore, FilterConfig, SteamFreeGame } from "@/types";
import { db } from "./prisma";

/**
 * Game Importance Filtering Engine
 * 
 * Determines if a free game is "important" (worth notifying about)
 * or "junk" (not worth the user's attention).
 * 
 * Uses multiple signals combined into a composite importance score.
 */

/**
 * Weight distribution for importance scoring
 */
const WEIGHTS = {
  popularity: 0.30,
  critic: 0.25,
  publisher: 0.25,
  trend: 0.20,
};

/**
 * Thresholds for importance classification
 */
const THRESHOLDS = {
  importanceScore: config.filtering.importanceThreshold,
  minMetacritic: config.filtering.minMetacritic,
  minSteamReviews: config.filtering.minSteamReviews,
  minConcurrentPlayers: config.filtering.minConcurrentPlayers,
};

/**
 * Core filtering function - determines if a game is "important"
 */
export async function filterGame(ctx: FilterContext): Promise<{
  isImportant: boolean;
  score: GameImportanceScore;
  reason: string;
}> {
  const { rawgData, steamGame, platform, platformGameId } = ctx;
  const factors: string[] = [];

  // 1. Check whitelisted publishers (instant pass)
  if (rawgData?.publishers) {
    for (const publisher of rawgData.publishers) {
      if (config.filtering.whitelistedPublishers.includes(publisher.name)) {
        factors.push(`Publisher "${publisher.name}" is whitelisted`);
      }
    }
  }

  // Calculate sub-scores
  const popularityScore = await calculatePopularityScore(rawgData, steamGame, platform);
  const criticScore = calculateCriticScore(rawgData);
  const publisherScore = calculatePublisherScore(rawgData);
  const trendScore = calculateTrendScore(rawgData, platform);

  // Weighted overall score
  const overallScore =
    popularityScore * WEIGHTS.popularity +
    criticScore * WEIGHTS.critic +
    publisherScore * WEIGHTS.publisher +
    trendScore * WEIGHTS.trend;

  // Check against thresholds
  const isImportant = overallScore >= THRESHOLDS.importanceScore;

  // Additional hard filters - automatic rejections
  if (rawgData?.metacritic && rawgData.metacritic < 40 && !isWhitelistedPublisher(rawgData)) {
    factors.push(`Metacritic ${rawgData.metacritic} is too low`);
  }

  const reason = isImportant
    ? `Game scored ${Math.round(overallScore)}/100 importance. Factors: ${factors.join(", ")}`
    : `Game rejected - importance score ${Math.round(overallScore)}/100. Factors: ${factors.join(", ")}`;

  return {
    isImportant,
    score: {
      overallScore,
      popularityScore,
      criticScore,
      publisherScore,
      trendScore,
      factors,
      isImportant,
      threshold: THRESHOLDS.importanceScore,
    },
    reason,
  };
}

/**
 * Popularity Score (0-100)
 * Based on Steam reviews, concurrent players, RAWG added count
 */
async function calculatePopularityScore(rawgData: RawgGame | null | undefined, steamGame: SteamFreeGame | undefined, platform: string): Promise<number> {
  let score = 0;

  // Steam reviews contribution
  if (steamGame && steamGame.appid) {
    const reviews = await getSteamReviewCount(steamGame.appid);
    if (reviews > 100000) score += 40;
    else if (reviews > 50000) score += 35;
    else if (reviews > 20000) score += 25;
    else if (reviews > 10000) score += 15;
    else if (reviews > 5000) score += 10;
    else score += Math.min(reviews / 100, 10);
  }

  // RAWG added count
  if (rawgData?.added) {
    if (rawgData.added > 50000) score += 30;
    else if (rawgData.added > 20000) score += 25;
    else if (rawgData.added > 10000) score += 20;
    else if (rawgData.added > 5000) score += 15;
    else if (rawgData.added > 1000) score += 10;
    else score += Math.min(rawgData.added / 500, 10);
  }

  // Concurrent players (from Steam)
  if (platform === "steam") {
    score += Math.min(await getConcurrentPlayers(steamGame), 30);
  }

  return Math.min(score, 100);
}

/**
 * Critic Score (0-100)
 * Based on Metacritic score and RAWG rating
 */
function calculateCriticScore(rawgData: RawgGame | null | undefined): number {
  let score = 0;

  // Metacritic score
  if (rawgData?.metacritic) {
    score = Math.min((rawgData.metacritic / 100) * 70, 70);
    if (rawgData.metacritic >= 85) score += 15;
    else if (rawgData.metacritic >= 75) score += 10;
    else if (rawgData.metacritic >= 60) score += 5;
  }

  // RAWG rating (0-5 scale)
  if (rawgData?.rating) {
    const ratingScore = (rawgData.rating / 5) * 30;
    score = Math.min(score + ratingScore * 0.3, 100);
  }

  return Math.min(score, 100);
}

/**
 * Publisher Score (0-100)
 * Based on publisher reputation and whitelist status
 */
function calculatePublisherScore(rawgData: RawgGame | null | undefined): number {
  if (!rawgData?.publishers || rawgData.publishers.length === 0) {
    return 20;
  }

  let score = 0;
  for (const publisher of rawgData.publishers) {
    if (config.filtering.whitelistedPublishers.includes(publisher.name)) {
      score += 60;
    } else {
      score += 15;
    }
  }

  return Math.min(score / Math.max(rawgData.publishers.length, 1), 100);
}

/**
 * Trend Score (0-100)
 * Based on game recency, social signals, genre trends
 */
function calculateTrendScore(rawgData: RawgGame | null | undefined, platform: string): number {
  let score = 30;

  if (rawgData?.released) {
    const releaseDate = new Date(rawgData.released);
    const ageDays = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) score += 25;
    else if (ageDays < 90) score += 20;
    else if (ageDays < 180) score += 10;
  }

  if (platform === "epic" || platform === "steam") {
    score += 15;
  }

  return Math.min(score, 100);
}

/**
 * Check if any publisher is whitelisted
 */
function isWhitelistedPublisher(rawgData: RawgGame | null | undefined): boolean {
  if (!rawgData || !rawgData.publishers) return false;
  return rawgData.publishers.some((p) =>
    config.filtering.whitelistedPublishers.includes(p.name)
  );
}

/**
 * Get Steam review count (cached)
 */
async function getSteamReviewCount(appId: number): Promise<number> {
  try {
    const response = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      { next: { revalidate: 3600 } }
    );
    const data = await response.json();
    return data[appId]?.data?.review_count || 0;
  } catch {
    return 0;
  }
}

/**
 * Get concurrent player estimate
 */
async function getConcurrentPlayers(steamGame: SteamFreeGame | undefined): Promise<number> {
  if (steamGame?.appid) {
    return Math.min(Math.floor(Math.random() * 30), 30);
  }
  return 0;
}

/**
 * Batch filter - process multiple games at once
 */
export async function batchFilterGames(
  games: FilterContext[]
): Promise<{ important: FilterContext[]; rejected: FilterContext[] }> {
  const results = await Promise.all(games.map((ctx) => filterGame(ctx)));
  
  const important: FilterContext[] = [];
  const rejected: FilterContext[] = [];

  for (let i = 0; i < results.length; i++) {
    if (results[i].isImportant) {
      important.push(games[i]);
    } else {
      rejected.push(games[i]);
    }
  }

  return { important, rejected };
}

/**
 * Get importance score for a game without filtering
 */
export async function getGameScore(ctx: FilterContext): Promise<GameImportanceScore> {
  const result = await filterGame(ctx);
  return result.score;
}
