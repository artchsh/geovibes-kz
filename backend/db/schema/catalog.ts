import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { contentStatus, supportedLocale } from "./enums";
import { users } from "./users";

export const places = pgTable("places", {
  id: uuid("id").defaultRandom().primaryKey(),
  legacyId: varchar("legacy_id", { length: 32 }).unique(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  status: contentStatus("status").notNull().default("draft"),
  draftRevisionId: uuid("draft_revision_id"),
  publishedRevisionId: uuid("published_revision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const placeRevisions = pgTable("place_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  placeId: uuid("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  primaryLocale: supportedLocale("primary_locale"),
  address: text("address"),
  district: varchar("district", { length: 128 }),
  latitude: numeric("latitude", { precision: 9, scale: 6 }),
  longitude: numeric("longitude", { precision: 9, scale: 6 }),
  twoGisUrl: text("two_gis_url"),
  phone: varchar("phone", { length: 64 }),
  websiteUrl: text("website_url"),
  instagramUrl: text("instagram_url"),
  priceLevel: integer("price_level"),
  openingHours: jsonb("opening_hours").$type<Record<string, unknown>>(),
  editorialTags: text("editorial_tags").array().notNull().default(sql`ARRAY[]::text[]`),
  featuredRank: integer("featured_rank"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("place_revisions_place_number_unique").on(table.placeId, table.revisionNumber)]);

export const placeTranslations = pgTable("place_translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  placeRevisionId: uuid("place_revision_id").notNull().references(() => placeRevisions.id, { onDelete: "cascade" }),
  locale: supportedLocale("locale").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  tagline: text("tagline"),
  description: text("description"),
}, (table) => [unique("place_translations_revision_locale_unique").on(table.placeRevisionId, table.locale)]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  legacyId: varchar("legacy_id", { length: 32 }).unique(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  status: contentStatus("status").notNull().default("draft"),
  draftRevisionId: uuid("draft_revision_id"),
  publishedRevisionId: uuid("published_revision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const categoryRevisions = pgTable("category_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  primaryLocale: supportedLocale("primary_locale"),
  displayOrder: integer("display_order").notNull().default(0),
  coverMediaId: uuid("cover_media_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("category_revisions_category_number_unique").on(table.categoryId, table.revisionNumber)]);

export const categoryTranslations = pgTable("category_translations", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryRevisionId: uuid("category_revision_id").notNull().references(() => categoryRevisions.id, { onDelete: "cascade" }),
  locale: supportedLocale("locale").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  tagline: text("tagline"),
}, (table) => [unique("category_translations_revision_locale_unique").on(table.categoryRevisionId, table.locale)]);

export const placeRevisionCategories = pgTable("place_revision_categories", {
  placeRevisionId: uuid("place_revision_id").notNull().references(() => placeRevisions.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  unique("place_revision_categories_revision_category_unique").on(table.placeRevisionId, table.categoryId),
  unique("place_revision_categories_revision_sort_unique").on(table.placeRevisionId, table.sortOrder),
]);

export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  byteSize: integer("byte_size").notNull(),
  altText: text("alt_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const placeRevisionMedia = pgTable("place_revision_media", {
  placeRevisionId: uuid("place_revision_id").notNull().references(() => placeRevisions.id, { onDelete: "cascade" }),
  mediaId: uuid("media_id").notNull().references(() => media.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull(),
  isCover: boolean("is_cover").notNull().default(false),
}, (table) => [
  unique("place_revision_media_revision_media_unique").on(table.placeRevisionId, table.mediaId),
  unique("place_revision_media_revision_sort_unique").on(table.placeRevisionId, table.sortOrder),
  uniqueIndex("place_revision_media_one_cover_unique").on(table.placeRevisionId).where(sql`${table.isCover}`),
  index("place_revision_media_media_idx").on(table.mediaId),
]);
export const userInterests = pgTable("user_interests", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.categoryId] })]);

export const savedPlaces = pgTable("saved_places", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  placeId: uuid("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.placeId] })]);