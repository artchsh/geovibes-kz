import { describe, expect, it } from "vitest";
import { selectTranslation } from "@/lib/catalog/translation";

describe("selectTranslation", () => {
  it("returns the requested human-authored locale when available", () => {
    expect(selectTranslation(
      [{ locale: "ru", value: "Бар" }, { locale: "kk", value: "Бар kk" }],
      "kk",
      "ru",
    )).toEqual({ locale: "kk", value: "Бар kk" });
  });

  it("returns the primary human-authored locale when requested text is absent", () => {
    expect(selectTranslation(
      [{ locale: "ru", value: "Бар" }, { locale: "en", value: "Bar" }],
      "kk",
      "en",
    )).toEqual({ locale: "en", value: "Bar" });
  });

  it("uses ru, kk, en fixed order only when primary locale is invalid", () => {
    expect(selectTranslation(
      [{ locale: "en", value: "Bar" }, { locale: "ru", value: "Бар" }],
      "kk",
      null,
    )).toEqual({ locale: "ru", value: "Бар" });
  });

  it("falls back in fixed order when the primary locale is not present", () => {
    expect(selectTranslation(
      [{ locale: "en", value: "Bar" }, { locale: "kk", value: "Бар kk" }],
      "ru",
      "ru",
    )).toEqual({ locale: "kk", value: "Бар kk" });
  });

  it("raises only when there are no human-authored translations", () => {
    expect(() => selectTranslation([], "kk", "ru")).toThrow(
      expect.objectContaining({ code: "CONTENT_HAS_NO_TRANSLATION" }),
    );
  });
});
