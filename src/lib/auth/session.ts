import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { serverEnv } from "@/lib/env";

import { ADMIN_ROLES, type AdminRole } from "./permissions";

/**
 * Admin sessions are a signed JWT held in an httpOnly cookie.
 *
 * Design notes:
 *  - The cookie is httpOnly + SameSite=Lax + Secure in production, so script
 *    cannot read it and cross-site POSTs do not carry it.
 *  - The token is signed, not encrypted: it carries only a user id, email,
 *    display name and role. No secrets, no evidence references.
 *  - Authorisation decisions never trust the role in the token alone — see
 *    `getCurrentAdmin`, which re-reads the role from the database.
 */

export const SESSION_COOKIE = "mmy_session";

const ISSUER = "mm-yoteshin";
const AUDIENCE = "mm-yoteshin:admin";

export type SessionPayload = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminRole;
};

function signingKey(): Uint8Array {
  return new TextEncoder().encode(serverEnv().sessionSecret);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const ttlHours = serverEnv().sessionTtlHours;

  return new SignJWT({
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(signingKey());
}

/**
 * Verify a session token. Returns `null` for anything that is expired, signed
 * with a different key, or structurally wrong — callers never see an exception.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    });

    const userId = payload.sub;
    const email = payload.email;
    const displayName = payload.displayName;
    const role = payload.role;

    if (typeof userId !== "string" || typeof email !== "string") return null;
    if (typeof role !== "string" || !(ADMIN_ROLES as readonly string[]).includes(role)) return null;

    return {
      userId,
      email,
      displayName: typeof displayName === "string" ? displayName : email,
      role: role as AdminRole,
    };
  } catch {
    return null;
  }
}

/** Write the session cookie. Must be called from a Server Action or Route Handler. */
export async function establishSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const ttlSeconds = serverEnv().sessionTtlHours * 60 * 60;
  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv().isProduction,
    path: "/",
    maxAge: ttlSeconds,
  });
}

/** Clear the session cookie. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv().isProduction,
    path: "/",
    maxAge: 0,
  });
}

/** Read and verify the raw session token, without touching the database. */
export async function readSessionToken(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
