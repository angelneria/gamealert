import {
  // Steam
  isSteam100PercentDiscount,
  isSteamDemo,
  isSteamF2P,
  isSteamTemporarilyFreeGame,
  parseSteamRowId,
  parseSteamRowTitle,
  parseSteamDiscount,
  resolveSteamImage,
  // Epic
  isEpicTemporarilyFree,
  buildEpicStoreUrl,
  pickEpicImage,
  // GOG
  isGogExcludedProduct,
  isGogFreeGame,
  gogQualityScore,
  // Shared
  normalizeTitle,
  dedupeGames,
  passesQualityThreshold,
  // Chollos (CheapShark deals)
  cheapsharkStoreToPlatform,
  parseCheapsharkDeal,
  passesDealPrice,
  passesDealDiscount,
} from "@/lib/filters";

describe("Steam filters", () => {
  describe("isSteam100PercentDiscount", () => {
    it("accepts -100 (temporarily free)", () => {
      expect(isSteam100PercentDiscount(-100)).toBe(true);
    });
    it("rejects partial discounts", () => {
      expect(isSteam100PercentDiscount(-99)).toBe(false);
      expect(isSteam100PercentDiscount(-70)).toBe(false);
      expect(isSteam100PercentDiscount(-50)).toBe(false);
    });
    it("rejects non-free prices", () => {
      expect(isSteam100PercentDiscount(0)).toBe(false);
      expect(isSteam100PercentDiscount(10)).toBe(false);
    });
  });

  describe("isSteamDemo", () => {
    it("detects 'demo' in title (case-insensitive)", () => {
      expect(isSteamDemo("Game Demo", "")).toBe(true);
      expect(isSteamDemo("DEMO EDITION", "")).toBe(true);
      expect(isSteamDemo("My Demo Game", "")).toBe(true);
    });
    it("detects demo markers in HTML row", () => {
      expect(isSteamDemo("Some Game", 'Demo</div>')).toBe(true);
      expect(isSteamDemo("Some Game", 'class="demo"')).toBe(true);
    });
    it("accepts normal titles", () => {
      expect(isSteamDemo("Elden Ring", "<div></div>")).toBe(false);
      expect(isSteamDemo("Hades", "")).toBe(false);
    });
  });

  describe("isSteamF2P", () => {
    it("detects Free to Play tag", () => {
      expect(isSteamF2P('Free to Play')).toBe(true);
      expect(isSteamF2P("free_to_play")).toBe(true);
      expect(isSteamF2P('x"Free to Play"y')).toBe(true);
    });
    it("accepts paid games", () => {
      expect(isSteamF2P('<div class="tab_row">')).toBe(false);
      expect(isSteamF2P("")).toBe(false);
    });
  });

  describe("isSteamTemporarilyFreeGame (full gate)", () => {
    it("accepts a real 100%-off paid game", () => {
      expect(
        isSteamTemporarilyFreeGame("System Shock 2", "<span>", -100)
      ).toBe(true);
    });
    it("rejects 70% off even if otherwise clean", () => {
      expect(
        isSteamTemporarilyFreeGame("Baldur's Gate 3", "<span>", -70)
      ).toBe(false);
    });
    it("rejects demos even at -100", () => {
      expect(
        isSteamTemporarilyFreeGame("Cool Game Demo", "<span>", -100)
      ).toBe(false);
    });
    it("rejects F2P games even at -100", () => {
      expect(
        isSteamTemporarilyFreeGame("CS2", "Free to Play", -100)
      ).toBe(false);
    });
    it("rejects demo HTML marker at -100", () => {
      expect(
        isSteamTemporarilyFreeGame("Cool Game", 'Demo</div>', -100)
      ).toBe(false);
    });
  });

  describe("parseSteamRowId", () => {
    it("extracts numeric app id at row start", () => {
      expect(parseSteamRowId('"730"name')).toBe("730");
      expect(parseSteamRowId('"1245620"something')).toBe("1245620");
    });
    it("returns null when row does not start with quoted id", () => {
      expect(parseSteamRowId("no id here")).toBeNull();
      expect(parseSteamRowId('"abc"')).toBeNull();
    });
  });

  describe("parseSteamRowTitle", () => {
    it("extracts title from span.title", () => {
      expect(
        parseSteamRowTitle('<span class="title">Hades</span>')
      ).toBe("Hades");
    });
    it("trims whitespace", () => {
      expect(
        parseSteamRowTitle('<span class="title">  Hades  </span>')
      ).toBe("Hades");
    });
    it("returns null without a title span", () => {
      expect(parseSteamRowTitle("<div>nothing</div>")).toBeNull();
    });
  });

  describe("parseSteamDiscount", () => {
    it("parses negative percentages", () => {
      expect(parseSteamDiscount('discount_pct">-100%<')).toBe(-100);
      expect(parseSteamDiscount('discount_pct">-70%<')).toBe(-70);
    });
    it("defaults to 0 without a discount badge", () => {
      expect(parseSteamDiscount("no discount here")).toBe(0);
    });
  });

  describe("resolveSteamImage", () => {
    it("uses the shared.akamai image when present", () => {
      const row =
        'src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/123/header.jpg"';
      expect(resolveSteamImage(row, "123")).toContain(
        "shared.akamai.steamstatic.com"
      );
    });
    it("falls back to cdn header image", () => {
      expect(resolveSteamImage("", "456")).toBe(
        "https://cdn.akamai.steamstatic.com/steam/apps/456/header.jpg"
      );
    });
    it("upgrades capsule_231x87 to header.jpg", () => {
      const row =
        'src="https://shared.akamai.steamstatic.com/steam/apps/789/capsule_231x87.jpg"';
      expect(resolveSteamImage(row, "789")).toContain("header.jpg");
      expect(resolveSteamImage(row, "789")).not.toContain(
        "capsule_231x87"
      );
    });
  });
});

