import {
  hashPassword,
  verifyPassword,
  verifyPasswordOrDummy,
} from "@/lib/password";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import { parseToken, SESSION_COOKIE, buildSigningInput } from "@/lib/session-core";
import { loginSchema } from "@/lib/validation";

describe("password hashing (scrypt)", () => {
  it("roundtrips: hash then verify with the same password", () => {
    const hash = hashPassword("MiClaveSegura123");
    expect(verifyPassword("MiClaveSegura123", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashPassword("MiClaveSegura123");
    expect(verifyPassword("otra-clave", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("produces a different hash per user (unique salt)", () => {
    const a = hashPassword("misma-clave");
    const b = hashPassword("misma-clave");
    expect(a).not.toBe(b);
    expect(verifyPassword("misma-clave", a)).toBe(true);
    expect(verifyPassword("misma-clave", b)).toBe(true);
  });

  it("never stores the password in clear text", () => {
    const hash = hashPassword("SuperSecreta999");
    expect(hash).not.toContain("SuperSecreta999");
    expect(hash.startsWith("scrypt:")).toBe(true);
  });

  it("rejects malformed or tampered hashes", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "plaintext")).toBe(false);
    expect(verifyPassword("x", "bcrypt:abc:def")).toBe(false);
    expect(verifyPassword("x", "scrypt:abc")).toBe(false);

    const hash = hashPassword("clave");
    const [algo, salt, hex] = hash.split(":");
    const tampered = `${algo}:${salt}:${hex.slice(0, -4)}0000`;
    expect(verifyPassword("clave", tampered)).toBe(false);
  });

  it("verifyPasswordOrDummy fails for legacy users without passwordHash", () => {
    expect(verifyPasswordOrDummy("cualquiera", "")).toBe(false);
  });

  it("verifyPasswordOrDummy accepts a valid legacy-hash pair", () => {
    const hash = hashPassword("clave-valida");
    expect(verifyPasswordOrDummy("clave-valida", hash)).toBe(true);
  });
});

describe("session tokens (HMAC-SHA256)", () => {
  it("creates a token that verifies back to the same userId", () => {
    const token = createSessionToken("user_abc123");
    expect(verifySessionToken(token)).toBe("user_abc123");
  });

  it("token has format userId.expiresAt.signature", () => {
    const token = createSessionToken("user_abc");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("user_abc");
    expect(Number(parts[1])).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects a tampered userId", () => {
    const token = createSessionToken("user_abc");
    const [, exp, sig] = token.split(".");
    expect(verifySessionToken(`attacker.${exp}.${sig}`)).toBeNull();
  });

  it("rejects a tampered expiry (extension attack)", () => {
    const token = createSessionToken("user_abc");
    const [uid, , sig] = token.split(".");
    const farFuture = Math.floor(Date.now() / 1000) + 999999999;
    expect(verifySessionToken(`${uid}.${farFuture}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken("user_abc");
    const [uid, exp] = token.split(".");
    expect(verifySessionToken(`${uid}.${exp}.AAAA`)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken("user_abc", -10); // ya caducado
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects garbage and empty input", () => {
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
    expect(verifySessionToken("../../etc/passwd")).toBeNull();
  });

  it("parseToken validates structure", () => {
    expect(parseToken("")).toBeNull();
    expect(parseToken("only-two.parts")).toBeNull();
    expect(parseToken("uid.notanumber.sig")).toBeNull();
    expect(parseToken("uid.99999999999.sig")).not.toBeNull();
  });

  it("buildSigningInput covers user + expiry", () => {
    expect(buildSigningInput("u1", 123)).toBe("u1.123");
  });

  it("session cookie name is stable", () => {
    expect(SESSION_COOKIE).toBe("ga_session");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "clave" }).success
    ).toBe(true);
  });

  it("rejects missing password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(
      loginSchema.safeParse({ email: "nope", password: "clave" }).success
    ).toBe(false);
  });

  it("does NOT enforce the 8-char policy on login (no info leak)", () => {
    // Un atacante no debe aprender la política de contraseñas por el login
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "x" }).success
    ).toBe(true);
  });
});
