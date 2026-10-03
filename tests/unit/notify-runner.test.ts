/**
 * Notify-runner behavioral tests — the "SOLO JUEGOS NUEVOS" guarantee.
 *
 * Proves end-to-end (runner + filters + cooldown) that:
 *  - a game already delivered is NEVER sent again while on cooldown
 *  - a genuinely new game IS sent while the old ones stay silent
 *  - failed deliveries are retried (they never arrived) until delivered
 *  - overlapping triggers (cron + manual button) share ONE execution
 *  - the cooldown window actually expires (re-announce after N hours)
 */
import { runNotifications } from "@/server/notify-runner";
import type { ScrapedGame } from "@/lib/api-client";
import { scrapeAllPlatforms, scrapeDeals } from "@/lib/api-client";
import { sendDiscordDigest } from "@/server/discord";
import { sendDigestEmail, isEmailConfigured } from "@/server/notemail";

// ---------- in-memory database ----------
const mockState = {
  users: [] as any[],
  notifications: [] as any[],
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(async () => mockState.users),
    },
    notification: {
      findMany: jest.fn(async (args: any) =>
        mockState.notifications.filter(
          (n: any) =>
            n.userId === args.where.userId &&
            n.status === args.where.status &&
            n.sentAt >= args.where.sentAt.gte
        )
      ),
      create: jest.fn(async (args: any) => {
        const row = {
          id: `n${mockState.notifications.length + 1}`,
          sentAt: new Date(),
          ...args.data,
        };
        mockState.notifications.push(row);
        return row;
      }),
    },
  },
}));

// ---------- external side effects ----------
jest.mock("@/lib/api-client", () => ({
  scrapeAllPlatforms: jest.fn(),
  scrapeDeals: jest.fn(),
}));
jest.mock("@/server/discord", () => ({
  sendDiscordNotification: jest.fn(),
  sendDiscordDigest: jest.fn(),
  isValidDiscordWebhook: jest.fn(() => true),
}));
jest.mock("@/server/notemail", () => ({
  sendEmailNotification: jest.fn(),
  sendDigestEmail: jest.fn(),
  isEmailConfigured: jest.fn(() => false),
}));

const mockScrape = scrapeAllPlatforms as unknown as jest.Mock;
const mockDeals = scrapeDeals as unknown as jest.Mock;
const mockDiscord = sendDiscordDigest as unknown as jest.Mock;
const mockDigestEmail = sendDigestEmail as unknown as jest.Mock;
const mockEmailConfigured = isEmailConfigured as unknown as jest.Mock;

// ---------- fixtures ----------
const user = {
  id: "u1",
  email: "only-new@test.dev",
  platforms: "epic",
  discordWebhookUrl: "https://discord.com/api/webhooks/1/token",
  discordEnabled: true,
  emailEnabled: false,
  minMetacritic: 0,
  cooldownHours: 24,
};

function makeGame(title: string): ScrapedGame {
  return {
    title,
    platform: "epic",
    storeUrl: `https://store.epic.games/${title.toLowerCase().replace(/\s+/g, "-")}`,
    imageUrl: "",
    description: "descripcion",
    publisher: "Publisher",
    genre: "Accion",
    importanceScore: 80,
    isFree: true,
    metacriticScore: 80,
    originalPrice: 19.99,
  };
}

const gameA = makeGame("Juego A");
const gameB = makeGame("Juego B");

beforeEach(() => {
  jest.clearAllMocks();
  mockState.users = [{ ...user }];
  mockState.notifications = [];
  mockScrape.mockResolvedValue([gameA]);
  mockDeals.mockResolvedValue([]);
  mockDiscord.mockResolvedValue(true);
  mockDigestEmail.mockResolvedValue(true);
  mockEmailConfigured.mockReturnValue(false);
});

