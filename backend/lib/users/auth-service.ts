import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordCredentials, sessions, users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import {
  createSession,
  readSession,
  revokeSessionToken,
} from "@/lib/auth/session";
import { normalizeUsername } from "@/lib/auth/username";

export interface AuthContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface CredentialsInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface PublicUser {
  id: string;
  username: string;
  role: "user" | "editor" | "admin";
  status: "active" | "suspended";
  preferredLocale: "ru" | "kk" | "en";
  onboardingCompletedAt: Date | null;
}

export interface AuthenticationResult {
  user: PublicUser;
  token: string;
}

const SIGN_UP_RATE_LIMIT = { limit: 20, windowSeconds: 60 * 60 };
const SIGN_IN_RATE_LIMIT = { limit: 5, windowSeconds: 15 * 60 };
const DUMMY_PASSWORD_HASH = hashPassword("dummy password credential");

function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    username: user.displayUsername,
    role: user.role,
    status: user.status,
    preferredLocale: user.preferredLocale,
    onboardingCompletedAt: user.onboardingCompletedAt,
  };
}

function rateLimitIdentity(context: AuthContext): string {
  return context.ipAddress ?? "unknown";
}

async function assertAllowed(
  key: string,
  rule: { limit: number; windowSeconds: number },
): Promise<void> {
  const result = await consumeRateLimit(key, rule);
  if (!result.allowed) {
    throw new ApiError(
      "RATE_LIMITED",
      429,
      "Too many attempts. Try again later",
      undefined,
      { "Retry-After": String(result.retryAfterSeconds) },
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string;
    cause?: { code?: string };
  };
  return candidate.code === "23505" || candidate.cause?.code === "23505";
}

function normalizedIdentityForRateLimit(username: string): string {
  try {
    return normalizeUsername(username);
  } catch {
    return username.trim().toLowerCase().slice(0, 64) || "invalid";
  }
}

function invalidCredentials(): ApiError {
  return new ApiError(
    "INVALID_CREDENTIALS",
    401,
    "Invalid username or password",
  );
}

export async function signUp(
  input: CredentialsInput,
  context: AuthContext,
): Promise<AuthenticationResult> {
  await assertAllowed(
    `auth:sign-up:ip:${rateLimitIdentity(context)}`,
    SIGN_UP_RATE_LIMIT,
  );

  let normalizedUsername: string;
  try {
    normalizedUsername = normalizeUsername(input.username);
  } catch {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      username: "Username must use 3-30 letters, numbers, dots, or underscores",
    });
  }
  const displayUsername = input.username.trim();
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.password);
  } catch {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      password: "Password must contain at least 10 characters and at most 256 bytes",
    });
  }

  try {
    return await db.transaction(async (transaction) => {
      const [user] = await transaction.insert(users).values({
        normalizedUsername,
        displayUsername,
        role: "user",
      }).returning();
      await transaction.insert(passwordCredentials).values({
        userId: user.id,
        passwordHash,
      });
      const session = await createSession(user.id, context, transaction);
      return { user: toPublicUser(user), token: session.token };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        "USERNAME_UNAVAILABLE",
        409,
        "Username is unavailable",
      );
    }
    throw error;
  }
}

export async function signIn(
  input: CredentialsInput,
  context: AuthContext,
): Promise<AuthenticationResult> {
  const normalizedForLimit = normalizedIdentityForRateLimit(input.username);
  await assertAllowed(
    `auth:sign-in:identity:${normalizedForLimit}:ip:${rateLimitIdentity(context)}`,
    SIGN_IN_RATE_LIMIT,
  );

  let normalizedUsername: string | null;
  try {
    normalizedUsername = normalizeUsername(input.username);
  } catch {
    normalizedUsername = null;
  }

  const [record] = normalizedUsername
    ? await db.select({
        user: users,
        passwordHash: passwordCredentials.passwordHash,
      })
      .from(users)
      .innerJoin(
        passwordCredentials,
        eq(passwordCredentials.userId, users.id),
      )
      .where(eq(users.normalizedUsername, normalizedUsername))
      .limit(1)
    : [];

  const passwordHash = record?.passwordHash ?? await DUMMY_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(passwordHash, input.password);
  if (!record || !passwordMatches || record.user.status !== "active") {
    throw invalidCredentials();
  }

  const session = await createSession(record.user.id, context);
  return { user: toPublicUser(record.user), token: session.token };
}

export async function signOut(token: string): Promise<void> {
  await revokeSessionToken(token);
}

export async function getCurrentUser(token: string): Promise<PublicUser | null> {
  const user = await readSession(token);
  return user ? toPublicUser(user) : null;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const [credential] = await db.select()
    .from(passwordCredentials)
    .where(eq(passwordCredentials.userId, userId))
    .limit(1);
  if (!credential || !await verifyPassword(
    credential.passwordHash,
    input.currentPassword,
  )) {
    throw invalidCredentials();
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(input.newPassword);
  } catch {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      newPassword: "Password must contain at least 10 characters and at most 256 bytes",
    });
  }

  await db.transaction(async (transaction) => {
    await transaction.update(passwordCredentials)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(passwordCredentials.userId, userId));
    await transaction.update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.userId, userId));
  });
}
