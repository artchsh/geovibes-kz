import { describe, expect, it } from "vitest";
import { normalizeUsername } from "@/lib/auth/username";

describe("normalizeUsername", () => {
  it("normalizes case and trims a valid username", () => {
    expect(normalizeUsername("  Geo.Vibes_01 ")).toBe("geo.vibes_01");
  });

  it.each(["ab", "has space", "кириллица", "admin"])(
    "rejects reserved or invalid username %s",
    (value) => expect(() => normalizeUsername(value)).toThrow(),
  );

  it.each(["api", "support", "geovibes", "root"])(
    "rejects reserved username %s after normalization",
    (value) => expect(() => normalizeUsername(` ${value.toUpperCase()} `)).toThrow(),
  );
});
