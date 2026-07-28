import { env } from "@/lib/env";
import { ApiError } from "./errors";

export function isTrustedOrigin(origin: string | null): boolean {
  return origin !== null
    && (origin === env.APP_ORIGIN || env.MOBILE_ORIGINS.includes(origin));
}

export function assertTrustedWriteOrigin(request: Request): void {
  const authorization = request.headers.get("authorization");
  if (authorization && /^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) return;

  if (!isTrustedOrigin(request.headers.get("origin"))) {
    throw new ApiError("UNTRUSTED_ORIGIN", 403, "Untrusted request origin");
  }
}

export function corsHeadersForRequest(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  if (origin !== null && env.MOBILE_ORIGINS.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-GeoVibes-Client");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Vary", "Origin");
  }
  return headers;
}
