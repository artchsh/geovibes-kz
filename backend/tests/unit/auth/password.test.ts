import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password helpers", () => {
  it("hashes and verifies without returning the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toContain("correct horse");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("counts Unicode code points for the minimum length", async () => {
    await expect(hashPassword("🙂".repeat(10))).resolves.toMatch(/^\$argon2id\$/);
    await expect(hashPassword("🙂".repeat(9))).rejects.toThrow();
  });

  it("rejects passwords longer than 256 UTF-8 bytes", async () => {
    await expect(hashPassword("a".repeat(257))).rejects.toThrow();
    await expect(hashPassword("🙂".repeat(65))).rejects.toThrow();
  });
});
