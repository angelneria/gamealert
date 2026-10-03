/**
 * db-config — selector de base de datos local vs Turso (puro).
 */
import {
  resolveDatabaseConfig,
  assertDatabaseConfig,
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
