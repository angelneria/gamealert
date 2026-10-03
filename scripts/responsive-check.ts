/**
 * usage: npm run test:responsive
 *
 * Auditoría responsive real (Chromium headless): carga cada página en
 * 320 / 360 / 390 / 768 / 1024 / 1440 px y falla si algo desborda
 * horizontalmente. Las páginas del panel se prueban con una cuenta
 * temporal creada vía API (se deja en la base local de desarrollo).
 */
import { chromium, type BrowserContext } from "playwright";
import * as fs from "node:fs";

const BASE = process.env.GAMEALERT_BASE_URL || "http://127.0.0.1:3000";
const WIDTHS = [320, 360, 390, 768, 1024, 1440];
const SHOT_DIR = "/tmp/responsive";

interface PageSpec {
  path: string;
  needsAuth: boolean;
  readyText: string;
  /** Si se indica, espera este selector en vez del texto */
  readySelector?: string;
}

const PAGES: PageSpec[] = [
  // El h1 ("JUEGOS GRATIS.") sí es visible en móvil; el enlace "JUEGOS"
  // del nav se oculta bajo sm y rompería la espera por texto.
  { path: "/", needsAuth: false, readyText: "JUEGOS", readySelector: "h1" },
  { path: "/login", needsAuth: false, readyText: "Inicia" },
  { path: "/register", needsAuth: false, readyText: "Crear cuenta" },
  { path: "/dashboard/games", needsAuth: true, readyText: "ANALIZADOS" },
  { path: "/dashboard/settings", needsAuth: true, readyText: "AJUSTES" },
];

async function loginContext(
  browser: Awaited<ReturnType<typeof chromium.launch>>
): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  const email = `responsive-${Date.now()}@test.dev`;
  const res = await ctx.request.post(`${BASE}/api/auth`, {
    data: {
      email,
      password: "TestPass123!",
      platforms: ["steam", "epic", "gog"],
    },
  });
  if (res.status() !== 201) {
    throw new Error(`register failed: ${res.status()}`);
  }
  return ctx;
}

async function widestOffenders(page: any, width: number): Promise<string[]> {
  return page.evaluate((w: number) => {
    const bad: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.right > w + 1 && r.width > 0) {
        const tag = el.tagName.toLowerCase();
        const cls =
          typeof el.className === "string"
            ? `.${el.className.split(/\s+/).slice(0, 2).join(".")}`
            : "";
        const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
        bad.push(`${tag}${id}${cls} (right=${Math.round(r.right)})`);
        if (bad.length >= 5) return;
      }
    });
    return bad.slice(0, 5);
  }, width);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const failures: string[] = [];
  let checks = 0;

  for (const width of WIDTHS) {
    for (const spec of PAGES) {
      const ctx = spec.needsAuth
        ? await loginContext(browser)
        : await browser.newContext();
      await ctx.addInitScript(() => {
        window.scrollTo(0, 0);
      });
      const page = await ctx.newPage();
      await page.setViewportSize({ width, height: 900 });
      try {
        await page.goto(`${BASE}${spec.path}`, { waitUntil: "networkidle" });
        if (spec.readySelector) {
          await page.locator(spec.readySelector).first().waitFor({ timeout: 25000 });
        } else {
          await page
            .getByText(spec.readyText, { exact: false })
            .first()
            .waitFor({ timeout: 25000 });
        }
        // Deja que terminen los fetches de cliente (lista de juegos, prefs)
        await page.waitForTimeout(2500);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        checks++;
        const label = `${spec.path} @${width}px`;
        if (overflow > 1) {
          const offenders = await widestOffenders(page, width);
          failures.push(`${label}: desborda ${overflow}px → ${offenders.join(" | ")}`);
          console.log(`❌ ${label}: OVERFLOW ${overflow}px`);
        } else {
          console.log(`✅ ${label}`);
        }

        if (width === 360 && (spec.path === "/" || spec.path === "/dashboard/games")) {
          const name = spec.path === "/" ? "home-360.png" : "games-360.png";
          await page.screenshot({ path: `${SHOT_DIR}/${name}`, fullPage: true });
        }
      } catch (err) {
        failures.push(`${spec.path} @${width}px: ${(err as Error).message.slice(0, 120)}`);
        console.log(`❌ ${spec.path} @${width}px: ERROR`);
      } finally {
        await ctx.close();
      }
    }
  }

  await browser.close();
  console.log(`\nResponsive: ${checks - failures.length}/${checks} sin overflow`);
  if (failures.length > 0) {
    console.log("Fallos:\n- " + failures.join("\n- "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
