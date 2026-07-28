import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitBuckets, sessions, users } from "@/db/schema";
import {
  createSession,
  readSession,
  revokeAllUserSessions,
  revokeSession,
} from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { resetTestDatabase } from "@/tests/setup/database";

describe("session primitives", () => {
  let userId: string;

  beforeAll(async () => {
    await resetTestDatabase();
    const [user] = await db.insert(users).values({
      normalizedUsername: "session-user",
      displayUsername: "Session User",
    }).returning({ id: users.id });
    userId = user.id;
  });

  it("stores only a digest and rejects a revoked session", async () => {
    const { token, session } = await createSession(userId, {
      userAgent: "vitest",
      ipAddress: "127.0.0.1",
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.tokenDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(session.tokenDigest).not.toBe(token);
    expect(await readSession(token)).toMatchObject({ id: userId });

    await revokeSession(session.id);
    expect(await readSession(token)).toBeNull();
  });

  it("rejects expired sessions and sessions for suspended users", async () => {
    const expired = await createSession(userId, {
      userAgent: null,
      ipAddress: null,
    });
    await db.update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(sessions.id, expired.session.id));
    expect(await readSession(expired.token)).toBeNull();

    const suspended = await createSession(userId, {
      userAgent: null,
      ipAddress: null,
    });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, userId));
    expect(await readSession(suspended.token)).toBeNull();
    await db.update(users).set({ status: "active" }).where(eq(users.id, userId));
  });

  it("revokes every active session for a user", async () => {
    const first = await createSession(userId, { userAgent: null, ipAddress: null });
    const second = await createSession(userId, { userAgent: null, ipAddress: null });

    await revokeAllUserSessions(userId);

    await expect(readSession(first.token)).resolves.toBeNull();
    await expect(readSession(second.token)).resolves.toBeNull();
  });

  it("updates last use only after five minutes", async () => {
    const created = await createSession(userId, { userAgent: null, ipAddress: null });
    const stale = new Date(Date.now() - 6 * 60_000);
    await db.update(sessions).set({ lastUsedAt: stale }).where(eq(sessions.id, created.session.id));

    await readSession(created.token);
    const [refreshed] = await db.select().from(sessions).where(eq(sessions.id, created.session.id));
    expect(refreshed.lastUsedAt.getTime()).toBeGreaterThan(stale.getTime());

    const recent = new Date(Date.now() - 60_000);
    await db.update(sessions).set({ lastUsedAt: recent }).where(eq(sessions.id, created.session.id));
    await readSession(created.token);
    const [unchanged] = await db.select().from(sessions).where(eq(sessions.id, created.session.id));
    expect(unchanged.lastUsedAt.getTime()).toBe(recent.getTime());
  });
});

describe("PostgreSQL rate limiter", () => {
  it("shares a configured limit across two independently created instances", async () => {
    const firstLimiter = createRateLimiter(db);
    const secondLimiter = createRateLimiter(db);
    const rule = { limit: 2, windowSeconds: 60 };

    await expect(firstLimiter.consumeRateLimit("login:almaty:127.0.0.1", rule)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(secondLimiter.consumeRateLimit("login:almaty:127.0.0.1", rule)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    await expect(firstLimiter.consumeRateLimit("login:almaty:127.0.0.1", rule)).resolves.toMatchObject({
      allowed: false,
    });

    const [bucket] = await db.select().from(rateLimitBuckets);
    expect(bucket.attempts).toBe(3);
  });
});

afterAll(() => db.$client.end());
