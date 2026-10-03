import { scrapeAllPlatforms, calculateImportance } from "@/lib/api-client";

interface RunnerResult {
  totalScraped: number;
  platformResults: Array<{
    platform: string;
    count: number;
  }>;
  games: ReturnType<typeof buildScoredGames>;
}

function buildScoredGames(games: Awaited<ReturnType<typeof scrapeAllPlatforms>>) {
  return games.map((game) => ({
    ...game,
    importanceScore: calculateImportance(game),
  }));
}

/**
 * Run the scraper dynamically - returns real-time data
 * NO database storage - all data is fetched live from platforms
 */
export async function runScraper(): Promise<RunnerResult> {
  console.log("🎮 GameAlert Scraper Started - Dynamic Mode");
  const startTime = Date.now();

  const scrapedGames = await scrapeAllPlatforms();
  const scoredGames = buildScoredGames(scrapedGames);

  const platformCounts: Record<string, number> = {};
  for (const game of scrapedGames) {
    platformCounts[game.platform] = (platformCounts[game.platform] || 0) + 1;
  }

  const totalDuration = Date.now() - startTime;
  console.log(`✅ Scraper completed in ${totalDuration}ms`);
  console.log(`   Total: ${scrapedGames.length} games`);

  return {
    totalScraped: scrapedGames.length,
    platformResults: Object.entries(platformCounts).map(([platform, count]) => ({
      platform,
      count,
    })),
    games: scoredGames,
  };
}

if (require.main === module) {
  runScraper()
    .then((result) => {
      console.log(`Done: ${result.totalScraped} games scraped`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
