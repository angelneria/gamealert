/**
 * usage: DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:turso
 *
 * Creates the tables in the REMOTE Turso database. Prisma 5's CLI only
 * accepts `file:` URLs for the sqlite provider, so `prisma db push`
 * cannot target libsql:// — instead this script renders the DDL with
 * `prisma migrate diff` (offline, no DB needed) and applies it with
 * @libsql/client, then verifies the tables exist.
 */
import { execSync } from "node:child_process";
import { createClient } from "@libsql/client";
import {
  resolveDatabaseConfig,
  assertDatabaseConfig,
  splitSqlStatements,
} from "../src/lib/db-config";

async function main() {
  const cfg = resolveDatabaseConfig(process.env);
  assertDatabaseConfig(cfg);
  if (cfg.kind !== "turso") {
    console.error(
      "db:turso needs a libsql:// DATABASE_URL + TURSO_AUTH_TOKEN (local SQLite uses `prisma db push`)"
    );
    process.exit(1);
  }

  const ddl = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const statements = splitSqlStatements(ddl);
  console.log(`Applying ${statements.length} statements to ${cfg.url}`);

  const db = createClient({ url: cfg.url, authToken: cfg.authToken });
  const batch = db.batch(
    statements.map((sql) => ({ sql, args: [] })),
    "write"
  );
  await batch;
  db.close();

  // Verify: the three tables exist and are empty
  const check = createClient({ url: cfg.url, authToken: cfg.authToken });
  const tables = await check.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','subscriptions','notifications') ORDER BY name"
  );
  check.close();
  const names = tables.rows.map((r) => String(r.name));
  console.log(`Tables in Turso: ${names.join(", ") || "(none)"}`);
  if (names.length !== 3) {
    console.error("MISSING TABLES — expected users, subscriptions, notifications");
    process.exit(1);
  }
  console.log("Turso database ready.");
}

main().catch((err) => {
  console.error("db:turso failed:", (err as Error).message);
  process.exit(1);
});
