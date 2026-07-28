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
});
