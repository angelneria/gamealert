import { NextRequest, NextResponse } from "next/server";
import { scrapeAllPlatforms, calculateImportance } from "@/lib/api-client";

/**
 * POST /api/games/scrape
 * Trigger a fresh scrape of all platforms
 * Returns real-time data - nothing stored
 */
export async function POST(req: NextRequest) {
  try {
    const games = await scrapeAllPlatforms();

    const scoredGames = games.map((game) => ({
      ...game,
      importanceScore: calculateImportance(game),
    }));

    return NextResponse.json({
      message: "Scrape completed - real-time data",
      result: {
        totalGames: scoredGames.length,
        timestamp: new Date().toISOString(),
        source: "live-scrape",
      },
      games: scoredGames,
    });
  } catch (error) {
    console.error("[Scrape] Error:", error);
    return NextResponse.json(
      { error: "Scraping failed", games: [] },
      { status: 500 }
    );
  }
}
