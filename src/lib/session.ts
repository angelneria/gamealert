import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  getSessionSecret,
  buildSigningInput,
  parseToken,
} from "./session-core";

/**
 * Session tokens — Node runtime (route handlers).
 * HMAC-SHA256 signed, constant-time verification.
 */

export function createSessionToken(
  userId: string,
  ttlSeconds: number = SESSION_TTL_SECONDS
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const input = buildSigningInput(userId, expiresAt);
  const sig = createHmac("sha256", getSessionSecret())
    .update(input)
    .digest("base64url");
  return `${input}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): string | null {
  if (!token) return null;
  const parsed = parseToken(token);
  if (!parsed) return null;
  if (parsed.expiresAt < nowSeconds) return null;

  const expected = createHmac("sha256", getSessionSecret())
    .update(buildSigningInput(parsed.userId, parsed.expiresAt))
    .digest();

  const given = Buffer.from(parsed.sig, "base64url");
  if (expected.length !== given.length) return null;
  return timingSafeEqual(expected, given) ? parsed.userId : null;
}

export function setSessionCookie(res: NextResponse, userId: string): void {
  const token = createSessionToken(userId);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
