import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { corsHeadersForRequest } from "./origin";
import { normalizeApiError } from "./errors";
import { SESSION_COOKIE_NAME } from "./request";

function withBaseHeaders(request: Request, headers?: HeadersInit): Headers {
  const result = corsHeadersForRequest(request);
  new Headers(headers).forEach((value, key) => result.set(key, value));
  return result;
}

export function dataResponse(
  request: Request,
  data: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(
    { data, requestId: randomUUID() },
    { status, headers: withBaseHeaders(request, headers) },
  );
}

export function emptyResponse(
  request: Request,
  status = 204,
  headers?: HeadersInit,
): Response {
  return new Response(null, {
    status,
    headers: withBaseHeaders(request, headers),
  });
}

export function errorResponse(request: Request, error: unknown): Response {
  const apiError = normalizeApiError(error);
  const body = {
    error: {
      code: apiError.code,
      message: apiError.clientMessage,
      ...(apiError.fields ? { fields: apiError.fields } : {}),
    },
    requestId: randomUUID(),
  };
  return Response.json(body, {
    status: apiError.status,
    headers: withBaseHeaders(request, apiError.responseHeaders),
  });
}

export function sessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${env.SESSION_TTL_DAYS * 86_400}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearedSessionCookie(): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