describe("runNotifications — solo juegos nuevos", () => {
  it("sends a new game once; the second run does NOT resend it", async () => {
    const first = await runNotifications();
    expect(mockDiscord).toHaveBeenCalledTimes(1);
    expect(first.notified).toBe(1);
    expect(mockState.notifications).toHaveLength(1);
    expect(mockState.notifications[0]).toMatchObject({
      gameTitle: "Juego A",
      channel: "discord",
      status: "sent",
    });

    // Same game still free → nothing new to report
    const second = await runNotifications();
    expect(mockDiscord).toHaveBeenCalledTimes(1); // still one send total
    expect(second.notified).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1); // counted as cooldown skip
    expect(mockState.notifications).toHaveLength(1); // no duplicate rows
  });

  it("sends a genuinely NEW game while the old one stays on cooldown", async () => {
    await runNotifications(); // sends Juego A

    mockScrape.mockResolvedValue([gameA, gameB]); // Juego B appears later
    const result = await runNotifications();

    expect(result.notified).toBe(1); // only the new one
    expect(mockDiscord).toHaveBeenCalledTimes(2);
    const lastDigest = mockDiscord.mock.calls[1][0];
    expect(lastDigest).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Juego B" })])
    );
    expect(mockDiscord.mock.calls[1][1]).toBe(user.discordWebhookUrl);
    // A was not re-sent
    const titles = mockState.notifications.map((n: any) => n.gameTitle);
    expect(titles.filter((t: string) => t === "Juego A")).toHaveLength(1);
  });

  it("retries FAILED deliveries (they never arrived) and locks once sent", async () => {
    mockDiscord.mockResolvedValueOnce(false); // first attempt fails

    const first = await runNotifications();
    expect(first.failed).toBe(1);
    expect(mockState.notifications[0].status).toBe("failed");

    // Not "sent" → eligible again next run; this time it arrives
    const second = await runNotifications();
    expect(mockDiscord).toHaveBeenCalledTimes(2);
    expect(second.notified).toBe(1);
    expect(mockState.notifications[1].status).toBe("sent");

    // Delivered now → on cooldown, no more attempts
    const third = await runNotifications();
    expect(mockDiscord).toHaveBeenCalledTimes(2);
    expect(third.notified).toBe(0);
  });

  it("dry-run email (SMTP not configured) never counts as a real delivery", async () => {
    mockState.users = [{ ...user, discordEnabled: false, emailEnabled: true }];

    await runNotifications();
    await runNotifications();

    // Nothing was actually sent, so the digest sender was never invoked...
    expect(mockDigestEmail).not.toHaveBeenCalled();
    // ...and no row is ever marked "sent" (user can't receive duplicates)
    expect(mockState.notifications.every((n: any) => n.status !== "sent")).toBe(
      true
    );
  });

  it("overlapping triggers (cron + button) share ONE execution — no double send", async () => {
    const p1 = runNotifications();
    const p2 = runNotifications(); // fired while the first is still running

    expect(p2).toBe(p1); // same in-flight promise

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(mockScrape).toHaveBeenCalledTimes(1); // scraped once
    expect(mockDiscord).toHaveBeenCalledTimes(1); // sent once
    expect(r1).toBe(r2);
    expect(r1.notified).toBe(1);

    // A later trigger (after completion) runs fresh
    await runNotifications();
    expect(mockScrape).toHaveBeenCalledTimes(2);
    expect(mockDiscord).toHaveBeenCalledTimes(1); // still no resend
  });

  it("re-announces only after the cooldown window expires", async () => {
    // Delivered 1 hour ago → still on cooldown (24h)
    mockState.notifications = [
      {
        id: "old1",
        userId: user.id,
        gameTitle: "Juego A",
        platform: "epic",
        storeUrl: gameA.storeUrl,
        channel: "discord",
        status: "sent",
        sentAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
    ];
    const recent = await runNotifications();
    expect(mockDiscord).not.toHaveBeenCalled();
    expect(recent.notified).toBe(0);

    // Delivered 25 hours ago → window expired, eligible again
    mockState.notifications[0].sentAt = new Date(
      Date.now() - 25 * 60 * 60 * 1000
    );
    const expired = await runNotifications();
    expect(mockDiscord).toHaveBeenCalledTimes(1);
    expect(expired.notified).toBe(1);
  });
});

