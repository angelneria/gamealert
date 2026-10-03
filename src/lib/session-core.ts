/**
 * Session token core — pure helpers, Edge-compatible (no node: imports).
 *
 * Token format:  <userId>.<expiresAtEpochSeconds>.<base64url HMAC-SHA256>
 * The signature covers `${userId}.${expiresAt}` so a token can neither be
 * tampered with nor have its expiry extended without the server secret.
 */

export const SESSION_COOKIE = "ga_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const DEV_SECRET = "change-this-secret-in-development";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || DEV_SECRET;
  if (process.env.NODE_ENV === "production" && secret === DEV_SECRET) {
    // Fail closed: never run in production with the known dev secret.
    throw new Error(
      "SESSION_SECRET (or NEXTAUTH_SECRET) must be set to a strong random value in production"
    );
  }
  return secret;
}

export function b64urlEncode(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const bin = Array.from(new Uint8Array(bytes))
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecodeToString(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export interface ParsedToken {
  userId: string;
  expiresAt: number;
  sig: string;
}

export function buildSigningInput(userId: string, expiresAt: number): string {
  return `${userId}.${expiresAt}`;
}

export function parseToken(token: string): ParsedToken | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (!userId || !sig) return null;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  return { userId, expiresAt, sig };
}
