import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { resetTestDatabase } from "@/tests/setup/database";

describe("user schema", () => {
  beforeAll(resetTestDatabase);
  afterAll(() => db.$client.end());

  it("enforces normalized username uniqueness", async () => {
    await db.insert(users).values({
      normalizedUsername: "almaty",
      displayUsername: "Almaty",
    });

    await expect(
      db.insert(users).values({
        normalizedUsername: "almaty",
        displayUsername: "ALMATY",
      }),
    ).rejects.toThrow();

    expect(
      await db.query.users.findFirst({
        where: eq(users.normalizedUsername, "almaty"),
      }),
    ).toBeDefined();
  });
  it("permits absent legacy IDs while rejecting duplicate stable legacy IDs", async () => {
    const { categories, places } = await import("@/db/schema");

    await db.insert(places).values([
      { slug: "custom-place-one" },
      { slug: "custom-place-two" },
      { slug: "legacy-place", legacyId: "1" },
    ]);
    await db.insert(categories).values({ slug: "legacy-category", legacyId: "1" });

    await expect(
      db.insert(places).values({ slug: "duplicate-legacy-place", legacyId: "1" }),
    ).rejects.toThrow();
    await expect(
      db.insert(categories).values({ slug: "duplicate-legacy-category", legacyId: "1" }),
    ).rejects.toThrow();
  });

  it("combines rate-limit attempts from independent atomic upserts", async () => {
    const { rateLimitBuckets } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");
    const keyDigest = "a".repeat(64);

    const increment = () => db.insert(rateLimitBuckets).values({
      keyDigest,
      windowStartedAt: new Date("2026-07-28T00:00:00.000Z"),
      attempts: 1,
      expiresAt: new Date("2026-07-28T00:05:00.000Z"),
    }).onConflictDoUpdate({
      target: rateLimitBuckets.keyDigest,
      set: { attempts: sql`${rateLimitBuckets.attempts} + 1` },
    });

    await Promise.all([increment(), increment()]);
    expect(await db.query.rateLimitBuckets.findFirst({
      where: eq(rateLimitBuckets.keyDigest, keyDigest),
    })).toMatchObject({ attempts: 2 });
  });
  it("rejects malformed session token digests", async () => {
    const [user] = await db.insert(users).values({
      normalizedUsername: "session-check",
      displayUsername: "Session Check",
    }).returning({ id: users.id });

    const insertSession = (tokenDigest: string) => db.insert(sessions).values({
      userId: user.id,
      tokenDigest,
      expiresAt: new Date("2026-08-28T00:00:00.000Z"),
    });

    await expect(insertSession("x")).rejects.toThrow();
    await expect(insertSession("g".repeat(64))).rejects.toThrow();
  });
});
