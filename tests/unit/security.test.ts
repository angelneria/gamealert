import { isValidDiscordWebhook } from "@/server/discord";
import { isLoopbackIp } from "@/lib/security";
import {
  registerSchema,
  preferencesSchema,
  gamesQuerySchema,
  dealsQuerySchema,
} from "@/lib/validation";

describe("isValidDiscordWebhook (SSRF protection)", () => {
  it("accepts a valid Discord webhook URL", () => {
    expect(
      isValidDiscordWebhook("https://discord.com/api/webhooks/123456789/abc-DEF_ghi")
    ).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidDiscordWebhook("")).toBe(false);
  });

  it("rejects non-Discord hosts", () => {
    expect(
      isValidDiscordWebhook("https://evil.com/api/webhooks/123/abc")
    ).toBe(false);
    expect(
      isValidDiscordWebhook("https://discord.com.evil.com/api/webhooks/123/abc")
    ).toBe(false);
    expect(
      isValidDiscordWebhook("https://notdiscord.com/api/webhooks/123/abc")
    ).toBe(false);
  });

  it("rejects http (non-TLS)", () => {
    expect(
      isValidDiscordWebhook("http://discord.com/api/webhooks/123/abc")
    ).toBe(false);
  });

  it("rejects non-webhook paths", () => {
    expect(isValidDiscordWebhook("https://discord.com/api/other/123/abc")).toBe(false);
    expect(isValidDiscordWebhook("https://discord.com/channels/1/2")).toBe(false);
  });

  it("rejects internal/localhost URLs (SSRF)", () => {
    expect(isValidDiscordWebhook("https://localhost/api/webhooks/1/abc")).toBe(false);
    expect(isValidDiscordWebhook("https://127.0.0.1/api/webhooks/1/abc")).toBe(false);
    expect(isValidDiscordWebhook("https://169.254.169.254/api/webhooks/1/abc")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isValidDiscordWebhook("not a url")).toBe(false);
    expect(isValidDiscordWebhook("javascript:alert(1)")).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    const result = registerSchema.safeParse({
      email: "User@Example.com ",
      password: "Segura123",
      platforms: ["steam", "gog"],
      discordWebhookUrl: "https://discord.com/api/webhooks/1/abc",
    });
    expect(result.success).toBe(true);
    // email normalized to lowercase + trimmed
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });

  it("accepts missing webhook", () => {
    const result = registerSchema.safeParse({
      email: "a@b.co",
      password: "Segura123",
      platforms: ["steam"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(
      registerSchema.safeParse({ email: "nope", password: "Segura123", platforms: ["steam"] }).success
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email: "a@b", password: "Segura123", platforms: ["steam"] }).success
    ).toBe(false);
  });

  it("rejects missing password", () => {
    expect(
      registerSchema.safeParse({ email: "a@b.co", platforms: ["steam"] }).success
    ).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    expect(
      registerSchema.safeParse({
        email: "a@b.co",
        password: "corto",
        platforms: ["steam"],
      }).success
    ).toBe(false);
    // exactamente 8 → válido
    expect(
      registerSchema.safeParse({
        email: "a@b.co",
        password: "12345678",
        platforms: ["steam"],
      }).success
    ).toBe(true);
  });

  it("rejects empty platforms", () => {
    expect(
      registerSchema.safeParse({ email: "a@b.co", password: "Segura123", platforms: [] }).success
    ).toBe(false);
  });

  it("rejects console platforms (PC only)", () => {
    expect(
      registerSchema.safeParse({
        email: "a@b.co",
        password: "Segura123",
        platforms: ["xbox"],
      }).success
    ).toBe(false);
  });

  it("rejects non-Discord webhook URLs", () => {
    expect(
      registerSchema.safeParse({
        email: "a@b.co",
        password: "Segura123",
        platforms: ["steam"],
        discordWebhookUrl: "https://evil.com/hook",
      }).success
    ).toBe(false);
  });

  it("rejects oversized email", () => {
    expect(
      registerSchema.safeParse({
        email: `${"a".repeat(300)}@b.co`,
        password: "Segura123",
        platforms: ["steam"],
      }).success
    ).toBe(false);
  });
});

