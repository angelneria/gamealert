import {
  matchesPlatforms,
  meetsMetacriticThreshold,
  isOnCooldown,
  selectNewGamesForUser,
  shouldSendDiscord,
  shouldSendEmail,
  channelsForUser,
  limitRunBatch,
  MAX_DEALS_PER_RUN,
  type UserNotificationPrefs,
} from "@/lib/notification-filter";
import type { ScrapedGame } from "@/lib/api-client";

function makeGame(
  title: string,
  platform: string,
  metacriticScore = 0,
  importanceScore = 50
): ScrapedGame {
  return {
    title,
    platform,
    storeUrl: "https://example.com",
    imageUrl: "https://example.com/img.jpg",
    description: "test",
    publisher: "Test",
    genre: "Test",
    importanceScore,
    isFree: true,
    metacriticScore,
  };
}

function makePrefs(
  overrides: Partial<UserNotificationPrefs> = {}
): UserNotificationPrefs {
  return {
    id: "user-1",
    email: "user@test.dev",
    platforms: ["steam", "epic", "gog"],
    discordWebhookUrl: "https://discord.com/api/webhooks/1/abc",
    discordEnabled: true,
    emailEnabled: true,
    minMetacritic: 60,
    cooldownHours: 24,
    dealsEnabled: false,
    maxDealPrice: 10,
    minDiscountPct: 75,
    ...overrides,
  };
}

describe("matchesPlatforms", () => {
  it("includes game when platform is selected", () => {
    expect(matchesPlatforms(makeGame("A", "steam"), ["steam"])).toBe(true);
  });
  it("excludes game on unselected platform", () => {
    expect(matchesPlatforms(makeGame("A", "gog"), ["steam", "epic"])).toBe(
      false
    );
  });
  it("empty platform list means all platforms", () => {
    expect(matchesPlatforms(makeGame("A", "gog"), [])).toBe(true);
  });
});

describe("meetsMetacriticThreshold", () => {
  it("passes when metacritic meets the bar", () => {
    expect(meetsMetacriticThreshold(makeGame("A", "steam", 84), 60)).toBe(
      true
    );
  });
  it("fails when metacritic below the bar", () => {
    expect(meetsMetacriticThreshold(makeGame("A", "steam", 50), 60)).toBe(
      false
    );
  });
  it("falls back to importanceScore when unrated", () => {
    expect(
      meetsMetacriticThreshold(makeGame("A", "steam", 0, 70), 60)
    ).toBe(true);
    expect(
      meetsMetacriticThreshold(makeGame("A", "steam", 0, 40), 60)
    ).toBe(false);
  });
  it("threshold 0 accepts everything (unrated included)", () => {
    expect(meetsMetacriticThreshold(makeGame("A", "steam", 0, 0), 0)).toBe(
      true
    );
  });
});

describe("isOnCooldown", () => {
  it("detects already-notified title (case/format insensitive)", () => {
    const notified = new Set(["systemshock2"]);
    expect(isOnCooldown("System Shock 2", notified)).toBe(true);
    expect(isOnCooldown("system shock 2!", notified)).toBe(true);
  });
  it("returns false for unseen titles", () => {
    const notified = new Set(["systemshock2"]);
    expect(isOnCooldown("Hades", notified)).toBe(false);
  });
});

describe("selectNewGamesForUser", () => {
  const games = [
    makeGame("System Shock 2", "steam", 84),
    makeGame("BURIED STARS", "epic", 0, 30),
    makeGame("Old Game", "gog", 90),
    makeGame("Other Platform", "humble", 95),
  ];

  it("keeps games matching platform + quality, drops the rest", () => {
    const prefs = makePrefs({ platforms: ["steam", "epic", "gog"], minMetacritic: 60 });
    const { newGames, skipped } = selectNewGamesForUser(games, prefs, new Set());
    expect(newGames.map((g) => g.title)).toEqual([
      "System Shock 2",
      "Old Game",
    ]);
    expect(skipped).toBe(0);
  });

  it("respects user platform selection", () => {
    const prefs = makePrefs({ platforms: ["epic"], minMetacritic: 0 });
    const { newGames } = selectNewGamesForUser(games, prefs, new Set());
    expect(newGames.map((g) => g.title)).toEqual(["BURIED STARS"]);
  });

  it("counts cooldown games as skipped, not new", () => {
    const prefs = makePrefs({ minMetacritic: 0 });
    const notified = new Set(["oldgame"]);
    const { newGames, skipped } = selectNewGamesForUser(
      games,
      prefs,
      notified
    );
    expect(newGames.map((g) => g.title)).not.toContain("Old Game");
    expect(skipped).toBe(1);
  });

  it("empty platform list selects every platform", () => {
    const prefs = makePrefs({ platforms: [], minMetacritic: 0 });
    const { newGames } = selectNewGamesForUser(games, prefs, new Set());
    expect(newGames).toHaveLength(4);
  });

  it("combines all three gates at once", () => {
    const prefs = makePrefs({
      platforms: ["steam"],
      minMetacritic: 80,
    });
    const notified = new Set(["systemshock2"]);
    const { newGames, skipped } = selectNewGamesForUser(
      games,
      prefs,
      notified
    );
    // System Shock 2 is steam+quality but on cooldown; Other Platform fails platform gate
    expect(newGames).toEqual([]);
    expect(skipped).toBe(1);
  });
});

