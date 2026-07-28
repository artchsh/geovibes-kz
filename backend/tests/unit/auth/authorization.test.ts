import { describe, expect, it } from "vitest";
import { requireRole, type AuthenticatedUser } from "@/lib/auth/authorization";

function user(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    normalizedUsername: "almaty",
    displayUsername: "Almaty",
    role,
    status: "active",
    preferredLocale: "ru",
    onboardingCompletedAt: null,
    createdAt: new Date("2026-07-28T00:00:00.000Z"),
    updatedAt: new Date("2026-07-28T00:00:00.000Z"),
  };
}

describe("requireRole", () => {
  it("requires authentication", () => {
    expect(() => requireRole(null, "user")).toThrowError(
      expect.objectContaining({ code: "AUTH_REQUIRED", status: 401 }),
    );
  });

  it.each([
    ["user", "editor"],
    ["user", "admin"],
    ["editor", "admin"],
  ] as const)("rejects a %s below the %s minimum", (actual, minimum) => {
    expect(() => requireRole(user(actual), minimum)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
  });

  it.each([
    ["user", "user"],
    ["editor", "user"],
    ["editor", "editor"],
    ["admin", "editor"],
    ["admin", "admin"],
  ] as const)("allows a %s to satisfy a %s policy", (actual, minimum) => {
    const authenticated = user(actual);
    expect(requireRole(authenticated, minimum)).toBe(authenticated);
  });
});
