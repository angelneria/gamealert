export const config = {
  app: {
    url: process.env.APP_URL || "http://localhost:3000",
    name: "GameAlert",
    version: "1.0.0",
  },

  database: {
    url: process.env.DATABASE_URL || "file:./dev.db",
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    password: process.env.REDIS_PASSWORD || undefined,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: "GameAlert <hola@gamealert.dev>",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    secure: process.env.SMTP_PORT === "465",
  },

  apis: {
    rawg: {
      baseUrl: "https://api.rawg.io/api",
      apiKey: process.env.RAWG_API_KEY || "",
    },
    steam: {
      baseUrl: "https://store.steampowered.com",
      apiKey: process.env.STEAM_API_KEY || "",
      appDetails: (appId: number) => `https://store.steampowered.com/api/appdetails?appids=${appId}`,
      freeGamesList: "https://api.steampowered.com/IStoreService/GetFilteredLabeledAppDetails/v0001/?count=200&cc=US&l=english&category=1&filter=on_sale",
    },
    epic: {
      baseUrl: "https://store.epicgames.com",
      apiKey: process.env.EPIC_GAMES_API_KEY || "",
      freeGamesEndpoint: "https://store-content.ak.epicgames.com/api/en-US/freeGames",
      catalogEndpoint: "https://catalogue-api.epicgames.com/catalogue/api/products?count=100&country=US&locale=en-US",
    },
  },

  scraping: {
    intervalMinutes: parseInt(process.env.SCRAPE_INTERVAL_MINUTES || "60", 10),
    cooldownHours: parseInt(process.env.NOTIFICATION_COOLDOWN_HOURS || "24", 10),
  },

  filtering: {
    minMetacritic: parseInt(process.env.MIN_METACRITIC_SCORE || "60", 10),
    minSteamReviews: parseInt(process.env.MIN_STEAM_REVIEWS || "5000", 10),
    minConcurrentPlayers: parseInt(process.env.MIN_CONCURRENT_PLAYERS || "5000", 10),
    whitelistedPublishers: (process.env.WHITELIST_PUBLISHERS || "").split(",").map((s) => s.trim()),
    excludeGenres: ["Free to Play", "MOBA", "FPS", "Early Access"],
    importanceThreshold: 50,
  },

  deals: {
    // Chollos: juegos rebajados con tope de precio y descuento mínimo
    defaultMaxPrice: parseInt(process.env.DEALS_DEFAULT_MAX_PRICE || "10", 10),
    defaultMinDiscount: parseInt(process.env.DEALS_DEFAULT_MIN_DISCOUNT || "75", 10),
    maxPriceCap: parseInt(process.env.DEALS_MAX_PRICE_CAP || "30", 10),
  },

  notification: {
    email: process.env.ENABLE_EMAIL === "true",
    discord: process.env.ENABLE_DISCORD === "true",
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  },

  auth: {
    secret: process.env.NEXTAUTH_SECRET || "change-this-secret",
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
  },

  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || "900", 10),
  },

  // ============================================
  // PC GAMING PLATFORMS
  // ============================================
  platforms: {
    steam: {
      id: "steam",
      name: "Steam",
      color: "#1b2838",
      url: "https://store.steampowered.com",
      freeGamesUrl: "https://store.steampowered.com/search/?maxprice=free",
      api: "https://store.steampowered.com/api/appdetails",
    },
    epic: {
      id: "epic",
      name: "Epic Games Store",
      color: "#0078F2",
      url: "https://store.epicgames.com",
      freeGamesUrl: "https://store.epicgames.com/free-games",
      api: "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions",
    },
    gog: {
      id: "gog",
      name: "GOG",
      color: "#05c876",
      url: "https://www.gog.com",
      freeGamesUrl: "https://www.gog.com/en/games/free",
      api: "https://www.gog.com",
    },
  },

  // Platform IDs for iteration
  allPlatformIds: ["steam", "epic", "gog"] as const,
} as const;

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET || "change-this-secret",
  url: process.env.NEXTAUTH_URL || "http://localhost:3000",
};

export const redisConfig = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
  password: process.env.REDIS_PASSWORD || undefined,
};