describe("Epic filters", () => {
  describe("isEpicTemporarilyFree", () => {
    it("accepts paid game now free", () => {
      expect(
        isEpicTemporarilyFree({ discountPrice: 0, originalPrice: 5999 })
      ).toBe(true);
    });
    it("rejects always-free (originalPrice 0)", () => {
      expect(
        isEpicTemporarilyFree({ discountPrice: 0, originalPrice: 0 })
      ).toBe(false);
    });
    it("rejects games with a current price", () => {
      expect(
        isEpicTemporarilyFree({ discountPrice: 999, originalPrice: 5999 })
      ).toBe(false);
    });
    it("rejects missing price payload", () => {
      expect(isEpicTemporarilyFree(null)).toBe(false);
      expect(isEpicTemporarilyFree(undefined)).toBe(false);
    });
  });

  describe("buildEpicStoreUrl", () => {
    it("builds deep link from catalogNs pageSlug", () => {
      expect(
        buildEpicStoreUrl({
          catalogNs: { mappings: [{ pageSlug: "system-shock-2" }] },
        })
      ).toBe("https://store.epicgames.com/p/system-shock-2");
    });
    it("falls back to offerMappings slug", () => {
      expect(
        buildEpicStoreUrl({
          offerMappings: [{ pageSlug: "buried-stars" }],
        })
      ).toBe("https://store.epicgames.com/p/buried-stars");
    });
    it("falls back to productSlug", () => {
      expect(
        buildEpicStoreUrl({ productSlug: "some-game" })
      ).toBe("https://store.epicgames.com/p/some-game");
    });
    it("falls back to urlSlug", () => {
      expect(
        buildEpicStoreUrl({ urlSlug: "another-game" })
      ).toBe("https://store.epicgames.com/p/another-game");
    });
    it("returns the free-games hub when no slug", () => {
      expect(buildEpicStoreUrl({})).toBe(
        "https://store.epicgames.com/free-games"
      );
    });
  });

  describe("pickEpicImage", () => {
    it("prefers OfferImageWide", () => {
      const images = [
        { type: "OfferImageTall", url: "https://x/tall.jpg" },
        { type: "OfferImageWide", url: "https://x/wide.jpg" },
      ];
      expect(pickEpicImage(images)).toBe("https://x/wide.jpg");
    });
    it("falls back to OfferImageTall", () => {
      const images = [{ type: "OfferImageTall", url: "https://x/t.jpg" }];
      expect(pickEpicImage(images)).toBe("https://x/t.jpg");
    });
    it("returns empty when no images", () => {
      expect(pickEpicImage([])).toBe("");
    });
  });
});

