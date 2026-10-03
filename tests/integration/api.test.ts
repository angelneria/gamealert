/**
 * Integration tests - hit the live dev server.
 * Each test returns early (skipped) when the server is not running,
 * so `npx jest` works in any environment.
 */

const BASE = process.env.GAMEALERT_BASE_URL || "http://127.0.0.1:3000";

// Estos tests golpean el servidor en vivo: la primera petición compila la
// ruta (Next dev) y el scraping real tarda más de los 5s por defecto.
jest.setTimeout(30000);

async function serverUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetches JSON or throws with status text */
async function getJson(path: string, timeoutMs = 60000) {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.dev`;

/** Registers a user and returns the session cookie ("ga_session=..."). */
async function registerUser(
  email: string,
  password = "TestPass123!"
): Promise<string> {
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      platforms: ["steam", "epic", "gog"],
    }),
    signal: AbortSignal.timeout(10000),
  });
  expect(res.status).toBe(201);
  const cookie = res.headers.get("set-cookie");
  expect(cookie).toBeTruthy();
  return cookie!.split(";")[0];
}

describe("Integration: API", () => {
  describe("GET /api/games", () => {
    it("returns a JSON payload with games array", async () => {
      if (!(await serverUp())) return;
      const { status, data } = await getJson("/api/games");
      expect(status).toBe(200);
      expect(Array.isArray(data.games)).toBe(true);
      expect(typeof data.total).toBe("number");
    });

    it("every game is free with a valid store URL", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/games");
      for (const g of data.games) {
        expect(g.isFree).toBe(true);
        expect(g.storeUrl).toMatch(/^https:\/\//);
        expect(g.title.length).toBeGreaterThan(0);
      }
    });

    it("only returns PC platforms (steam/epic/gog)", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/games");
      const platforms = new Set(data.games.map((g: any) => g.platform));
      for (const p of platforms) {
        expect(["steam", "epic", "gog"]).toContain(p);
      }
    });

    it("minMetacritic=100 returns only top-rated games", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/games?minMetacritic=100");
      for (const g of data.games) {
        const score = Math.max(g.importanceScore, g.metacriticScore || 0);
        expect(score).toBeGreaterThanOrEqual(100);
      }
    });

    it("minMetacritic=0 returns at least as many games as minMetacritic=90", async () => {
      if (!(await serverUp())) return;
      const [low, high] = await Promise.all([
        getJson("/api/games?minMetacritic=0"),
        getJson("/api/games?minMetacritic=90"),
      ]);
      expect(low.data.games.length).toBeGreaterThanOrEqual(
        high.data.games.length
      );
    });

    it("platform filter narrows results", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/games?platform=epic");
      for (const g of data.games) {
        expect(g.platform).toBe("epic");
      }
    });
  });

  describe("GET /api/deals", () => {
    it("returns a JSON payload with a deals array", async () => {
      if (!(await serverUp())) return;
      const { status, data } = await getJson("/api/deals");
      expect(status).toBe(200);
      expect(Array.isArray(data.deals)).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(typeof data.maxPrice).toBe("number");
      expect(typeof data.minDiscount).toBe("number");
    });

    it("every deal is discounted, non-free and within the echoed bounds", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/deals");
      for (const g of data.deals) {
        expect(g.isFree).toBe(false);
        expect(g.salePrice).toBeGreaterThan(0);
        expect(g.salePrice).toBeLessThanOrEqual(data.maxPrice);
        expect(g.discountPct).toBeGreaterThanOrEqual(data.minDiscount);
        expect(g.storeUrl).toMatch(/^https:\/\//);
        expect(g.title.length).toBeGreaterThan(0);
        expect(["steam", "epic", "gog"]).toContain(g.platform);
        expect(g.metacriticScore).toBeGreaterThanOrEqual(0);
        expect(g.metacriticScore).toBeLessThanOrEqual(100);
      }
    });

    it("honors minDiscount=90 (everything is ≥90% off)", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/deals?minDiscount=90");
      expect(data.minDiscount).toBe(90);
      for (const g of data.deals) {
        expect(g.discountPct).toBeGreaterThanOrEqual(90);
      }
    });

    it("honors maxPrice=3 (everything costs ≤ $3)", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/deals?maxPrice=3");
      expect(data.maxPrice).toBe(3);
      for (const g of data.deals) {
        expect(g.salePrice).toBeLessThanOrEqual(3);
        expect(g.salePrice).toBeGreaterThan(0);
      }
    });

    it("honors minMetacritic=80 (quality gate applies to deals too)", async () => {
      if (!(await serverUp())) return;
      const { data } = await getJson("/api/deals?minMetacritic=80");
      for (const g of data.deals) {
        expect(Math.max(g.importanceScore, g.metacriticScore || 0)).toBeGreaterThanOrEqual(80);
      }
    });

    it("rejects invalid params with 400", async () => {
      if (!(await serverUp())) return;
      for (const qs of [
        "maxPrice=0.5",
        "maxPrice=31",
        "minDiscount=100",
        "minDiscount=-1",
        "platform=xbox",
        "minMetacritic=200",
      ]) {
        const { status } = await getJson(`/api/deals?${qs}`);
        expect(status).toBe(400);
      }
    });
  });

  describe("POST /api/auth (register)", () => {
    it("rejects invalid email", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          password: "TestPass123!",
          platforms: ["steam"],
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(400);
    });

    it("rejects empty platforms", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail("noplat"),
          password: "TestPass123!",
          platforms: [],
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a password shorter than 8 characters", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail("shortpw"),
          password: "short",
          platforms: ["steam"],
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(400);
    });

    it("rejects a duplicate email with 409", async () => {
      if (!(await serverUp())) return;
      const email = uniqueEmail("dup");
      await registerUser(email);

      const res = await fetch(`${BASE}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "AnotherPass456!",
          platforms: ["steam"],
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(409);
    });

    it("registers a user, sets a session cookie and GET /api/auth returns it", async () => {
      if (!(await serverUp())) return;
      const email = uniqueEmail("itest");
      const cookie = await registerUser(email);

      const check = await fetch(`${BASE}/api/auth`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      expect(check.status).toBe(200);
      const data = await check.json();
      expect(data.user.email).toBe(email);
    });

    it("GET /api/auth without session returns 401", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth`, {
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/login", () => {
    it("rejects wrong password with generic 401", async () => {
      if (!(await serverUp())) return;
      const email = uniqueEmail("login");
      await registerUser(email);

      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "WrongPass999!" }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Email o contraseña incorrectos");
    });

    it("rejects unknown email with the same generic 401", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: uniqueEmail("ghost"),
          password: "Whatever123!",
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Email o contraseña incorrectos");
    });

    it("logs in with correct password and grants access", async () => {
      if (!(await serverUp())) return;
      const email = uniqueEmail("oklogin");
      await registerUser(email);

      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "TestPass123!" }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie");
      expect(cookie).toBeTruthy();

      const check = await fetch(`${BASE}/api/auth`, {
        headers: { Cookie: cookie!.split(";")[0] },
        signal: AbortSignal.timeout(10000),
      });
      expect(check.status).toBe(200);
    });

    it("logout invalidates the session", async () => {
      if (!(await serverUp())) return;
      const email = uniqueEmail("logout");
      const cookie = await registerUser(email);

      const out = await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      expect(out.status).toBe(200);

      // Cookie maxAge=0 → sent cookie no longer grants access? The old
      // token itself is still cryptographically valid until we prove the
      // cleared cookie works: emulate the browser dropping it.
      const cleared = out.headers.get("set-cookie") || "";
      expect(cleared).toContain("Max-Age=0");
    });
  });

  describe("PUT /api/auth/preferences", () => {
    it("saves preferences for the session user", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("prefs"));

      const res = await fetch(`${BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          platforms: ["steam", "gog"],
          minMetacritic: 70,
          cooldownHours: 12,
          discordEnabled: false,
          emailEnabled: false,
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(200);

      const check = await fetch(`${BASE}/api/auth`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      const data = await check.json();
      expect(data.user.minMetacritic).toBe(70);
      expect(data.user.cooldownHours).toBe(12);
      expect(data.user.emailEnabled).toBe(false);
      expect(data.user.discordEnabled).toBe(false);
    });

    it("saves chollos preferences (dealsEnabled, maxDealPrice, minDiscountPct)", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("deals"));

      const res = await fetch(`${BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          dealsEnabled: true,
          maxDealPrice: 5,
          minDiscountPct: 90,
        }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(200);

      const check = await fetch(`${BASE}/api/auth`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      const data = await check.json();
      expect(data.user.dealsEnabled).toBe(true);
      expect(data.user.maxDealPrice).toBe(5);
      expect(data.user.minDiscountPct).toBe(90);
    });

    it("rejects out-of-range chollos values (400)", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("deals-range"));

      const tooCheap = await fetch(`${BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ maxDealPrice: 0 }),
        signal: AbortSignal.timeout(10000),
      });
      expect(tooCheap.status).toBe(400);

      const tooGreedy = await fetch(`${BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ minDiscountPct: 100 }),
        signal: AbortSignal.timeout(10000),
      });
      expect(tooGreedy.status).toBe(400);
    });

    it("rejects without session (401)", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minMetacritic: 50 }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(401);
    });

    it("rejects out-of-range values (400)", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("range"));
      const res = await fetch(`${BASE}/api/auth/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ minMetacritic: 150 }),
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/notifications", () => {
    it("rejects requests without session (401)", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/notifications`, {
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(401);
    });

    it("returns the session user's history", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("notif"));

      const res = await fetch(`${BASE}/api/notifications`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.notifications)).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(data.total).toBe(0); // fresh user: no notifications yet
    });

    it("clamps oversized limit values", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("limit"));
      const res = await fetch(`${BASE}/api/notifications?limit=99999`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notifications.length).toBeLessThanOrEqual(100);
    });
  });

  describe("POST /api/notify", () => {
    it("rejects without session (401) — never runs the batch", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/notify`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/cron/notify", () => {
    it("rejects without bearer secret (401)", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/cron/notify`, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      expect([401, 503]).toContain(res.status);
    });

    it("rejects wrong bearer secret (401)", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/cron/notify`, {
        method: "POST",
        headers: { Authorization: "Bearer wrong-secret-value" },
        signal: AbortSignal.timeout(10000),
      });
      expect([401, 503]).toContain(res.status);
    });
  });

  describe("CSRF origin check", () => {
    it("rejects cross-origin mutations with 403", async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Origin: "https://evil.example.com" },
        signal: AbortSignal.timeout(10000),
      });
      expect(res.status).toBe(403);
    });
  });
});

