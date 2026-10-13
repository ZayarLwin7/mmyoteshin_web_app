import { randomBytes } from "node:crypto";

import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

/**
 * Password hashing with Argon2id — the OWASP-recommended default.
 *
 * Parameters follow OWASP's minimum guidance (19 MiB memory, 2 iterations,
 * 1 degree of parallelism), which is also the RFC 9106 low-memory profile.
 */

/**
 * `@node-rs/argon2` declares `Algorithm` as an **ambient `const enum`**, and
 * TypeScript refuses to read those when `isolatedModules` is enabled — which
 * Next.js requires. The declaration is type-only: at runtime the package
 * exports `Algorithm` as an empty object, so `Algorithm.Argon2id` evaluates to
 * `undefined` and the algorithm is silently left to the native default.
 *
 * That default is Argon2id as well, so the hashes produced today are correct —
 * but "correct because a dependency's fallback happened to agree with us" is
 * not a guarantee, and a future default change would go unnoticed. Pin the
 * value instead. `2` is `Argon2id` per the package's own declaration, and is
 * the RFC 9106 recommendation for password storage.
 */
const ARGON2ID = 2;

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return argonHash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash.
 *
 * Returns `false` rather than throwing on a malformed hash so a corrupt row
 * cannot turn a login attempt into a 500 and leak which accounts exist.
 */
export async function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  try {
    return await argonVerify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * A real Argon2id hash of a random, unknowable value.
 *
 * When an email matches no account we still run a verification against this
 * hash, so the response time does not reveal whether the account exists. It is
 * generated lazily and cached so module import stays cheap.
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString("hex"));
  return dummyHashPromise;
}

/** Minimum password policy, mirrored in the admin UI for immediate feedback. */
export const PASSWORD_POLICY = {
  minLength: 12,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
} as const;