describe("channel gating", () => {
  it("sends Discord only when enabled AND webhook configured", () => {
    expect(shouldSendDiscord(makePrefs())).toBe(true);
    expect(
      shouldSendDiscord(makePrefs({ discordEnabled: false }))
    ).toBe(false);
    expect(
      shouldSendDiscord(makePrefs({ discordWebhookUrl: "" }))
    ).toBe(false);
  });

  it("email follows the emailEnabled flag", () => {
    expect(shouldSendEmail(makePrefs())).toBe(true);
    expect(shouldSendEmail(makePrefs({ emailEnabled: false }))).toBe(false);
  });

  it("channelsForUser lists only enabled+possible channels", () => {
    expect(channelsForUser(makePrefs())).toEqual(["discord", "email"]);
    expect(
      channelsForUser(makePrefs({ discordWebhookUrl: "" }))
    ).toEqual(["email"]);
    expect(
      channelsForUser(makePrefs({ emailEnabled: false }))
    ).toEqual(["discord"]);
    expect(
      channelsForUser(
        makePrefs({ emailEnabled: false, discordWebhookUrl: "" })
      )
    ).toEqual([]);
  });
});

// --------------------------------------------
// Chollos (juegos rebajados)
// --------------------------------------------

function makeDeal(
  title: string,
  salePrice: number,
  discountPct: number,
  overrides: Partial<ScrapedGame> = {}
): ScrapedGame {
  return {
    title,
    platform: "steam",
    storeUrl: "https://example.com",
    imageUrl: "",
    description: "chollo",
    publisher: "",
    genre: "",
    importanceScore: 80,
    isFree: false,
    metacriticScore: 80,
    originalPrice: salePrice * 4,
    salePrice,
    discountPct,
    ...overrides,
  };
}

