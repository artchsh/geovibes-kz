import { describe, expect, it } from "vitest";
import {
  isNativeClient,
  requestContext,
  trustedClientIp,
} from "@/lib/api/request";

const PROXY_SECRET = "test-trusted-proxy-secret-at-least-32-characters";

describe("request trust boundaries", () => {
  it("ignores client-supplied forwarding headers without the proxy secret", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10",
      "x-real-ip": "203.0.113.11",
    });

    expect(trustedClientIp(headers, undefined)).toBeNull();
    expect(requestContext(new Request("http://localhost", { headers })).ipAddress)
      .toBeNull();
  });

  it("ignores forwarding headers with a wrong companion secret", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10",
      "x-geovibes-proxy-secret": "wrong-secret",
    });

    expect(trustedClientIp(headers, PROXY_SECRET)).toBeNull();
  });

  it("accepts a valid forwarded IP only across the configured trusted boundary", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.2",
      "x-geovibes-proxy-secret": PROXY_SECRET,
    });

    expect(trustedClientIp(headers, PROXY_SECRET)).toBe("203.0.113.10");
  });

  it("uses the stable unknown fallback when no network identity is available", () => {
    expect(trustedClientIp(new Headers(), PROXY_SECRET)).toBeNull();
    expect(requestContext(new Request("http://localhost")).ipAddress).toBeNull();
  });

  it("recognizes only the literal Expo native client contract", () => {
    expect(isNativeClient(new Request("http://localhost", {
      headers: { "x-geovibes-client": "expo-native" },
    }))).toBe(true);
    expect(isNativeClient(new Request("http://localhost", {
      headers: { "x-geovibes-client": "native" },
    }))).toBe(false);
  });
});
