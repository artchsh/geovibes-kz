import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { passwordCredentials, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { GET, OPTIONS, POST } from "@/app/api/auth/[action]/route";
import { resetTestDatabase } from "@/tests/setup/database";

const WEB_ORIGIN = "http://localhost:3001";
const NATIVE_ORIGIN = "geovibes://";
const NATIVE_HEADER = { "x-geovibes-client": "native" };

function routeContext(action: string) {
  return { params: Promise.resolve({ action }) };
}

function jsonRequest(
  action: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`http://localhost:3001/api/auth/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: WEB_ORIGIN,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function post(
  action: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return POST(jsonRequest(action, body, headers), routeContext(action));
}

async function createExistingUser(username = "existing", password = "correct horse battery") {
  const [user] = await db.insert(users).values({
    normalizedUsername: username.toLowerCase(),
    displayUsername: username,
  }).returning();
  await db.insert(passwordCredentials).values({
    userId: user.id,
    passwordHash: await hashPassword(password),
  });
  return user;
}

function cookieValue(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("Expected a session cookie");
  return header.split(";")[0];
}

describe("authentication API", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  it("creates only an ordinary user and returns a cookie session", async () => {
    const response = await post("sign-up", {
      username: "NewGuest",
      password: "very secure password",
      role: "admin",
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      data: { user: { username: "NewGuest", role: "user" } },
    });
    expect(response.headers.get("set-cookie")).toContain("geovibes_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");

    const [stored] = await db.select().from(users)
      .where(eq(users.normalizedUsername, "newguest"));
    expect(stored.role).toBe("user");
  });

  it("returns a token only for a request explicitly declaring the native client", async () => {
    const native = await post("sign-up", {
      username: "NativeGuest",
      password: "very secure password",
    }, { ...NATIVE_HEADER, origin: "" });
    expect(native.status).toBe(201);
    expect(await native.json()).toMatchObject({
      data: {
        user: { username: "NativeGuest", role: "user" },
        token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      },
    });
    expect(native.headers.get("set-cookie")).toBeNull();

    const web = await post("sign-in", {
      username: "NativeGuest",
      password: "very secure password",
    });
    expect((await web.json()).data.token).toBeUndefined();
  });

  it("uses the same generic error for an unknown user, wrong password, and suspension", async () => {
    const existing = await createExistingUser();
    const missing = await post("sign-in", {
      username: "missing",
      password: "wrong password",
    }, { "x-forwarded-for": "203.0.113.1" });
    const wrong = await post("sign-in", {
      username: "existing",
      password: "wrong password",
    }, { "x-forwarded-for": "203.0.113.2" });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, existing.id));
    const suspended = await post("sign-in", {
      username: "existing",
      password: "correct horse battery",
    }, { "x-forwarded-for": "203.0.113.3" });

    const [missingBody, wrongBody, suspendedBody] = await Promise.all([
      missing.json(), wrong.json(), suspended.json(),
    ]);
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(suspended.status).toBe(401);
    expect(missingBody.error).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password",
    });
    expect(wrongBody.error).toEqual(missingBody.error);
    expect(suspendedBody.error).toEqual(missingBody.error);
  });

  it("returns the current user, revokes sign-out, and clears the cookie", async () => {
    const signup = await post("sign-up", {
      username: "CookieGuest",
      password: "very secure password",
    });
    const cookie = cookieValue(signup);

    const me = await GET(new Request("http://localhost:3001/api/auth/me", {
      headers: { cookie },
    }), routeContext("me"));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      data: { user: { username: "CookieGuest", role: "user", status: "active" } },
    });

    const signout = await POST(new Request("http://localhost:3001/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: WEB_ORIGIN },
    }), routeContext("sign-out"));
    expect(signout.status).toBe(204);
    expect(signout.headers.get("set-cookie")).toContain("Max-Age=0");

    const after = await GET(new Request("http://localhost:3001/api/auth/me", {
      headers: { cookie },
    }), routeContext("me"));
    expect(after.status).toBe(401);
  });

  it("changes the password, revokes every session, and requires signing in again", async () => {
    const first = await post("sign-up", {
      username: "PasswordGuest",
      password: "first secure password",
    });
    const cookie = cookieValue(first);
    const second = await post("sign-in", {
      username: "PasswordGuest",
      password: "first secure password",
    }, { ...NATIVE_HEADER, origin: NATIVE_ORIGIN });
    const secondToken = (await second.json()).data.token as string;

    const changed = await POST(jsonRequest("change-password", {
      currentPassword: "first secure password",
      newPassword: "second secure password",
    }, { cookie }), routeContext("change-password"));
    expect(changed.status).toBe(204);
    expect(changed.headers.get("set-cookie")).toContain("Max-Age=0");

    const [user] = await db.select().from(users)
      .where(eq(users.normalizedUsername, "passwordguest"));
    const activeSessions = await db.select().from(sessions)
      .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    expect(activeSessions).toHaveLength(0);

    const oldPassword = await post("sign-in", {
      username: "PasswordGuest",
      password: "first secure password",
    }, { "x-forwarded-for": "203.0.113.4" });
    expect(oldPassword.status).toBe(401);
    const newPassword = await post("sign-in", {
      username: "PasswordGuest",
      password: "second secure password",
    }, { "x-forwarded-for": "203.0.113.5" });
    expect(newPassword.status).toBe(200);

    const revokedNative = await GET(new Request("http://localhost:3001/api/auth/me", {
      headers: { authorization: `Bearer ${secondToken}` },
    }), routeContext("me"));
    expect(revokedNative.status).toBe(401);
  });

  it("rejects a wrong current password without changing or revoking anything", async () => {
    const signup = await post("sign-up", {
      username: "UnchangedGuest",
      password: "first secure password",
    });
    const cookie = cookieValue(signup);

    const response = await POST(jsonRequest("change-password", {
      currentPassword: "incorrect password",
      newPassword: "second secure password",
    }, { cookie }), routeContext("change-password"));
    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatchObject({
      code: "INVALID_CREDENTIALS",
    });

    const me = await GET(new Request("http://localhost:3001/api/auth/me", {
      headers: { cookie },
    }), routeContext("me"));
    expect(me.status).toBe(200);
  });

  it("enforces PostgreSQL sign-in rate limits with identity and IP separation", async () => {
    await createExistingUser("limited");
    let response: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await post("sign-in", {
        username: "limited",
        password: "wrong password",
      }, { "x-forwarded-for": "198.51.100.10" });
    }
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toMatch(/^\d+$/);

    const otherIp = await post("sign-in", {
      username: "limited",
      password: "correct horse battery",
    }, { "x-forwarded-for": "198.51.100.11" });
    expect(otherIp.status).toBe(200);
  });

  it("rejects cookie-authenticated writes from missing or untrusted origins", async () => {
    const signup = await post("sign-up", {
      username: "CsrfGuest",
      password: "very secure password",
    });
    const cookie = cookieValue(signup);

    for (const origin of [undefined, "https://attacker.example"]) {
      const headers = new Headers({ cookie });
      if (origin) headers.set("origin", origin);
      const response = await POST(new Request(
        "http://localhost:3001/api/auth/sign-out",
        { method: "POST", headers },
      ), routeContext("sign-out"));
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("UNTRUSTED_ORIGIN");
    }

    for (const origin of [undefined, "https://attacker.example"]) {
      const headers = new Headers({ cookie });
      if (origin) headers.set("origin", origin);
      headers.set("content-type", "application/json");
      const response = await POST(new Request(
        "http://localhost:3001/api/auth/change-password",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            currentPassword: "very secure password",
            newPassword: "attacker changed password",
          }),
        },
      ), routeContext("change-password"));
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("UNTRUSTED_ORIGIN");
    }


    const me = await GET(new Request("http://localhost:3001/api/auth/me", {
      headers: { cookie },
    }), routeContext("me"));
    expect(me.status).toBe(200);
  });

  it("allows native bearer sign-out without a browser origin", async () => {
    const signup = await post("sign-up", {
      username: "BearerGuest",
      password: "very secure password",
    }, { ...NATIVE_HEADER, origin: NATIVE_ORIGIN });
    const token = (await signup.json()).data.token as string;

    const response = await POST(new Request("http://localhost:3001/api/auth/sign-out", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }), routeContext("sign-out"));
    expect(response.status).toBe(204);
  });

  it("returns stable error envelopes, exact CORS, and exact routes", async () => {
    const invalid = await post("sign-up", {
      username: "x",
      password: "short",
    });
    const body = await invalid.json();
    expect(invalid.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        message: "Request validation failed",
        fields: expect.any(Object),
      },
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });

    const preflight = await OPTIONS(new Request(
      "http://localhost:3001/api/auth/sign-in",
      {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:8081",
          "access-control-request-method": "POST",
        },
      },
    ), routeContext("sign-in"));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin"))
      .toBe("http://localhost:8081");
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");

    const attacker = await OPTIONS(new Request(
      "http://localhost:3001/api/auth/sign-in",
      { method: "OPTIONS", headers: { origin: "https://attacker.example" } },
    ), routeContext("sign-in"));
    expect(attacker.status).toBe(403);
    expect(attacker.headers.get("access-control-allow-origin")).toBeNull();

    const unknown = await POST(jsonRequest("unknown", {}), routeContext("unknown"));
    expect(unknown.status).toBe(404);
  });
});

afterAll(() => db.$client.end());
