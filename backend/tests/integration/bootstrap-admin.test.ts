import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordCredentials, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, readSession } from "@/lib/auth/session";
import {
  bootstrapAdmin,
  parseBootstrapArgs,
} from "@/scripts/bootstrap-admin";
import { resetTestDatabase } from "@/tests/setup/database";

describe("admin bootstrap", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  it("creates one admin with a password credential", async () => {
    const result = await bootstrapAdmin("FirstAdmin", "very secure admin password");

    expect(result.username).toBe("FirstAdmin");
    const [stored] = await db.select().from(users).where(eq(users.id, result.id));
    expect(stored).toMatchObject({
      normalizedUsername: "firstadmin",
      displayUsername: "FirstAdmin",
      role: "admin",
      status: "active",
    });
    const [credential] = await db.select().from(passwordCredentials)
      .where(eq(passwordCredentials.userId, result.id));
    await expect(verifyPassword(
      credential.passwordHash,
      "very secure admin password",
    )).resolves.toBe(true);
  });

  it("promotes exactly the named existing user, changes its credential, and revokes sessions", async () => {
    const [existing] = await db.insert(users).values({
      normalizedUsername: "promote.me",
      displayUsername: "Promote.Me",
      role: "user",
    }).returning();
    await db.insert(passwordCredentials).values({
      userId: existing.id,
      passwordHash: await hashPassword("old secure password"),
    });
    const activeSession = await createSession(existing.id, {
      ipAddress: null,
      userAgent: null,
    });

    const result = await bootstrapAdmin("Promote.Me", "new secure password");

    expect(result).toEqual({ id: existing.id, username: "Promote.Me" });
    const [promoted] = await db.select().from(users).where(eq(users.id, existing.id));
    expect(promoted.role).toBe("admin");
    await expect(readSession(activeSession.token)).resolves.toBeNull();
    const [credential] = await db.select().from(passwordCredentials)
      .where(eq(passwordCredentials.userId, existing.id));
    await expect(verifyPassword(credential.passwordHash, "new secure password"))
      .resolves.toBe(true);
  });

  it("refuses plaintext password arguments and accepts only a username", () => {
    expect(parseBootstrapArgs(["--username", "safe-admin"])).toEqual({
      username: "safe-admin",
    });
    expect(() => parseBootstrapArgs([
      "--username",
      "unsafe-admin",
      "--password",
      "visible secret",
    ])).toThrow(/plaintext password/i);
    expect(() => parseBootstrapArgs([
      "--username=unsafe-admin",
      "--password=visible-secret",
    ])).toThrow(/plaintext password/i);
  });
});

afterAll(() => db.$client.end());
