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
