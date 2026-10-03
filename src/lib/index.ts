// Core library exports
export { prisma, db } from "./prisma";
export { filterGame, batchFilterGames } from "./filter";
export { config, authConfig, redisConfig } from "@/config";
export { scrapeAllPlatforms, scrapeDeals, calculateImportance } from "./api-client";

// Types
export type {
  Platform,
  NotificationChannel,
  GameImportanceScore,
  FilterConfig,
  UserPreferences,
  RawgGame,
  SteamFreeGame,
  EpicFreeGame,
  FilterContext,
  ScrapedGame,
} from "@/types";
