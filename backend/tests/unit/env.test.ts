import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("rejects a short auth secret", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/geovibes",
        AUTH_SECRET: "short",
        APP_ORIGIN: "http://localhost:3001",
        MOBILE_ORIGINS: "geovibes://,http://localhost:8081",
        SESSION_TTL_DAYS: "30",
        MEDIA_ROOT: "./storage",
        MAX_UPLOAD_BYTES: "10485760",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("parses exact mobile origins and rejects wildcard CORS configuration", () => {
    const base = {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/geovibes",
      AUTH_SECRET: "development-only-auth-secret-with-at-least-32-characters",
      APP_ORIGIN: "http://localhost:3001",
      SESSION_TTL_DAYS: "30",
      MEDIA_ROOT: "./storage",
      MAX_UPLOAD_BYTES: "10485760",
    };

    expect(parseEnv({
      ...base,
      MOBILE_ORIGINS: "geovibes://, http://localhost:8081",
    }).MOBILE_ORIGINS).toEqual(["geovibes://", "http://localhost:8081"]);
    expect(() => parseEnv({ ...base, MOBILE_ORIGINS: "*" }))
      .toThrow(/MOBILE_ORIGINS/);
  });

  it("allows an omitted trusted proxy secret and rejects a short one", () => {
    const base = {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/geovibes",
      AUTH_SECRET: "development-only-auth-secret-with-at-least-32-characters",
      APP_ORIGIN: "http://localhost:3001",
      MOBILE_ORIGINS: "http://localhost:8081",
    };

    expect(parseEnv(base).TRUSTED_PROXY_SECRET).toBeUndefined();
    expect(() => parseEnv({ ...base, TRUSTED_PROXY_SECRET: "too-short" }))
      .toThrow(/TRUSTED_PROXY_SECRET/);
  });
});