describe("GOG filters", () => {
  describe("isGogExcludedProduct", () => {
    it.each([
      ["dlc slug", { slug: "game-dlc" }],
      ["demo slug", { slug: "game-demo" }],
      ["mod slug", { slug: "mod_niceguns" }],
      ["unrated slug", { slug: "unrated-game" }],
      ["season slug", { slug: "game-season-pass" }],
      ["expansion slug", { slug: "game-expansion" }],
      ["pack slug", { slug: "game-pack" }],
      ["color variation", { slug: "color_variation_red" }],
      ["digital poster", { slug: "digital_poster_1" }],
      ["unit slug", { slug: "unit_01" }],
      ["dlc in title", { slug: "ok", title: "Game DLC" }],
      ["demo in title", { slug: "ok", title: "Game Demo" }],
      [" mod  in title", { slug: "ok", title: "Game Mod Pack" }],
      ["unrated in title", { slug: "ok", title: "Unrated Cut" }],
      ["4k in title", { slug: "ok", title: "4K Resolution" }],
      ["resolution mode in title", { slug: "ok", title: "Resolution Mode" }],
      ["productType dlc", { slug: "ok", productType: "dlc" }],
      ["productType expansion", { slug: "ok", productType: "expansion" }],
    ])("excludes %s", (_name, product) => {
      expect(isGogExcludedProduct(product as any)).toBe(true);
    });

    it("accepts a real game", () => {
      expect(
        isGogExcludedProduct({
          slug: "system-shock-2",
          title: "System Shock 2",
          productType: "game",
        })
      ).toBe(false);
    });
  });

  describe("isGogFreeGame (full gate)", () => {
    const valid = {
      slug: "system-shock-2",
      title: "System Shock 2",
      coverHorizontal: "https://x/img.jpg",
      price: { finalAmount: 0 },
    };
    it("accepts free game with image", () => {
      expect(isGogFreeGame(valid as any)).toBe(true);
    });
    it("rejects excluded products", () => {
      expect(
        isGogFreeGame({ ...valid, slug: "game-dlc" } as any)
      ).toBe(false);
    });
    it("rejects when no image", () => {
      expect(
        isGogFreeGame({ ...valid, coverHorizontal: "", logo: "" } as any)
      ).toBe(false);
    });
    it("rejects when price is positive", () => {
      expect(
        isGogFreeGame({ ...valid, price: { finalAmount: 999 } } as any)
      ).toBe(false);
    });
    it("accepts when price object is missing", () => {
      const { price, ...noPrice } = valid;
      expect(isGogFreeGame(noPrice as any)).toBe(true);
    });
    it("accepts logo as fallback image", () => {
      expect(
        isGogFreeGame({
          ...valid,
          coverHorizontal: "",
          logo: "https://x/logo.png",
        } as any)
      ).toBe(true);
    });
  });

  describe("gogQualityScore", () => {
    it("uses reviewsRating when present", () => {
      expect(gogQualityScore({ reviewsRating: 84 } as any)).toBe(84);
    });
    it("defaults to 50 when unrated", () => {
      expect(gogQualityScore({} as any)).toBe(50);
      expect(gogQualityScore({ reviewsRating: 0 } as any)).toBe(50);
    });
  });
});

describe("Shared helpers", () => {
  describe("normalizeTitle", () => {
    it("lowercases and strips non-alphanumerics", () => {
      expect(normalizeTitle("System Shock 2")).toBe("systemshock2");
      expect(normalizeTitle("HADES:  The Card Game")).toBe(
        "hadesthecardgame"
      );
    });
    it("treats punctuation and case variants as identical", () => {
      expect(normalizeTitle("Resident Evil 4")).toBe(
        normalizeTitle("resident evil 4!")
      );
    });
  });

  describe("dedupeGames", () => {
    it("removes case/punctuation duplicates, keeps first", () => {
      const games = [
        { title: "Hades", platform: "steam" },
        { title: "HADES", platform: "epic" },
        { title: "hades!", platform: "gog" },
        { title: "Celeste", platform: "steam" },
      ];
      const result = dedupeGames(games);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ title: "Hades", platform: "steam" });
      expect(result[1].title).toBe("Celeste");
    });
    it("keeps empty list empty", () => {
      expect(dedupeGames([])).toEqual([]);
    });
  });

  describe("passesQualityThreshold", () => {
    it("passes when importanceScore meets threshold", () => {
      expect(
        passesQualityThreshold({ importanceScore: 80, metacriticScore: 0 }, 60)
      ).toBe(true);
    });
    it("passes when metacriticScore meets threshold", () => {
      expect(
        passesQualityThreshold({ importanceScore: 10, metacriticScore: 84 }, 60)
      ).toBe(true);
    });
    it("uses max of the two scores", () => {
      expect(
        passesQualityThreshold({ importanceScore: 30, metacriticScore: 75 }, 60)
      ).toBe(true);
    });
    it("fails below threshold", () => {
      expect(
        passesQualityThreshold({ importanceScore: 40, metacriticScore: 50 }, 60)
      ).toBe(false);
    });
    it("unrated games (0) only pass threshold 0", () => {
      expect(
        passesQualityThreshold({ importanceScore: 0, metacriticScore: 0 }, 0)
      ).toBe(true);
      expect(
        passesQualityThreshold({ importanceScore: 0, metacriticScore: 0 }, 10)
      ).toBe(false);
    });
  });
});

