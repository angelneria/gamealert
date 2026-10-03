import { NextRequest, NextResponse } from "next/server";
import { scrapeAllPlatforms, calculateImportance } from "@/lib/api-client";
import { config } from "@/config";
import { gamesQuerySchema } from "@/lib/validation";

/**
 * GET /api/games — Devuelve juegos gratis en tiempo real
 * Query params: platform, minMetacritic
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = gamesQuerySchema.safeParse({
      platform: searchParams.get("platform") || undefined,
      minMetacritic: searchParams.get("minMetacritic") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Parámetros no válidos" },
        { status: 400 }
      );
    }

    const { platform, minMetacritic } = parsed.data;
    const threshold = minMetacritic ?? config.filtering.minMetacritic;

    // Dynamically scrape all platforms
    const games = await scrapeAllPlatforms();

    // Calculate importance for each game
    const scoredGames = games.map((game) => ({
      ...game,
      importanceScore: calculateImportance(game),
    }));

    // Filter by platform if specified
    let filtered =
      platform && platform !== "all"
        ? scoredGames.filter((g) => g.platform === platform)
        : scoredGames;

    // Filter by minimum Metacritic score (quality filter)
    if (threshold > 0) {
      filtered = filtered.filter(
        (g) => (g.metacriticScore || 0) >= threshold
      );
    }

    return NextResponse.json({
      games: filtered,
      total: filtered.length,
      totalScraped: scoredGames.length,
      minMetacritic: threshold,
      timestamp: new Date().toISOString(),
      source: "live-scrape",
    });
  } catch (error) {
    console.error("[Games API] Error:", error);
    return NextResponse.json(
      { error: "Failed to scrape games", games: [], total: 0 },
      { status: 500 }
    );
  }
}
