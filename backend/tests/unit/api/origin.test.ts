import { describe, expect, it } from "vitest";
import {
  assertTrustedWriteOrigin,
  corsHeadersForRequest,
} from "@/lib/api/origin";

describe("write origin policy", () => {
  it("accepts the configured admin origin", () => {
    const request = new Request("http://localhost:3001/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "http://localhost:3001" },
    });

    expect(() => assertTrustedWriteOrigin(request)).not.toThrow();
  });

  it("rejects an untrusted browser origin", () => {
    const request = new Request("http://localhost:3001/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    });

    expect(() => assertTrustedWriteOrigin(request)).toThrowError(
      expect.objectContaining({ code: "UNTRUSTED_ORIGIN", status: 403 }),
    );
  });

  it("rejects a cookie write with no origin", () => {
    const request = new Request("http://localhost:3001/api/auth/change-password", {
      method: "POST",
      headers: { cookie: "geovibes_session=secret" },
    });

    expect(() => assertTrustedWriteOrigin(request)).toThrowError(
      expect.objectContaining({ code: "UNTRUSTED_ORIGIN", status: 403 }),
    );
  });

  it("allows a native bearer request without an origin", () => {
    const request = new Request("http://localhost:3001/api/auth/sign-out", {
      method: "POST",
      headers: { authorization: `Bearer ${"a".repeat(43)}` },
    });

    expect(() => assertTrustedWriteOrigin(request)).not.toThrow();
  });

  it("does not let a malformed bearer value bypass browser origin checks", () => {
    const request = new Request("http://localhost:3001/api/auth/sign-in", {
      method: "POST",
      headers: { authorization: "Bearer not-a-session" },
    });

    expect(() => assertTrustedWriteOrigin(request)).toThrowError(
      expect.objectContaining({ code: "UNTRUSTED_ORIGIN", status: 403 }),
    );
  });

  it("adds credentialed CORS only for an exact configured Expo web origin", () => {
    const trusted = corsHeadersForRequest(new Request("http://localhost:3001", {
      headers: { origin: "http://localhost:8081" },
    }));
    expect(Object.fromEntries(trusted)).toMatchObject({
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": "http://localhost:8081",
    });

    const untrusted = corsHeadersForRequest(new Request("http://localhost:3001", {
      headers: { origin: "https://attacker.example" },
    }));
    expect(untrusted.has("access-control-allow-origin")).toBe(false);
  });
});
