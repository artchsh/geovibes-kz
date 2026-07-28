import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { supportedLocale, userRole, userStatus } from "./enums";

export { supportedLocale, userRole, userStatus } from "./enums";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  normalizedUsername: varchar("normalized_username", { length: 64 }).notNull().unique(),
  displayUsername: varchar("display_username", { length: 64 }).notNull(),
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  preferredLocale: supportedLocale("preferred_locale").notNull().default("ru"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});