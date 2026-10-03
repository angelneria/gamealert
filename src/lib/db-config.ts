// ============================================
// Database target selector (pure, unit-tested)
// Local dev  → SQLite file (DATABASE_URL="file:...")
// Vercel     → Turso remote (DATABASE_URL="libsql://...", needs token)
// The Prisma schema keeps `provider = "sqlite"` in both cases:
// Turso speaks the SQLite dialect over HTTP.
// ============================================

export type DatabaseKind = "local" | "turso";

export interface DatabaseConfig {
  kind: DatabaseKind;
  /** libsql/turso URL, or file path for local SQLite */
  url: string;
  /** Turso auth token (only for kind === "turso") */
  authToken: string;
}

export function resolveDatabaseConfig(env: {
  [key: string]: string | undefined;
}): DatabaseConfig {
  const raw = (env.DATABASE_URL || "").trim();
  if (raw.startsWith("libsql://") || raw.startsWith("https://")) {
    return {
      kind: "turso",
      url: raw,
      authToken: (env.TURSO_AUTH_TOKEN || "").trim(),
    };
  }
  return {
    kind: "local",
    url: raw || "file:./dev.db",
    authToken: "",
  };
}

/** Fail-closed: Turso without token never boots half-configured */
export function assertDatabaseConfig(cfg: DatabaseConfig): void {
  if (cfg.kind === "turso" && !cfg.authToken) {
    throw new Error(
      "DATABASE_URL points to Turso but TURSO_AUTH_TOKEN is missing"
    );
  }
}

/**
 * Splits Prisma-generated DDL into single statements. A naive
 * `split(";")` breaks inside string literals (e.g. DEFAULT 'a;b'),
 * so quotes are tracked. Good enough for migrate-diff output
 * (CREATE TABLE / CREATE INDEX, no triggers/procedures).
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote: string | null = null;

  const flush = () => {
    const cleaned = current
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim();
    if (cleaned) out.push(cleaned);
    current = "";
  };

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ";") {
      current += ch;
      flush();
      continue;
    }
    current += ch;
  }
  flush();
  return out;
}
