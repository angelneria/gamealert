import {
  calculateImportance,
  getPlatformDisplayName,
  type ScrapedGame,
} from "@/lib/api-client";
import { config } from "@/config";

function makeGame(overrides: Partial<ScrapedGame> = {}): ScrapedGame {
  return {
    title: "Test Game",
    platform: "steam",
    storeUrl: "https://example.com",
    imageUrl: "https://example.com/img.jpg",
    description: "test",
    publisher: "Test",
    genre: "Test",
    importanceScore: 50,
    isFree: true,
    ...overrides,
  };
}

describe("calculateImportance", () => {
  it("returns importanceScore when no metacritic", () => {
    expect(calculateImportance(makeGame({ importanceScore: 55 }))).toBe(55);
  });
  it("prefers the higher of importance vs metacritic", () => {
    expect(
      calculateImportance(makeGame({ importanceScore: 40, metacriticScore: 90 }))
    ).toBe(90);
    expect(
      calculateImportance(makeGame({ importanceScore: 70, metacriticScore: 30 }))
    ).toBe(70);
  });
  it("caps score at 100", () => {
    expect(
      calculateImportance(makeGame({ importanceScore: 150 }))
    ).toBe(100);
    expect(
      calculateImportance(makeGame({ importanceScore: 50, metacriticScore: 120 }))
    ).toBe(100);
  });
  it("ignores zero metacritic (unrated)", () => {
    expect(
      calculateImportance(makeGame({ importanceScore: 60, metacriticScore: 0 }))
    ).toBe(60);
  });
});

describe("platform display helpers", () => {
  it("maps known platform ids to display names", () => {
    expect(getPlatformDisplayName("steam")).toBe("Steam");
    expect(getPlatformDisplayName("epic")).toBe("Epic Games Store");
    expect(getPlatformDisplayName("gog")).toBe("GOG");
  });
  it("falls back to raw id for unknown platforms", () => {
    expect(getPlatformDisplayName("humble")).toBe("humble");
  });
});

describe("app config", () => {
  it("only monitors PC platforms (no consoles)", () => {
    const ids = config.allPlatformIds;
    expect(ids).toContain("steam");
    expect(ids).toContain("epic");
    expect(ids).toContain("gog");
    expect(ids).not.toContain("xbox");
    expect(ids).not.toContain("playstation");
    expect(ids).not.toContain("nintendo");
  });
  it("default quality filter is 60", () => {
    expect(config.filtering.minMetacritic).toBe(60);
  });
  it("every platform exposes name and free-games URL", () => {
    for (const [id, p] of Object.entries(config.platforms)) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.freeGamesUrl).toMatch(/^https:\/\//);
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