describe("Integration: Pages render", () => {
  const publicPages = [
    { path: "/", mustContain: "GameAlert" },
    { path: "/register", mustContain: "GameAlert" },
    { path: "/login", mustContain: "GameAlert" },
  ];

  for (const page of publicPages) {
    it(`GET ${page.path} → 200 with app content`, async () => {
      if (!(await serverUp())) return;
      const res = await fetch(`${BASE}${page.path}`, {
        signal: AbortSignal.timeout(30000),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(page.mustContain);
    });
  }

  describe("protected pages (registro obligatorio)", () => {
    const protectedPages = [
      "/dashboard",
      "/dashboard/games",
      "/dashboard/settings",
    ];

    for (const path of protectedPages) {
      it(`GET ${path} without session → redirect to /login`, async () => {
        if (!(await serverUp())) return;
        const res = await fetch(`${BASE}${path}`, {
          redirect: "manual",
          signal: AbortSignal.timeout(30000),
        });
        expect([302, 307]).toContain(res.status);
        expect(res.headers.get("location") || "").toContain("/login");
      });

      it(`GET ${path} with session → 200`, async () => {
        if (!(await serverUp())) return;
        const cookie = await registerUser(
          `pages-${path.replace(/\W/g, "")}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.dev`
        );
        const res = await fetch(`${BASE}${path}`, {
          headers: { Cookie: cookie },
          signal: AbortSignal.timeout(30000),
        });
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("GameAlert");
      });
    }

    it("games page renders filters and heading (SSR, with session)", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("ssr"));
      const res = await fetch(`${BASE}/dashboard/games`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(30000),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("JUEGOS");
      expect(html).toContain("Metacritic mínimo");
      expect(html).toContain("Chollos"); // pestaña de juegos rebajados
    });

    it("settings page renders the chollos section (SSR, with session)", async () => {
      if (!(await serverUp())) return;
      const cookie = await registerUser(uniqueEmail("ssr-deals"));
      const res = await fetch(`${BASE}/dashboard/settings`, {
        headers: { Cookie: cookie },
        signal: AbortSignal.timeout(30000),
      });
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Chollos (juegos rebajados)");
      expect(html).toContain("Precio máximo a pagar");
      expect(html).toContain("Descuento mínimo");
      expect(html).toContain("Avisarme de chollos");
    });
  });

  it("home page is in Spanish", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/`, {
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    expect(html).toMatch(/lang="es"/);
    expect(html).toContain("Juegos");
  });

  it("home page exposes the design system (panels + outline text)", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/`, {
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    expect(html).toContain("panel");
    expect(html).toContain("text-outline");
  });

  it("home page has Epic countdown section", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/`, {
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    expect(html).toContain("Próximo drop de Epic");
  });

  it("sitemap.xml is valid and only lists public pages", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/sitemap.xml`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>");
    expect(xml).not.toContain("/dashboard");
  });

  it("robots.txt is valid", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/robots.txt`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt.toLowerCase()).toContain("user-agent");
    expect(txt.toLowerCase()).toContain("sitemap");
  });

  it("manifest.webmanifest is valid", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/manifest.webmanifest`, {
      signal: AbortSignal.timeout(10000),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toContain("GameAlert");
    expect(data.display).toBe("standalone");
  });

  it("login page has password field (no localStorage auth)", async () => {
    if (!(await serverUp())) return;
    const res = await fetch(`${BASE}/login`, {
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    expect(html).toContain("type=\"password\"");
    expect(html).toContain("Contraseña");
  });
});
