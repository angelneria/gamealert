import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * In-memory rate limiter (per IP).
 * Production: swap for Redis. For a single-instance app this is sufficient
 * and follows the same contract: allow | retryAfter | remaining.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 300; // general limit per IP per window
const MAX_SENSITIVE = 20; // stricter limit for registration / notify endpoints

// Sensitive paths get the stricter budget (brute-force / spam protection)
function isSensitivePath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/notify") ||
    pathname.startsWith("/api/cron")
  );
}

// Loopback detection (pure, unit-testable).
// Next's dev server may report the peer as IPv4-mapped IPv6 (::ffff:127.0.0.1)
// in x-forwarded-for, so the whole 127.0.0.0/8 range and mapped forms count.
export function isLoopbackIp(ip: string): boolean {
  if (!ip) return false;
  const normalized = ip.toLowerCase();
  if (normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost" || normalized === "unknown") {
    return true;
  }
  // IPv4-mapped IPv6: ::ffff:127.x.x.x
  const unmapped = normalized.startsWith("::ffff:")
    ? normalized.slice("::ffff:".length)
    : normalized;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(unmapped);
}

// In development/tests all requests come from loopback — don't burn the budget
function isLoopback(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  return isLoopbackIp(ip);
}

export function rateLimit(req: NextRequest): NextResponse | null {
  if (isLoopback(req)) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const sensitive = isSensitivePath(new URL(req.url).pathname);
  const max = sensitive ? MAX_SENSITIVE : MAX_REQUESTS;
  const key = `${ip}:${sensitive ? "s" : "g"}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  entry.count++;
  return null;
}

/**
 * Security headers applied to every response.
 * CSP is strict but allows the CDNs we actually use.
 */
export function securityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://store.steampowered.com https://store-site-backend-static-ipv4.ak.epicgames.com https://www.cheapshark.com https://www.gog.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}
