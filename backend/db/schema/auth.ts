import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const passwordCredentials = pgTable("password_credentials", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenDigest: varchar("token_digest", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  check("sessions_token_digest_lower_hex", sql`${table.tokenDigest} ~ '^[0-9a-f]{64}$'`),
]);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    keyDigest: varchar("key_digest", { length: 64 }).primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limit_expiry_idx").on(table.expiresAt)],
);