describe("Chollos (CheapShark deals)", () => {
  const baseDeal = {
    title: "Juego Rebajado",
    storeID: "1",
    salePrice: "4.99",
    normalPrice: "19.99",
    savings: "75.03751875",
    metacriticScore: "82",
    steamAppID: "1234",
    thumb: "https://img.example.com/t.jpg",
    dealID: "abc%2Bdef",
  };

  describe("cheapsharkStoreToPlatform", () => {
    it("maps the three stores we monitor", () => {
      expect(cheapsharkStoreToPlatform("1")).toBe("steam");
      expect(cheapsharkStoreToPlatform("7")).toBe("gog");
      expect(cheapsharkStoreToPlatform("25")).toBe("epic");
    });
    it("accepts numeric ids too", () => {
      expect(cheapsharkStoreToPlatform(1)).toBe("steam");
    });
    it("returns null for stores we don't monitor", () => {
      expect(cheapsharkStoreToPlatform("11")).toBeNull();
      expect(cheapsharkStoreToPlatform("999")).toBeNull();
      expect(cheapsharkStoreToPlatform("")).toBeNull();
    });
  });

  describe("parseCheapsharkDeal", () => {
    it("converts a valid deal into a discounted game", () => {
      const game = parseCheapsharkDeal(baseDeal);
      expect(game).not.toBeNull();
      expect(game!.title).toBe("Juego Rebajado");
      expect(game!.platform).toBe("steam");
      expect(game!.isFree).toBe(false);
      expect(game!.salePrice).toBe(4.99);
      expect(game!.originalPrice).toBe(19.99);
      expect(game!.discountPct).toBe(75);
      expect(game!.metacriticScore).toBe(82);
      expect(game!.storeUrl).toBe("https://store.steampowered.com/app/1234/");
    });

    it("uses the CheapShark redirect when there is no Steam app id", () => {
      const game = parseCheapsharkDeal({
        ...baseDeal,
        steamAppID: null,
        storeID: "7",
      });
      expect(game).not.toBeNull();
      expect(game!.platform).toBe("gog");
      expect(game!.storeUrl).toBe(
        "https://www.cheapshark.com/redirect?dealID=abc%2Bdef"
      );
      expect(game!.imageUrl).toBe("https://img.example.com/t.jpg");
    });

    it("rejects free games (salePrice 0) — they belong to the free list", () => {
      expect(parseCheapsharkDeal({ ...baseDeal, salePrice: "0.00" })).toBeNull();
    });

    it("rejects stores we don't monitor", () => {
      expect(parseCheapsharkDeal({ ...baseDeal, storeID: "11" })).toBeNull();
    });

    it("rejects rows without a title", () => {
      expect(parseCheapsharkDeal({ ...baseDeal, title: "  " })).toBeNull();
    });

    it("rejects rows without a usable price", () => {
      expect(parseCheapsharkDeal({ ...baseDeal, normalPrice: "0" })).toBeNull();
      expect(parseCheapsharkDeal({ ...baseDeal, salePrice: "abc" })).toBeNull();
    });

    it("rejects rows with no link at all (no steam id, no dealID)", () => {
      expect(
        parseCheapsharkDeal({ ...baseDeal, steamAppID: null, dealID: undefined })
      ).toBeNull();
    });
  });

  describe("passesDealPrice", () => {
    const deal = (salePrice: number) => ({ isFree: false, salePrice });
    it("accepts a price within the cap", () => {
      expect(passesDealPrice(deal(4.99), 5)).toBe(true);
    });
    it("accepts exactly the cap", () => {
      expect(passesDealPrice(deal(5), 5)).toBe(true);
    });
    it("rejects a price above the cap", () => {
      expect(passesDealPrice(deal(5.01), 5)).toBe(false);
    });
    it("rejects a deal without price (fail-closed)", () => {
      expect(
        passesDealPrice({ isFree: false, salePrice: undefined }, 30)
      ).toBe(false);
      expect(passesDealPrice({ isFree: false, salePrice: 0 }, 30)).toBe(false);
    });
    it("free games bypass the budget gate", () => {
      expect(passesDealPrice({ isFree: true, salePrice: undefined }, 1)).toBe(
        true
      );
    });
  });

  describe("passesDealDiscount", () => {
    const deal = (discountPct: number) => ({ isFree: false, discountPct });
    it("accepts a discount within the minimum", () => {
      expect(passesDealDiscount(deal(90), 75)).toBe(true);
    });
    it("accepts exactly the minimum", () => {
      expect(passesDealDiscount(deal(75), 75)).toBe(true);
    });
    it("rejects a discount below the minimum", () => {
      expect(passesDealDiscount(deal(74), 75)).toBe(false);
    });
    it("rejects a deal without discount data (fail-closed)", () => {
      expect(
        passesDealDiscount({ isFree: false, discountPct: undefined }, 0)
      ).toBe(false);
    });
    it("free games bypass the discount gate", () => {
      expect(passesDealDiscount({ isFree: true, discountPct: undefined }, 99)).toBe(
        true
      );
    });
  });
});
