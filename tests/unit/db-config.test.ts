/**
 * db-config — selector de base de datos local vs Turso (puro).
 */
import {
  resolveDatabaseConfig,
  assertDatabaseConfig,
  splitSqlStatements,
} from "@/lib/db-config";

describe("resolveDatabaseConfig", () => {
  it("libsql:// → turso con su token", () => {
    expect(
      resolveDatabaseConfig({
        DATABASE_URL: "libsql://gamealert-xxx.turso.io",
        TURSO_AUTH_TOKEN: "tok",
      })
    ).toEqual({
      kind: "turso",
      url: "libsql://gamealert-xxx.turso.io",
      authToken: "tok",
    });
  });

  it("file: → sqlite local", () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: "file:./dev.db" })).toEqual({
      kind: "local",
      url: "file:./dev.db",
      authToken: "",
    });
  });

  it("sin DATABASE_URL → sqlite local por defecto (dev)", () => {
    expect(resolveDatabaseConfig({}).kind).toBe("local");
  });

  it("recorta espacios accidentales", () => {
    const cfg = resolveDatabaseConfig({
      DATABASE_URL: "  libsql://x.turso.io  ",
      TURSO_AUTH_TOKEN: "  tok  ",
    });
    expect(cfg).toEqual({ kind: "turso", url: "libsql://x.turso.io", authToken: "tok" });
  });
});

describe("splitSqlStatements", () => {
  it("separa el DDL de migrate-diff y tira los comentarios", () => {
    const ddl = `-- CreateTable
CREATE TABLE "users" ("id" TEXT NOT NULL PRIMARY KEY);

-- CreateTable
CREATE TABLE "notifications" ("id" TEXT NOT NULL PRIMARY KEY);
`;
    const out = splitSqlStatements(ddl);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(
      'CREATE TABLE "users" ("id" TEXT NOT NULL PRIMARY KEY);'
    );
    expect(out[1]).toContain('CREATE TABLE "notifications"');
    expect(out.join("")).not.toContain("CreateTable");
  });

  it("no parte por punto-y-coma dentro de literales", () => {
    const out = splitSqlStatements(
      `CREATE TABLE "t" ("a" TEXT DEFAULT 'x;y', "b" TEXT);`
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("'x;y'");
  });

  it("entrada vacía o solo comentarios → nada", () => {
    expect(splitSqlStatements("")).toEqual([]);
    expect(splitSqlStatements("-- nada aquí\n")).toEqual([]);
  });
});

describe("assertDatabaseConfig", () => {
  it("turso sin token → error fail-closed (no arranca a medias)", () => {
    expect(() =>
      assertDatabaseConfig({ kind: "turso", url: "libsql://x", authToken: "" })
    ).toThrow(/TURSO_AUTH_TOKEN/);
  });

  it("turso con token y local pasan", () => {
    expect(() =>
      assertDatabaseConfig({ kind: "turso", url: "libsql://x", authToken: "t" })
    ).not.toThrow();
    expect(() =>
      assertDatabaseConfig({ kind: "local", url: "file:./dev.db", authToken: "" })
    ).not.toThrow();
  });
});
