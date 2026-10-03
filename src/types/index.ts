// ============================================
// Core Type Definitions
// ============================================

export type Platform = "steam" | "epic" | "gog" | "humble" | "origin" | "ubisoft" | "xbox" | "itch" | "nintendo" | "playstation" | "microsoft" | "battle_net" | "greenman" | "amazon";

export type NotificationChannel = "email" | "discord" | "push";

export type NotificationStatus = "sent" | "failed" | "pending";

export type ScrapingStatus = "running" | "success" | "error";

export interface GamePlatform {
  steam: {
    apiUrl: string;
    freeGamesUrl: string;
    storeUrl: string;
  };
  epic: {
    apiUrl: string;
    freeGamesUrl: string;
    storeUrl: string;
  };
  gog: {
    apiUrl: string;
    freeGamesUrl: string;
    storeUrl: string;
  };
}

export interface RawgGame {
  id: number;
  name: string;
  slug: string;
  description: string;
  released: string;
  tba: boolean;
  background_image: string;  website: string | null;
  rating: number;
  rating_top: number;
  added: number;
  playtime: number;
  suggestions_count: number;
  metacritic: number | null;
  stores: Array<{
    store: { id: number; name: string; slug: string };
    price: {
      amount: number;
      conversion_rate: number;
    };
  }>;
  tags: Array<{
    id: number;
    name: string;
  }>;
  publishers: Array<{
    id: number;
    name: string;
    image: string | null;
    slug: string;
  }>;
  developers: Array<{
    id: number;
    name: string;
    image: string | null;
    slug: string;
  }>;
  genres: Array<{
    id: number;
    name: string;
  }>;
  parent_platforms: Array<{
    platform: {
      id: number;
      name: string;
      slug: string;
    };
  }>;
  clip?: {
    key: string;
    video_id: string | null;
    percent: number | null;
  } | null;
}

export interface SteamFreeGame {
  appid: number;
  name: string;
  type: string;
  is_free: boolean;
  discount_pct: number;
  initial: string;
  final: string;
  currency: string;
  header_image: string;
  platforms: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  };
  capsule_logo: string;
  capsule_small: string;
  logo: string;
  thumb: string;
  steam_url: string;
  store_url: string;
  is_free_license: boolean;
  is_trial: boolean;
}

export interface EpicFreeGame {
  id: string;
  namespace: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  sku: string;
  promotionType: string;
  images: Array<{
    type: string;
    url: string;
  }>;
  productSlug: string;
  url: string;
  originalPrice?: string;
  currentPrice?: string;
}

export interface GameImportanceScore {
  overallScore: number;
  popularityScore: number;
  criticScore: number;
  publisherScore: number;
  trendScore: number;
  factors: string[];
  isImportant: boolean;
  threshold: number;
}

export interface NotificationPayload {
  gameTitle: string;
  platform: string;
  storeUrl: string;
  imageUrl?: string;
  metacriticScore?: number;
  reviewCount?: number;
  publisher?: string;
  importanceScore: number;
  userEmail: string;
}

export interface ScrapeResult {
  platform: string;
  status: ScrapingStatus;
  gamesFound: number;
  gamesSaved: number;
  gamesUpdated: number;
  errors: string[];
  duration: number;
}

export interface FilterConfig {
  minMetacritic: number;
  minReviews: number;
  minConcurrentPlayers: number;
  whitelistedPublishers: string[];
  excludeGenres: string[];
  maxAgeDays: number;
}

export interface UserPreferences {
  platforms: Platform[];
  minMetacritic: number;
  minReviews: number;
  whitelistedPublishers: string[];
  channels: NotificationChannel[];
  cooldownHours: number;
}

export interface FilterContext {
  platformGameId: string;
  platform: string;
  rawgData: RawgGame | null | undefined;
  steamGame?: SteamFreeGame;
}

export interface ScrapedGame {
  title: string;
  platform: string;
  storeUrl: string;
  imageUrl: string;
  description: string;
  publisher: string;
  genre: string;
  importanceScore: number;
}
