/**
 * Password hashing for Studio accounts: PBKDF2-SHA256 through the runtime's Web Crypto (native,
 * so it stays within a Worker's CPU budget, unlike a scrypt written in JavaScript).
 *
 * Stored as `pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>`, so the iteration count can be
 * raised later without breaking existing passwords: each hash carries its own.
 */
const ITERATIONS = 100_000;
const KEY_BITS = 256;
const PREFIX = "pbkdf2-sha256";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: BufferSource, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [prefix, iter, salt, expected] = hash.split("$");
  const iterations = Number(iter);
  if (prefix !== PREFIX || !salt || !expected || !Number.isInteger(iterations)) return false;
  const actual = await derive(password, unb64(salt), iterations);
  const want = unb64(expected);
  if (actual.length !== want.length) return false;
  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ want[i]!;
  return diff === 0;
}
