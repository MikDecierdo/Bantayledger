import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, conflict, unauthorized } from "../errors";
import { hashPassword, verifyPassword } from "./password";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "./tokens";

/**
 * Server-side auth, replacing both Supabase Auth (email/password + session)
 * and the local SQLite authService's sign-up/sign-in logic (see
 * src/services/local/authService.ts on the client) — this is the one place
 * that logic now lives.
 */

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  businessName: string;
}

export interface Session {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

async function issueSession(userId: string): Promise<Session> {
  const accessToken = signAccessToken(userId);
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();

  await db("refresh_tokens").insert({
    id: randomUUID(),
    user_id: userId,
    token_hash: hash,
    expires_at: expiresAt,
  });

  return { userId, accessToken, refreshToken };
}

export async function signUp(input: SignUpInput): Promise<Session> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || !input.fullName.trim() || !input.businessName.trim()) {
    throw badRequest("Email, password, full name and business name are all required.");
  }

  const existing = await db("users").where({ email }).first();
  if (existing) {
    throw conflict("An account with that email already exists. Try signing in instead.");
  }

  const userId = randomUUID();
  const { hash, salt, iterations } = await hashPassword(input.password);
  const businessId = randomUUID();

  await db.transaction(async (trx) => {
    await trx("users").insert({ id: userId, email });
    await trx("credentials").insert({ user_id: userId, password_hash: hash, salt, iterations });
    await trx("profiles").insert({
      id: userId,
      email,
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
    });
    await trx("businesses").insert({
      id: businessId,
      name: input.businessName.trim(),
      owner_id: userId,
    });
    await trx("business_users").insert({
      id: randomUUID(),
      business_id: businessId,
      user_id: userId,
      role: "OWNER",
    });
  });

  return issueSession(userId);
}

export async function signIn(email: string, password: string): Promise<Session> {
  const row = await db("users")
    .join("credentials", "credentials.user_id", "users.id")
    .where("users.email", email.trim().toLowerCase())
    .first("users.id as userId", "credentials.password_hash", "credentials.salt", "credentials.iterations");

  if (!row) {
    throw unauthorized("That email and password combination is not correct.");
  }

  const ok = await verifyPassword(password, {
    hash: row.password_hash,
    salt: row.salt,
    iterations: row.iterations,
  });

  if (!ok) {
    throw unauthorized("That email and password combination is not correct.");
  }

  return issueSession(row.userId);
}

export async function refresh(refreshToken: string): Promise<Session> {
  const hash = hashRefreshToken(refreshToken);
  const row = await db("refresh_tokens").where({ token_hash: hash }).first();

  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw unauthorized("Your session has expired. Please sign in again.");
  }

  // Rotate: revoke the presented token and issue a fresh pair, so a stolen
  // refresh token can only be replayed once before detection.
  await db("refresh_tokens").where({ id: row.id }).update({ revoked_at: new Date() });

  return issueSession(row.user_id);
}

export async function signOut(refreshToken: string): Promise<void> {
  const hash = hashRefreshToken(refreshToken);
  await db("refresh_tokens").where({ token_hash: hash }).update({ revoked_at: new Date() });
}

/** Mirrors the Supabase create_business_with_owner RPC / the local authService's copy of it. */
export async function createBusinessWithOwner(userId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw badRequest("A business name is required.");

  const businessId = randomUUID();

  await db.transaction(async (trx) => {
    await trx("businesses").insert({ id: businessId, name: trimmed, owner_id: userId });
    await trx("business_users").insert({
      id: randomUUID(),
      business_id: businessId,
      user_id: userId,
      role: "OWNER",
    });
  });

  return businessId;
}
