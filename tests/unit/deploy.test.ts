/**
 * Deployment config tests — guards for the 0€ deploy.
 *
 * Vercel Hobby (free) only allows cron jobs ONCE PER DAY: an hourly
 * expression like "0 * * * *" makes the deployment FAIL with
 * "Hobby accounts are limited to daily cron jobs". These tests keep
 * vercel.json compliant and the required secrets documented.
 */
import * as fs from "fs";
import * as path from "path";

const root = process.cwd();

function readJson(rel: string): any {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

describe("vercel.json (cron compliance)", () => {
  const config = readJson("vercel.json");

  it("defines exactly one cron job", () => {
    expect(Array.isArray(config.crons)).toBe(true);
    expect(config.crons).toHaveLength(1);
  });

  it("cron points at the protected notify endpoint", () => {
    expect(config.crons[0].path).toBe("/api/cron/notify");
  });

  it("uses a 5-field POSIX schedule in UTC", () => {
    const fields = config.crons[0].schedule.split(" ");
    expect(fields).toHaveLength(5);
  });

  it("is DAILY — Vercel Hobby rejects schedules more frequent than once/day", () => {
    const [minute, hour, dom, month, dow] = config.crons[0].schedule.split(" ");
    // Hourly ("0 * * * *") or sub-hourly ("*/30 * * * *") → deployment fails
    expect(hour).not.toBe("*");
    expect(minute).not.toBe("*");
    expect(minute).not.toContain("/");
    expect(hour).not.toContain("/");
    // "0 18 * * *" — daily at 18:00 UTC, right after Epic's Thursday 17:00 UTC drop
    expect(hour).toBe("18");
    expect(dom).toBe("*");
    expect(month).toBe("*");
    expect(dow).toBe("*");
  });
});

describe(".env.example (required secrets documented)", () => {
  const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");

  it("documents SESSION_SECRET (signed session cookies)", () => {
    expect(env).toMatch(/^SESSION_SECRET=/m);
  });

  it("documents CRON_SECRET (protects /api/cron/notify)", () => {
    expect(env).toMatch(/^CRON_SECRET=/m);
  });

  it("documents SMTP credentials for email notifications", () => {
    expect(env).toMatch(/^SMTP_USER=/m);
    expect(env).toMatch(/^SMTP_PASS=/m);
  });

  it("documents Turso (production database on Vercel)", () => {
    expect(env).toMatch(/^#?TURSO_AUTH_TOKEN=/m);
    expect(env).toMatch(/libsql:\/\//);
  });
});

describe("database (deploy-safe)", () => {
  it("Prisma keeps the sqlite provider (Turso speaks SQLite)", () => {
    const schema = fs.readFileSync(
      path.join(root, "prisma/schema.prisma"),
      "utf8"
    );
    expect(schema).toMatch(/provider\s*=\s*"sqlite"/);
  });

  it("libsql adapter is installed (remote SQLite on Vercel)", () => {
    const pkg = readJson("package.json");
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps["@libsql/client"]).toBeTruthy();
    expect(deps["@prisma/adapter-libsql"]).toBeTruthy();
  });

  it(".gitignore never uploads the local SQLite file (real user data)", () => {
    const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(ignore).toMatch(/^\*\.db$/m);
    expect(ignore).toMatch(/\.vercel/);
  });

  it("build script regenerates Prisma client (fresh Vercel install)", () => {
    const pkg = readJson("package.json");
    expect(pkg.scripts.build).toContain("prisma generate");
    expect(pkg.scripts.build).toContain("next build");
  });

  it(".npmrc allows legacy peers (react19/next14 conflict breaks Vercel npm ci)", () => {
    const npmrc = fs.readFileSync(path.join(root, ".npmrc"), "utf8");
    expect(npmrc).toMatch(/legacy-peer-deps\s*=\s*true/);
  });
});