describe("runNotifications — chollos (juegos rebajados)", () => {
  const dealUser = {
    ...user,
    dealsEnabled: true,
    maxDealPrice: 10,
    minDiscountPct: 75,
  };

  const dealGame: ScrapedGame = {
    ...makeGame("Chollo Bomba"),
    isFree: false,
    salePrice: 4.99,
    discountPct: 80,
    originalPrice: 39.99,
  };

  it("envía un chollo nuevo a un usuario con deals activados (con precio en el mensaje)", async () => {
    mockState.users = [{ ...dealUser }];
    mockScrape.mockResolvedValue([]); // sin juegos gratis ahora mismo
    mockDeals.mockResolvedValue([dealGame]);

    const result = await runNotifications();

    expect(result.notified).toBe(1);
    expect(mockDeals).toHaveBeenCalledTimes(1);
    expect(mockDeals).toHaveBeenCalledWith(10); // tope del usuario
    expect(mockDiscord).toHaveBeenCalledTimes(1);
    const digest = mockDiscord.mock.calls[0][0];
    expect(digest).toEqual([
      expect.objectContaining({
        title: "Chollo Bomba",
        isFree: false,
        salePrice: 4.99,
        discountPct: 80,
        originalPrice: 39.99,
      }),
    ]);
    expect(mockDiscord.mock.calls[0][1]).toBe(user.discordWebhookUrl);
  });

  it("NO scrapea chollos si ningún usuario los tiene activados", async () => {
    mockScrape.mockResolvedValue([gameA]);
    mockDeals.mockResolvedValue([dealGame]); // no debe usarse

    const result = await runNotifications();

    expect(mockDeals).not.toHaveBeenCalled();
    expect(result.notified).toBe(1); // solo el juego gratis
    expect(mockDiscord).toHaveBeenCalledTimes(1);
    expect(mockDiscord.mock.calls[0][0]).toEqual([
      expect.objectContaining({ title: "Juego A" }),
    ]);
  });

  it("NO envía un chollo por encima del presupuesto del usuario", async () => {
    mockState.users = [{ ...dealUser, maxDealPrice: 5 }];
    mockScrape.mockResolvedValue([]);
    mockDeals.mockResolvedValue([{ ...dealGame, salePrice: 12.99 }]);

    const result = await runNotifications();

    expect(result.notified).toBe(0);
    expect(mockDiscord).not.toHaveBeenCalled();
    expect(mockState.notifications).toHaveLength(0);
  });

  it("NO envía un chollo por debajo de su descuento mínimo", async () => {
    mockState.users = [{ ...dealUser, minDiscountPct: 90 }];
    mockScrape.mockResolvedValue([]);
    mockDeals.mockResolvedValue([{ ...dealGame, discountPct: 75 }]);

    const result = await runNotifications();

    expect(result.notified).toBe(0);
    expect(mockDiscord).not.toHaveBeenCalled();
  });

  it("un título gratis Y rebajado se notifica UNA sola vez (gana el gratis)", async () => {
    mockState.users = [{ ...dealUser }];
    mockScrape.mockResolvedValue([gameA]);
    mockDeals.mockResolvedValue([{ ...dealGame, title: gameA.title }]);

    const result = await runNotifications();

    expect(mockDiscord).toHaveBeenCalledTimes(1);
    expect(result.notified).toBe(1);
    expect(mockState.notifications).toHaveLength(1);
    expect(mockState.notifications[0].gameTitle).toBe(gameA.title);
    expect(mockDiscord.mock.calls[0][0]).toEqual([
      expect.objectContaining({ isFree: true }),
    ]);
  });

  it("el chollo enviado entra en cooldown: el segundo run no lo reenvía", async () => {
    mockState.users = [{ ...dealUser }];
    mockScrape.mockResolvedValue([]);
    mockDeals.mockResolvedValue([dealGame]);

    const first = await runNotifications();
    expect(first.notified).toBe(1);

    const second = await runNotifications();
    expect(mockDiscord).toHaveBeenCalledTimes(1);
    expect(second.notified).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);
    expect(mockState.notifications).toHaveLength(1);
  });
});

describe("runNotifications — tope de chollos por ejecución", () => {
  const dealUser = {
    ...user,
    dealsEnabled: true,
    maxDealPrice: 10,
    minDiscountPct: 75,
  };

  // 15 chollos que cascan: puntuación Chollo 01 → 40 ... Chollo 15 → 53
  const manyDeals: ScrapedGame[] = Array.from({ length: 15 }, (_, i) => ({
    ...makeGame(`Chollo ${String(i + 1).padStart(2, "0")}`),
    isFree: false,
    salePrice: 4.99,
    discountPct: 80,
    originalPrice: 39.99,
    importanceScore: 40 + i,
  }));

  beforeEach(() => {
    mockState.users = [{ ...dealUser }];
    mockScrape.mockResolvedValue([]);
    mockDeals.mockResolvedValue(manyDeals);
  });

  it("la primera ejecución envía como máximo 10 chollos, los mejores, en UN resumen", async () => {
    const result = await runNotifications();

    expect(mockDiscord).toHaveBeenCalledTimes(1); // un solo resumen
    expect(result.notified).toBe(10);
    expect(mockState.notifications).toHaveLength(10);

    const digest = mockDiscord.mock.calls[0][0];
    expect(digest).toHaveLength(10);
    const titles = digest.map((g: any) => g.title);
    expect(titles[0]).toBe("Chollo 15"); // mayor puntuación
    expect(titles).toContain("Chollo 06"); // décimo mejor
    expect(titles).not.toContain("Chollo 05"); // se queda para el próximo pase
  });

  it("los aplazados salen después: nada se pierde y nada se repite", async () => {
    await runNotifications(); // 10 enviados, 5 en cola

    const second = await runNotifications();
    expect(second.notified).toBe(5); // exactamente las 5 restantes

    const third = await runNotifications();
    expect(third.notified).toBe(0); // todo notificado y en cooldown

    const titles = mockDiscord.mock.calls.flatMap((c: any[]) =>
      (c[0] as any[]).map((g: any) => g.title)
    );
    expect(titles).toHaveLength(15);
    expect(new Set(titles).size).toBe(15); // ningún título repetido
  });

  it("los juegos gratis no se ven afectados por el tope", async () => {
    const freeGames = Array.from({ length: 12 }, (_, i) =>
      makeGame(`Gratis ${i + 1}`)
    );
    mockScrape.mockResolvedValue(freeGames);
    mockDeals.mockResolvedValue([]);

    const result = await runNotifications();

    expect(mockDiscord).toHaveBeenCalledTimes(1); // un resumen con los 12
    expect(mockDiscord.mock.calls[0][0]).toHaveLength(12);
    expect(result.notified).toBe(12);
  });
});
