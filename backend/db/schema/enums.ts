import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "editor", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);
export const contentStatus = pgEnum("content_status", ["draft", "published", "archived"]);
export const supportedLocale = pgEnum("supported_locale", ["ru", "kk", "en"]);