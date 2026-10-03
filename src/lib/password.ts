import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard KDF, built into Node).
 * Format: scrypt:<salt-hex>:<hash-hex>
 *
 * No external dependencies. Salt is 16 random bytes per user,
 * timing-safe comparison on verify.
 */

const KEY_LENGTH = 64;
const COST = 16384; // scrypt N

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: COST }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH, { N: COST });
  return timingSafeEqual(candidate, expected);
}

/**
 * Dummy hash used to equalize timing when the account does not exist,
 * preventing user-enumeration via response time.
 */
const DUMMY_HASH = hashPassword(randomBytes(32).toString("hex"));

export function verifyPasswordOrDummy(password: string, stored: string): boolean {
  return verifyPassword(password, stored || DUMMY_HASH);
}
