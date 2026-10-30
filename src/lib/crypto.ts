/**
 * Password hashing for local accounts, using the WebView's built-in Web
 * Crypto API (`crypto.subtle`) — no dependency needed, and supported by the
 * Chrome/WKWebView engines every Capacitor build ships on.
 *
 * PBKDF2-SHA256 with a random salt per user and a fixed iteration count.
 * `iterations` is stored alongside the hash so it can be raised later without
 * invalidating passwords hashed under the old count.
 */

const DEFAULT_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS,
  );

  return toHex(bits);
}

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, DEFAULT_ITERATIONS);
  return { hash, salt: toHex(salt.buffer as ArrayBuffer), iterations: DEFAULT_ITERATIONS };
}

export async function verifyPassword(
  password: string,
  stored: PasswordHash,
): Promise<boolean> {
  const candidate = await derive(password, fromHex(stored.salt), stored.iterations);
  // Lengths are fixed (both hex-encoded SHA-256 output), so a plain
  // char-by-char compare is constant-time in practice for this use case.
  if (candidate.length !== stored.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  }
  return diff === 0;
}