describe("chollos en selectNewGamesForUser", () => {
  const deals = [
    makeDeal("Barato", 4.99, 75),
    makeDeal("Caro", 25, 90),
    makeDeal("Poco rebajado", 3, 30),
    makeDeal("Regateado", 0.5, 95),
  ];

  it("envía el chollo que cabe en el presupuesto y cumple el descuento mínimo", () => {
    const prefs = makePrefs({
      dealsEnabled: true,
      maxDealPrice: 10,
      minDiscountPct: 75,
    });
    const { newGames } = selectNewGamesForUser(deals, prefs, new Set());
    expect(newGames.map((g) => g.title)).toEqual(["Barato", "Regateado"]);
  });

  it("con los chollos desactivados no se envía ni uno", () => {
    const prefs = makePrefs({ dealsEnabled: false });
    expect(selectNewGamesForUser(deals, prefs, new Set()).newGames).toEqual(
      []
    );
  });

  it("los chollos filtrados por precio/descuento NO cuentan como cooldown (skipped=0)", () => {
    const prefs = makePrefs({
      dealsEnabled: true,
      maxDealPrice: 10,
      minDiscountPct: 75,
    });
    const { newGames, skipped } = selectNewGamesForUser(deals, prefs, new Set());
    expect(newGames).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("el tope de precio es inclusivo: exactamente maxDealPrice pasa, un centésimo más no", () => {
    const prefs = makePrefs({
      dealsEnabled: true,
      maxDealPrice: 5,
      minDiscountPct: 75,
    });
    const atCap = selectNewGamesForUser(
      [makeDeal("Justo", 5, 80)],
      prefs,
      new Set()
    );
    expect(atCap.newGames).toHaveLength(1);

    const overCap = selectNewGamesForUser(
      [makeDeal("Justo", 5.01, 80)],
      prefs,
      new Set()
    );
    expect(overCap.newGames).toHaveLength(0);
  });

  it("el descuento mínimo es inclusivo: -75% pasa con minDiscountPct=75, -74% no", () => {
    const prefs = makePrefs({ dealsEnabled: true, maxDealPrice: 10, minDiscountPct: 75 });
    expect(
      selectNewGamesForUser([makeDeal("Exacto", 2, 75)], prefs, new Set()).newGames
    ).toHaveLength(1);
    expect(
      selectNewGamesForUser([makeDeal("Casi", 2, 74)], prefs, new Set()).newGames
    ).toHaveLength(0);
  });

  it("un chollo sin datos de precio/descuento se descarta (fail-closed)", () => {
    const prefs = makePrefs({ dealsEnabled: true, maxDealPrice: 30, minDiscountPct: 0 });
    const broken = makeDeal("Roto", 2, 80, { salePrice: undefined });
    expect(
      selectNewGamesForUser([broken], prefs, new Set()).newGames
    ).toHaveLength(0);
  });

  it("los juegos gratis NO se ven afectados por los filtros de chollo", () => {
    const freeGame = makeGame("Gratis", "steam", 80);
    const prefs = makePrefs({
      dealsEnabled: false,
      maxDealPrice: 1,
      minDiscountPct: 99,
    });
    expect(
      selectNewGamesForUser([freeGame], prefs, new Set()).newGames
    ).toHaveLength(1);
  });

  it("los chollos pasan también por plataforma, Metacritic y cooldown", () => {
    const prefs = makePrefs({
      dealsEnabled: true,
      maxDealPrice: 10,
      minDiscountPct: 75,
      platforms: ["epic"],
      minMetacritic: 60,
    });

    // Fuera por plataforma (el chollo es de Steam)
    const wrongPlatform = selectNewGamesForUser(
      [makeDeal("SteamDeal", 2, 90, { platform: "steam" })],
      prefs,
      new Set()
    );
    expect(wrongPlatform.newGames).toHaveLength(0);

    // En cooldown → contado como skipped
    const onCooldown = selectNewGamesForUser(
      [makeDeal("EpicDeal", 2, 90, { platform: "epic" })],
      prefs,
      new Set(["epicdeal"])
    );
    expect(onCooldown.newGames).toHaveLength(0);
    expect(onCooldown.skipped).toBe(1);

    // Sin puntuación → fuera por el filtro de calidad
    const unrated = selectNewGamesForUser(
      [makeDeal("SinMeta", 2, 90, { platform: "epic", metacriticScore: 0, importanceScore: 0 })],
      prefs,
      new Set()
    );
    expect(unrated.newGames).toHaveLength(0);
  });
});

// --------------------------------------------
// Tope de chollos por ejecución
// --------------------------------------------

describe("limitRunBatch (tope de chollos por ejecución)", () => {
  const free = makeGame("Gratis", "steam", 80);
  // 15 chollos con puntuaciones crecientes: Chollo 1 = 50 ... Chollo 15 = 64
  const manyDeals = Array.from({ length: 15 }, (_, i) =>
    makeDeal(`Chollo ${i + 1}`, 4.99, 75 + (i % 5), {
      importanceScore: 50 + i,
    })
  );

  it("el tope por defecto es 10 chollos por ejecución", () => {
    expect(MAX_DEALS_PER_RUN).toBe(10);
  });

  it("limita los chollos al tope y cuenta los que quedan aplazados", () => {
    const { toSend, deferred } = limitRunBatch([free, ...manyDeals]);
    expect(toSend.filter((g) => !g.isFree)).toHaveLength(10);
    expect(deferred).toBe(5);
  });

  it("los juegos gratis pasan siempre (sin tope) y salen primero", () => {
    const frees = [makeGame("G1", "steam", 80), makeGame("G2", "epic", 80)];
    const { toSend } = limitRunBatch([...frees, ...manyDeals]);
    expect(toSend.slice(0, 2).map((g) => g.title)).toEqual(["G1", "G2"]);
    expect(toSend.filter((g) => g.isFree)).toHaveLength(2);
  });

  it("envía los chollos de mayor a menor puntuación; los peores esperan", () => {
    const { toSend } = limitRunBatch([free, ...manyDeals]);
    const titles = toSend.filter((g) => !g.isFree).map((g) => g.title);
    expect(titles[0]).toBe("Chollo 15"); // puntuación 64
    expect(titles[titles.length - 1]).toBe("Chollo 6"); // puntuación 55
    expect(titles).not.toContain("Chollo 5"); // 54 → aplazado
    expect(titles).not.toContain("Chollo 1"); // 50 → aplazado
  });

  it("con 10 chollos o menos no se aplaza ninguno", () => {
    const { toSend, deferred } = limitRunBatch([
      free,
      ...manyDeals.slice(0, 10),
    ]);
    expect(deferred).toBe(0);
    expect(toSend).toHaveLength(11);
  });

  it("respeta un tope distinto pasado como parámetro", () => {
    expect(limitRunBatch(manyDeals, 3).toSend).toHaveLength(3);
    expect(limitRunBatch(manyDeals, 3).deferred).toBe(12);
    expect(limitRunBatch(manyDeals, 0).toSend).toEqual([]);
    expect(limitRunBatch(manyDeals, 0).deferred).toBe(15);
  });

  it("con la misma puntuación gana el mayor descuento", () => {
    const poco = makeDeal("Poco", 4.99, 76, { importanceScore: 60 });
    const mucho = makeDeal("Mucho", 4.99, 95, { importanceScore: 60 });
    const { toSend } = limitRunBatch([poco, mucho], 1);
    expect(toSend.map((g) => g.title)).toEqual(["Mucho"]);
  });

  it("no muta la lista de entrada", () => {
    const input = [free, ...manyDeals];
    const before = input.map((g) => g.title);
    limitRunBatch(input);
    expect(input.map((g) => g.title)).toEqual(before);
  });
});
