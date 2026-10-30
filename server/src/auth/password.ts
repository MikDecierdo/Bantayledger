import { randomBytes, pbkdf2 as pbkdf2Callback, timingSafeEqual } from "crypto";
import { promisify } from "util";

/**
 * Server-side port of src/lib/crypto.ts. Same algorithm (PBKDF2-SHA256, a
 * random salt per user, `iterations` stored alongside the hash so it can be
 * raised later without invalidating existing passwords) — only the API
 * (Node's `crypto` instead of the WebView's `crypto.subtle`) differs.
 */

const pbkdf2 = promisify(pbkdf2Callback);

const DEFAULT_ITERATIONS = 100_000;
const KEY_LENGTH_BYTES = 32; // 256 bits, matching the client's KEY_LENGTH_BITS

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

async function derive(password: string, salt: Buffer, iterations: number): Promise<string> {
  const derived = await pbkdf2(password, salt, iterations, KEY_LENGTH_BYTES, "sha256");
  return derived.toString("hex");
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, DEFAULT_ITERATIONS);
  return { hash, salt: salt.toString("hex"), iterations: DEFAULT_ITERATIONS };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const candidate = await derive(password, Buffer.from(stored.salt, "hex"), stored.iterations);
  const candidateBuf = Buffer.from(candidate, "hex");
  const storedBuf = Buffer.from(stored.hash, "hex");
  if (candidateBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(candidateBuf, storedBuf);
}
