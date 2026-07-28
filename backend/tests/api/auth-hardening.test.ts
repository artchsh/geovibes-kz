import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { passwordCredentials, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { POST } from "@/app/api/auth/[action]/route";
import { resetTestDatabase } from "@/tests/setup/database";

const WEB_ORIGIN = "http://localhost:3001";
const PROXY_SECRET = "test-trusted-proxy-secret-at-least-32-characters";

function routeContext(action: string) {
  return { params: Promise.resolve({ action }) };
}

function proxyHeaders(ipAddress: string): Record<string, string> {
  return {
    "x-forwarded-for": ipAddress,
    "x-geovibes-proxy-secret": PROXY_SECRET,
  };
}

function authRequest(
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
  return POST(authRequest(action, body, headers), routeContext(action));
}

async function createUser(username: string, password = "correct horse battery") {
  const [user] = await db.insert(users).values({
    normalizedUsername: username,
    displayUsername: username,
  }).returning();
  await db.insert(passwordCredentials).values({
    userId: user.id,
    passwordHash: await hashPassword(password),
  });
}

describe("public authentication request hardening", () => {
  beforeAll(async () => {
    await resetTestDatabase();
  });

  it("rejects an oversized declared signup body before reading it", async () => {
    const request = new Request("http://localhost:3001/api/auth/sign-up", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "8193",
        origin: WEB_ORIGIN,
      },
      body: "{}",
    });

    const response = await POST(request, routeContext("sign-up"));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" },
    });
  });

  it("cancels a streamed signin body as soon as it crosses the byte limit", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(5_000));
        controller.enqueue(new Uint8Array(4_000));
      },
      cancel() {
        cancelled = true;
        throw new Error("peer already closed");
      },
    });
    const request = new Request("http://localhost:3001/api/auth/sign-in", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: WEB_ORIGIN,
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request, routeContext("sign-in"));

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(cancelled).toBe(true);
  });

  it("ignores rotating forwarded IPs without trusted proxy proof", async () => {
    await createUser("spooflimited");
    let response: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      response = await post("sign-in", {
        username: "spooflimited",
        password: "wrong password",
      }, { "x-forwarded-for": `198.51.100.${attempt + 1}` });
    }

    expect(response?.status).toBe(429);
  });

  it("accepts forwarding identity only from the trusted proxy boundary", async () => {
    await createUser("trustedlimited");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await post("sign-in", {
        username: "trustedlimited",
        password: "wrong password",
      }, proxyHeaders("192.0.2.10"));
    }

    const otherAddress = await post("sign-in", {
      username: "trustedlimited",
      password: "correct horse battery",
    }, proxyHeaders("192.0.2.11"));
    expect(otherAddress.status).toBe(200);
  });

  it("rate-limits signup before expensive validation and hashing", async () => {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      response = await post("sign-up", {
        username: "admin",
        password: "very secure password",
      }, proxyHeaders("192.0.2.20"));
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toMatch(/^\d+$/);
  });

  it("maps concurrent duplicate signup to one success and one stable conflict", async () => {
    const requests = await Promise.all([
      post("sign-up", {
        username: "RaceGuest",
        password: "very secure password",
      }, proxyHeaders("192.0.2.30")),
      post("sign-up", {
        username: "RaceGuest",
        password: "very secure password",
      }, proxyHeaders("192.0.2.30")),
    ]);

    expect(requests.map((response) => response.status).sort()).toEqual([201, 409]);
    const conflict = requests.find((response) => response.status === 409);
    expect(conflict).toBeDefined();
    expect((await conflict!.json()).error).toEqual({
      code: "USERNAME_UNAVAILABLE",
      message: "Username is unavailable",
    });
  });
});

afterAll(() => db.$client.end());
