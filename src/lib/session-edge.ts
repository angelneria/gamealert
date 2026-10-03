import {
  getSessionSecret,
  buildSigningInput,
  parseToken,
  b64urlEncode,
} from "./session-core";

/**
 * Session verification — Edge runtime (middleware).
 * Uses Web Crypto (globalThis.crypto.subtle) because node:crypto is
 * unavailable in the Edge runtime. Produces the same HMAC-SHA256
 * signature as the Node implementation in ./session.ts.
 */
export async function verifySessionTokenEdge(
  token: string | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<string | null> {
  if (!token) return null;
  const parsed = parseToken(token);
  if (!parsed) return null;
  if (parsed.expiresAt < nowSeconds) return null;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(getSessionSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(buildSigningInput(parsed.userId, parsed.expiresAt))
    );
    const expected = b64urlEncode(sig);
    // Constant-time-ish string compare (length check first)
    if (expected.length !== parsed.sig.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ parsed.sig.charCodeAt(i);
    }
    return diff === 0 ? parsed.userId : null;
  } catch {
    return null;
  }
}