describe("preferencesSchema", () => {
  it("accepts all valid fields", () => {
    const result = preferencesSchema.safeParse({
      email: "a@b.co",
      platforms: ["steam", "epic"],
      minMetacritic: 70,
      cooldownHours: 12,
      emailEnabled: true,
      discordEnabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects minMetacritic out of range", () => {
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", minMetacritic: 101 }).success
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", minMetacritic: -1 }).success
    ).toBe(false);
  });

  it("rejects cooldownHours out of range", () => {
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", cooldownHours: 0 }).success
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", cooldownHours: 9999 }).success
    ).toBe(false);
  });

  it("accepts valid chollos fields (dealsEnabled, maxDealPrice, minDiscountPct)", () => {
    const result = preferencesSchema.safeParse({
      email: "a@b.co",
      dealsEnabled: true,
      maxDealPrice: 15,
      minDiscountPct: 80,
    });
    expect(result.success).toBe(true);
  });

  it("rejects maxDealPrice out of range (0 y > cap)", () => {
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", maxDealPrice: 0 }).success
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", maxDealPrice: 31 }).success
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", maxDealPrice: 2.5 }).success
    ).toBe(false);
  });

  it("rejects minDiscountPct out of range y dealsEnabled no boolean", () => {
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", minDiscountPct: -1 }).success
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", minDiscountPct: 100 }).success
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({ email: "a@b.co", dealsEnabled: "yes" }).success
    ).toBe(false);
  });
});

describe("gamesQuerySchema", () => {
  it("accepts valid query params", () => {
    const result = gamesQuerySchema.safeParse({
      platform: "steam",
      minMetacritic: 60,
    });
    expect(result.success).toBe(true);
  });

  it("coerces string numbers from query strings", () => {
    const result = gamesQuerySchema.safeParse({ minMetacritic: "70" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.minMetacritic).toBe(70);
  });

  it("rejects unknown platform", () => {
    expect(gamesQuerySchema.safeParse({ platform: "xbox" }).success).toBe(false);
  });

  it("rejects minMetacritic out of range", () => {
    expect(gamesQuerySchema.safeParse({ minMetacritic: "200" }).success).toBe(false);
  });
});

describe("dealsQuerySchema", () => {
  it("accepts valid query params", () => {
    const result = dealsQuerySchema.safeParse({
      platform: "steam",
      minMetacritic: 60,
      maxPrice: 10,
      minDiscount: 75,
    });
    expect(result.success).toBe(true);
  });

  it("coerces string numbers from query strings (decimals allowed in maxPrice)", () => {
    const result = dealsQuerySchema.safeParse({
      maxPrice: "2.5",
      minDiscount: "90",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxPrice).toBe(2.5);
      expect(result.data.minDiscount).toBe(90);
    }
  });

  it("rejects maxPrice below 1 or above the cap", () => {
    expect(dealsQuerySchema.safeParse({ maxPrice: "0.5" }).success).toBe(false);
    expect(dealsQuerySchema.safeParse({ maxPrice: "31" }).success).toBe(false);
    expect(dealsQuerySchema.safeParse({ maxPrice: "free" }).success).toBe(false);
  });

  it("rejects minDiscount out of range", () => {
    expect(dealsQuerySchema.safeParse({ minDiscount: "-1" }).success).toBe(false);
    expect(dealsQuerySchema.safeParse({ minDiscount: "100" }).success).toBe(false);
  });

  it("rejects unknown platform", () => {
    expect(dealsQuerySchema.safeParse({ platform: "xbox" }).success).toBe(false);
  });

  it("empty object is valid (defaults applied by the route)", () => {
    expect(dealsQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe("isLoopbackIp (rate-limit exemption)", () => {
  it("accepts classic loopback forms", () => {
    expect(isLoopbackIp("127.0.0.1")).toBe(true);
    expect(isLoopbackIp("::1")).toBe(true);
    expect(isLoopbackIp("localhost")).toBe(true);
    expect(isLoopbackIp("unknown")).toBe(true);
    expect(isLoopbackIp("")).toBe(false);
  });

  it("accepts IPv4-mapped IPv6 loopback (Next dev quirk: ::ffff:127.0.0.1)", () => {
    expect(isLoopbackIp("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackIp("::ffff:127.1.2.3")).toBe(true);
    expect(isLoopbackIp("::FFFF:127.0.0.1")).toBe(true); // case-insensitive
  });

  it("accepts the whole 127.0.0.0/8 range", () => {
    expect(isLoopbackIp("127.0.0.53")).toBe(true);
    expect(isLoopbackIp("127.255.255.254")).toBe(true);
  });

  it("rejects non-loopback addresses (must keep counting against the budget)", () => {
    expect(isLoopbackIp("8.8.8.8")).toBe(false);
    expect(isLoopbackIp("192.168.1.10")).toBe(false);
    expect(isLoopbackIp("10.0.0.1")).toBe(false);
    expect(isLoopbackIp("172.16.0.1")).toBe(false);
    expect(isLoopbackIp("::ffff:8.8.8.8")).toBe(false);
    expect(isLoopbackIp("2001:db8::1")).toBe(false);
  });
});
