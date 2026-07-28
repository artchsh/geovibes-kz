import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { env } from "@/lib/env";
import type { AuthenticatedUser } from "@/lib/auth/authorization";

export interface SessionContext {
  userAgent: string | null;
  ipAddress: string | null;
}

export type SessionRecord = typeof sessions.$inferSelect;

const LAST_USED_WRITE_INTERVAL_MS = 5 * 60_000;

function digestToken(token: string): string {
  return createHash("sha256").update(token + env.AUTH_SECRET).digest("hex");
}

export async function createSession(
  userId: string,
  context: SessionContext,
): Promise<{ token: string; session: SessionRecord }> {
  void context;
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  const [session] = await db.insert(sessions).values({
    userId,
    tokenDigest: digestToken(token),
    expiresAt,
  }).returning();

  return { token, session };
}

export async function readSession(token: string): Promise<AuthenticatedUser | null> {
  const now = new Date();
  const [record] = await db.select({
    session: sessions,
    user: users,
  })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.tokenDigest, digestToken(token)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
      eq(users.status, "active"),
    ))
    .limit(1);

  if (!record) return null;

  await db.update(sessions)
    .set({ lastUsedAt: now })
    .where(and(
      eq(sessions.id, record.session.id),
      isNull(sessions.revokedAt),
      lt(sessions.lastUsedAt, new Date(now.getTime() - LAST_USED_WRITE_INTERVAL_MS)),
    ));

  return record.user;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
