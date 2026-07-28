CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."supported_locale" AS ENUM('ru', 'kk', 'en');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "password_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key_digest" varchar(64) PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_digest" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_username" varchar(64) NOT NULL,
	"display_username" varchar(64) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"preferred_locale" "supported_locale" DEFAULT 'ru' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_normalized_username_unique" UNIQUE("normalized_username")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" varchar(32),
	"slug" varchar(128) NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"draft_revision_id" uuid,
	"published_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "categories_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"cover_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_revisions_category_number_unique" UNIQUE("category_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "category_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_revision_id" uuid NOT NULL,
	"locale" "supported_locale" NOT NULL,
	"name" varchar(128) NOT NULL,
	"tagline" text,
	CONSTRAINT "category_translations_revision_locale_unique" UNIQUE("category_revision_id","locale")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "place_revision_categories" (
	"place_revision_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "place_revision_categories_revision_category_unique" UNIQUE("place_revision_id","category_id"),
	CONSTRAINT "place_revision_categories_revision_sort_unique" UNIQUE("place_revision_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "place_revision_media" (
	"place_revision_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	CONSTRAINT "place_revision_media_revision_media_unique" UNIQUE("place_revision_id","media_id"),
	CONSTRAINT "place_revision_media_revision_sort_unique" UNIQUE("place_revision_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "place_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"address" text,
	"district" varchar(128),
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"two_gis_url" text,
	"phone" varchar(64),
	"website_url" text,
	"instagram_url" text,
	"price_level" integer,
	"opening_hours" jsonb,
	"editorial_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"featured_rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_revisions_place_number_unique" UNIQUE("place_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "place_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_revision_id" uuid NOT NULL,
	"locale" "supported_locale" NOT NULL,
	"name" varchar(256) NOT NULL,
	"tagline" text,
	"description" text,
	CONSTRAINT "place_translations_revision_locale_unique" UNIQUE("place_revision_id","locale")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" varchar(32),
	"slug" varchar(128) NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"draft_revision_id" uuid,
	"published_revision_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "places_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "saved_places" (
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_places_user_id_place_id_pk" PRIMARY KEY("user_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(128) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_revisions" ADD CONSTRAINT "category_revisions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_revision_id_category_revisions_id_fk" FOREIGN KEY ("category_revision_id") REFERENCES "public"."category_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_revision_categories" ADD CONSTRAINT "place_revision_categories_place_revision_id_place_revisions_id_fk" FOREIGN KEY ("place_revision_id") REFERENCES "public"."place_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_revision_categories" ADD CONSTRAINT "place_revision_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_revision_media" ADD CONSTRAINT "place_revision_media_place_revision_id_place_revisions_id_fk" FOREIGN KEY ("place_revision_id") REFERENCES "public"."place_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_revision_media" ADD CONSTRAINT "place_revision_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_revisions" ADD CONSTRAINT "place_revisions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_translations" ADD CONSTRAINT "place_translations_place_revision_id_place_revisions_id_fk" FOREIGN KEY ("place_revision_id") REFERENCES "public"."place_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_limit_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_user_expiry_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "place_revision_media_one_cover_unique" ON "place_revision_media" USING btree ("place_revision_id") WHERE "place_revision_media"."is_cover";--> statement-breakpoint
CREATE INDEX "place_revision_media_media_idx" ON "place_revision_media" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_draft_revision_id_place_revisions_id_fk" FOREIGN KEY ("draft_revision_id") REFERENCES "public"."place_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_published_revision_id_place_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."place_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_draft_revision_id_category_revisions_id_fk" FOREIGN KEY ("draft_revision_id") REFERENCES "public"."category_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_published_revision_id_category_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."category_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_revisions" ADD CONSTRAINT "category_revisions_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_metadata_bounded" CHECK (octet_length("metadata"::text) <= 4096);
