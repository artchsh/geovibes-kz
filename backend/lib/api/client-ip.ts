import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { env } from "@/lib/env";

export const TRUSTED_PROXY_HEADER = "x-geovibes-proxy-secret";

function secretsMatch(presented: string | null, expected: string | undefined): boolean {
  if (!presented || !expected) return false;
  const presentedDigest = createHash("sha256").update(presented).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(presentedDigest, expectedDigest);
}

export function trustedClientIp(
  headers: Headers,
  trustedProxySecret: string | undefined = env.TRUSTED_PROXY_SECRET,
): string | null {
  if (!secretsMatch(headers.get(TRUSTED_PROXY_HEADER), trustedProxySecret)) {
    return null;
  }

  const candidates = [
    headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    headers.get("x-real-ip")?.trim(),
  ];
  return candidates.find((candidate) =>
    candidate !== undefined && isIP(candidate) !== 0) ?? null;
}
