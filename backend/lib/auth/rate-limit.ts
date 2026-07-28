import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitBuckets } from "@/db/schema";
import { env } from "@/lib/env";

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

function digestKey(key: string): string {
  return createHash("sha256").update(key + env.AUTH_SECRET).digest("hex");
}

function assertValidRule(key: string, rule: RateLimitRule): void {
  if (
    key.length === 0
    || !Number.isSafeInteger(rule.limit)
    || rule.limit < 1
    || !Number.isSafeInteger(rule.windowSeconds)
    || rule.windowSeconds < 1
  ) {
    throw new Error("Rate-limit keys must be non-empty and rules must use positive integers");
  }
}

export function createRateLimiter(database: typeof db = db): RateLimiter {
  return {
    async consumeRateLimit(key, rule) {
      assertValidRule(key, rule);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + rule.windowSeconds * 1_000);
      const [bucket] = await database.insert(rateLimitBuckets).values({
        keyDigest: digestKey(key),
        windowStartedAt: now,
        attempts: 1,
        expiresAt,
      }).onConflictDoUpdate({
        target: rateLimitBuckets.keyDigest,
        set: {
          windowStartedAt: sql`
            case
              when ${rateLimitBuckets.expiresAt} <= ${now} then ${now}
              else ${rateLimitBuckets.windowStartedAt}
            end
          `,
          attempts: sql`
            case
              when ${rateLimitBuckets.expiresAt} <= ${now} then 1
              else ${rateLimitBuckets.attempts} + 1
            end
          `,
          expiresAt: sql`
            case
              when ${rateLimitBuckets.expiresAt} <= ${now} then ${expiresAt}
              else ${rateLimitBuckets.expiresAt}
            end
          `,
        },
      }).returning({
        attempts: rateLimitBuckets.attempts,
        expiresAt: rateLimitBuckets.expiresAt,
      });

      const allowed = bucket.attempts <= rule.limit;
      return {
        allowed,
        retryAfterSeconds: allowed
          ? 0
          : Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1_000)),
      };
    },
  };
}

const defaultRateLimiter = createRateLimiter();

export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  return defaultRateLimiter.consumeRateLimit(key, rule);
}
