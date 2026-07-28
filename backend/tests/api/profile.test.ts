import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import {
  GET as profileGet,
  OPTIONS as profileOptions,
  PATCH as profilePatch,
} from "@/app/api/v1/profile/route";
import { POST as mergeGuest } from "@/app/api/v1/profile/merge-guest/route";
import {
  DELETE as deleteSaved,
  GET as getSaved,
  OPTIONS as savedOptions,
  PUT as putSaved,
} from "@/app/api/v1/saved-places/route";
import { resetTestDatabase } from "@/tests/setup/database";
import {
  categoryFixture,
  placeFixture,
  sessionFixture,
  userFixture,
} from "@/tests/setup/user-catalog-fixtures";

const WEB_ORIGIN = "http://localhost:3001";
const MOBILE_ORIGIN = "http://localhost:8081";

function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    cookie?: string;
    origin?: string;
    rawBody?: string;
    contentType?: string;
  } = {},
): Request {
  const headers = new Headers();
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin) headers.set("origin", options.origin);
  if (options.body !== undefined || options.rawBody !== undefined) {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  return new Request(`http://localhost:3001${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.rawBody ?? (
      options.body === undefined ? undefined : JSON.stringify(options.body)
    ),
  });
}

beforeEach(resetTestDatabase);

describe("profile API", () => {
  it("returns and updates only the public profile allowlist", async () => {
    const user = await userFixture();
    const category = await categoryFixture();
    const { token } = await sessionFixture(user.id);

    const response = await profilePatch(request("/api/v1/profile", {
      method: "PATCH",
      token,
      body: {
        username: "  New.Name  ",
        preferredLocale: "kk",
        onboardingCompleted: true,
        interestCategoryIds: [category.id],
      },
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({
      id: user.id,
      username: "New.Name",
      preferredLocale: "kk",
      onboardingCompleted: true,
      interestCategoryIds: [category.id],
    });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(body.data).sort()).toEqual([
      "id",
      "interestCategoryIds",
      "onboardingCompleted",
      "preferredLocale",
      "username",
    ]);
    expect(await db.query.users.findFirst({ where: eq(users.id, user.id) }))
      .toMatchObject({ normalizedUsername: "new.name", displayUsername: "New.Name" });
    expect((await profileGet(request("/api/v1/profile", { token }))).status).toBe(200);
  });

  it.each(["admin", "ab", "has space", "кириллица"])(
    "rejects invalid or reserved username %s",
    async (username) => {
      const user = await userFixture();
      const { token } = await sessionFixture(user.id);
      const response = await profilePatch(request("/api/v1/profile", {
        method: "PATCH",
        token,
        body: { username },
      }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    },
  );

  it("maps username uniqueness races to a stable conflict", async () => {
    await userFixture({
      normalizedUsername: "taken.name",
      displayUsername: "Taken.Name",
    });
    const user = await userFixture();
    const { token } = await sessionFixture(user.id);
    const response = await profilePatch(request("/api/v1/profile", {
      method: "PATCH",
      token,
      body: { username: "TAKEN.NAME" },
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("USERNAME_UNAVAILABLE");
  });

  it("rejects private fields, malformed UUIDs, duplicates, and oversized bodies", async () => {
    const user = await userFixture();
    const { token } = await sessionFixture(user.id);
    for (const body of [
      { role: "admin" },
      { status: "suspended" },
      { userId: crypto.randomUUID() },
      { credential: "secret" },
      { preferredLocale: "fr" },
      { interestCategoryIds: ["not-a-uuid"] },
      { interestCategoryIds: [crypto.randomUUID(), crypto.randomUUID()] },
    ]) {
      if (Array.isArray(body.interestCategoryIds) && body.interestCategoryIds.length === 2) {
        body.interestCategoryIds[1] = body.interestCategoryIds[0];
      }
      const response = await profilePatch(request("/api/v1/profile", {
        method: "PATCH",
        token,
        body,
      }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    }
    const oversized = await profilePatch(request("/api/v1/profile", {
      method: "PATCH",
      token,
      rawBody: JSON.stringify({ username: "x".repeat(9_000) }),
    }));
    expect(oversized.status).toBe(413);
  });

  it("requires active sessions and rejects suspended, revoked, and expired ones", async () => {
    for (const kind of ["missing", "suspended", "revoked", "expired"] as const) {
      const user = await userFixture();
      const auth = await sessionFixture(user.id);
      if (kind === "suspended") {
        await db.update(users).set({ status: "suspended" }).where(eq(users.id, user.id));
      }
      if (kind === "revoked") {
        await db.update(sessions).set({ revokedAt: new Date() })
          .where(eq(sessions.userId, user.id));
      }
      if (kind === "expired") {
        await db.update(sessions).set({ expiresAt: new Date(0) })
          .where(eq(sessions.userId, user.id));
      }
      const response = await profileGet(request("/api/v1/profile", {
        token: kind === "missing" ? undefined : auth.token,
      }));
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("AUTH_REQUIRED");
    }
  });

  it("enforces cookie write origin while native bearer bypasses browser origin", async () => {
    const user = await userFixture();
    const place = await placeFixture();
    const { token, cookie } = await sessionFixture(user.id);

    for (const origin of [undefined, "https://attacker.example"]) {
      const response = await putSaved(request("/api/v1/saved-places", {
        method: "PUT",
        cookie,
        origin,
        body: { placeId: place.id },
      }));
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("UNTRUSTED_ORIGIN");
    }
    for (const response of [
      await profilePatch(request("/api/v1/profile", {
        method: "PATCH",
        cookie,
        origin: "https://attacker.example",
        body: { preferredLocale: "en" },
      })),
      await mergeGuest(request("/api/v1/profile/merge-guest", {
        method: "POST",
        cookie,
        origin: "https://attacker.example",
        body: { savedPlaceIds: [] },
      })),
      await deleteSaved(request("/api/v1/saved-places", {
        method: "DELETE",
        cookie,
        origin: "https://attacker.example",
        body: { placeId: place.id },
      })),
    ]) {
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("UNTRUSTED_ORIGIN");
    }
    expect((await profilePatch(request("/api/v1/profile", {
      method: "PATCH",
      token,
      body: { preferredLocale: "en" },
    }))).status).toBe(200);
    expect((await mergeGuest(request("/api/v1/profile/merge-guest", {
      method: "POST",
      token,
      body: { savedPlaceIds: [] },
    }))).status).toBe(200);
    expect((await putSaved(request("/api/v1/saved-places", {
      method: "PUT",
      cookie,
      origin: WEB_ORIGIN,
      body: { placeId: place.id },
    }))).status).toBe(204);
    expect((await deleteSaved(request("/api/v1/saved-places", {
      method: "DELETE",
      token,
      body: { placeId: place.id },
    }))).status).toBe(204);
  });

  it("supports idempotent saved-place writes and isolates owners", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const place = await placeFixture();
    const ownerAuth = await sessionFixture(owner.id);
    const otherAuth = await sessionFixture(other.id);

    for (let index = 0; index < 2; index += 1) {
      expect((await putSaved(request("/api/v1/saved-places", {
        method: "PUT",
        token: ownerAuth.token,
        body: { placeId: place.id },
      }))).status).toBe(204);
    }
    expect(await (await getSaved(request("/api/v1/saved-places", {
      token: ownerAuth.token,
    }))).json()).toMatchObject({ data: { savedPlaceIds: [place.id] } });

    expect((await deleteSaved(request("/api/v1/saved-places", {
      method: "DELETE",
      token: otherAuth.token,
      body: { placeId: place.id },
    }))).status).toBe(204);
    expect(await (await getSaved(request("/api/v1/saved-places", {
      token: ownerAuth.token,
    }))).json()).toMatchObject({ data: { savedPlaceIds: [place.id] } });
    for (let index = 0; index < 2; index += 1) {
      expect((await deleteSaved(request("/api/v1/saved-places", {
        method: "DELETE",
        token: ownerAuth.token,
        body: { placeId: place.id },
      }))).status).toBe(204);
    }
  });

  it("merges via HTTP and returns canonical IDs only after success", async () => {
    const user = await userFixture();
    const place = await placeFixture();
    const category = await categoryFixture();
    const { token } = await sessionFixture(user.id);
    const response = await mergeGuest(request("/api/v1/profile/merge-guest", {
      method: "POST",
      token,
      body: {
        savedPlaceIds: [place.id],
        interestCategoryIds: [category.id],
      },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: {
        savedPlaceIds: [place.id],
        interestCategoryIds: [category.id],
      },
    });
  });

  it("rejects duplicate and over-limit merge collections before database writes", async () => {
    const user = await userFixture();
    const { token } = await sessionFixture(user.id);
    const duplicateId = crypto.randomUUID();
    const duplicate = await mergeGuest(request("/api/v1/profile/merge-guest", {
      method: "POST",
      token,
      body: { savedPlaceIds: [duplicateId, duplicateId] },
    }));
    expect(duplicate.status).toBe(400);
    expect((await duplicate.json()).error.code).toBe("INVALID_REQUEST");

    const overLimit = await mergeGuest(request("/api/v1/profile/merge-guest", {
      method: "POST",
      token,
      body: {
        savedPlaceIds: Array.from({ length: 101 }, () => crypto.randomUUID()),
      },
    }));
    expect(overLimit.status).toBe(400);
    expect((await overLimit.json()).error.code).toBe("INVALID_REQUEST");
    expect((await profileGet(request("/api/v1/profile", { token }))).status).toBe(200);
  });

  it("returns configured CORS and route-specific OPTIONS methods", async () => {
    const profile = await profileOptions(request("/api/v1/profile", {
      method: "OPTIONS",
      origin: MOBILE_ORIGIN,
    }));
    const saved = await savedOptions(request("/api/v1/saved-places", {
      method: "OPTIONS",
      origin: MOBILE_ORIGIN,
    }));
    expect(profile.headers.get("access-control-allow-origin")).toBe(MOBILE_ORIGIN);
    expect(profile.headers.get("access-control-allow-methods"))
      .toBe("GET, PATCH, OPTIONS");
    expect(saved.headers.get("access-control-allow-methods"))
      .toBe("GET, PUT, DELETE, OPTIONS");
    expect((await profileOptions(request("/api/v1/profile", {
      method: "OPTIONS",
      origin: "https://attacker.example",
    }))).status).toBe(403);
  });
});

afterAll(() => db.$client.end());
