import type { AuthenticatedUser } from "@/lib/auth/authorization";
import { readSession } from "@/lib/auth/session";
import { ApiError } from "./errors";

export const SESSION_COOKIE_NAME = "geovibes_session";
export const NATIVE_CLIENT_HEADER = "x-geovibes-client";

function parseCookie(request: Request, name: string): string | null {
  const source = request.headers.get("cookie");
  if (!source) return null;
  for (const part of source.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function isNativeClient(request: Request): boolean {
  return request.headers.get(NATIVE_CLIENT_HEADER) === "native";
}

export function readSessionToken(request: Request): {
  token: string | null;
  transport: "bearer" | "cookie" | null;
} {
  const authorization = request.headers.get("authorization");
  if (authorization && /^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) {
    const token = authorization.slice("Bearer ".length);
    return { token, transport: "bearer" };
  }
  const token = parseCookie(request, SESSION_COOKIE_NAME);
  return { token, transport: token ? "cookie" : null };
}

export async function readRequestSession(request: Request): Promise<{
  token: string | null;
  transport: "bearer" | "cookie" | null;
  user: AuthenticatedUser | null;
}> {
  const session = readSessionToken(request);
  return {
    ...session,
    user: session.token ? await readSession(session.token) : null,
  };
}

export async function requireRequestSession(request: Request): Promise<{
  token: string;
  transport: "bearer" | "cookie";
  user: AuthenticatedUser;
}> {
  const session = await readRequestSession(request);
  if (!session.token || !session.transport || !session.user) {
    throw new ApiError("AUTH_REQUIRED", 401, "Authentication required");
  }
  return session as {
    token: string;
    transport: "bearer" | "cookie";
    user: AuthenticatedUser;
  };
}

export function requestContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return {
    ipAddress: forwarded || realIp || null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      body: "Content-Type must be application/json",
    });
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      body: "Body must contain valid JSON",
    });
  }
}
