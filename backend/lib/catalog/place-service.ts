import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditEvents,
  categories,
  media,
  placeRevisionCategories,
  placeRevisionMedia,
  placeRevisions,
  places,
  placeTranslations,
} from "@/db/schema";
import {
  requireRole,
  type AuthenticatedUser,
} from "@/lib/auth/authorization";
import {
  catalogTransaction,
  requireReferenceUuid,
  requireTargetUuid,
} from "@/lib/catalog/errors";
import {
  publicationWarnings,
  safeAuditMetadata,
  validateCoordinates,
  validatePublicationTranslations,
  type PublishOptions,
  type PublishResult,
  type TranslationMap,
} from "@/lib/catalog/publication";
import type { SupportedLocale } from "@/lib/catalog/translation";
import { AppError } from "@/lib/result";

export type PlaceTranslationInput = {
  name: string;
  tagline?: string | null;
  description?: string | null;
};

export type PlaceMediaInput = {
  mediaId: string;
  sortOrder: number;
  isCover: boolean;
};

export type CreatePlaceDraftInput = {
  slug: string;
  legacyId?: string | null;
  primaryLocale: SupportedLocale | null;
  translations: TranslationMap<PlaceTranslationInput>;
  address?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  twoGisUrl?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  priceLevel?: number | null;
  openingHours?: Record<string, unknown> | null;
  editorialTags?: string[];
  featuredRank?: number | null;
  categoryIds: string[];
  media: PlaceMediaInput[];
};

export type UpdatePlaceDraftInput = Partial<Omit<
  CreatePlaceDraftInput,
  "legacyId"
>> & {
  legacyId?: string | null;
};

export type PlaceDraftResult = {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  draftRevisionId: string;
};

type PlaceRevisionInsert = typeof placeRevisions.$inferInsert;

function normalizeSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length > 128) {
    throw new AppError("INVALID_SLUG", 422);
  }
  return normalized;
}

function numeric(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

function translationEntries(
  translations: TranslationMap<PlaceTranslationInput>,
): Array<{ locale: SupportedLocale; value: PlaceTranslationInput }> {
  return (Object.entries(translations) as Array<
    [SupportedLocale, PlaceTranslationInput | null | undefined]
  >).flatMap(([locale, value]) => {
    if (!value) return [];
    const name = value.name.trim();
    if (!name) throw new AppError("INVALID_TRANSLATION", 422);
    return [{ locale, value: { ...value, name } }];
  });
}

async function insertTranslations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  revisionId: string,
  translations: TranslationMap<PlaceTranslationInput>,
): Promise<void> {
  const rows = translationEntries(translations).map(({ locale, value }) => ({
    placeRevisionId: revisionId,
    locale,
    name: value.name,
    tagline: value.tagline ?? null,
    description: value.description ?? null,
  }));
  if (rows.length > 0) await tx.insert(placeTranslations).values(rows);
}

async function replaceAssignments(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  revisionId: string,
  categoryIds: readonly string[],
): Promise<void> {
  await tx.delete(placeRevisionCategories)
    .where(eq(placeRevisionCategories.placeRevisionId, revisionId));
  if (categoryIds.length > 0) {
    await tx.insert(placeRevisionCategories).values(
      categoryIds.map((categoryId, sortOrder) => ({
        placeRevisionId: revisionId,
        categoryId,
        sortOrder,
      })),
    );
  }
}

async function replaceMedia(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  revisionId: string,
  assignments: readonly PlaceMediaInput[],
): Promise<void> {
  await tx.delete(placeRevisionMedia)
    .where(eq(placeRevisionMedia.placeRevisionId, revisionId));
  if (assignments.length > 0) {
    await tx.insert(placeRevisionMedia).values(
      assignments.map((assignment) => ({
        placeRevisionId: revisionId,
        mediaId: assignment.mediaId,
        sortOrder: assignment.sortOrder,
        isCover: assignment.isCover,
      })),
    );
  }
}

type CatalogTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function validateCategoryAssignments(
  tx: CatalogTransaction,
  categoryIds: readonly string[],
): Promise<void> {
  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new AppError("DUPLICATE_CATEGORY_ASSIGNMENT", 422);
  }
  for (const categoryId of categoryIds) {
    requireReferenceUuid(categoryId, "CATEGORY_REFERENCE_INVALID");
  }
  if (categoryIds.length === 0) return;

  const referenced = await tx.select({
    id: categories.id,
    status: categories.status,
  }).from(categories).where(inArray(categories.id, [...categoryIds])).for("share");
  if (referenced.length !== categoryIds.length) {
    throw new AppError("CATEGORY_REFERENCE_INVALID", 422);
  }
  if (referenced.some((category) => category.status === "archived")) {
    throw new AppError("ARCHIVED_CATEGORY_REFERENCED", 422);
  }
}

async function validateMediaAssignments(
  tx: CatalogTransaction,
  assignments: readonly PlaceMediaInput[],
): Promise<void> {
  const mediaIds = assignments.map((assignment) => assignment.mediaId);
  if (new Set(mediaIds).size !== mediaIds.length) {
    throw new AppError("DUPLICATE_MEDIA_ASSIGNMENT", 422);
  }
  const sortOrders = assignments.map((assignment) => assignment.sortOrder);
  if (new Set(sortOrders).size !== sortOrders.length) {
    throw new AppError("DUPLICATE_MEDIA_SORT_ORDER", 422);
  }
  if (sortOrders.some((order) => !Number.isInteger(order) || order < 0)) {
    throw new AppError("INVALID_MEDIA_SORT_ORDER", 422);
  }
  if (assignments.filter((assignment) => assignment.isCover).length > 1) {
    throw new AppError("MULTIPLE_COVER_MEDIA", 422);
  }
  for (const mediaId of mediaIds) {
    requireReferenceUuid(mediaId, "MEDIA_REFERENCE_INVALID");
  }
  if (mediaIds.length === 0) return;

  const referenced = await tx.select({ id: media.id }).from(media).where(and(
    inArray(media.id, mediaIds),
    isNull(media.deletedAt),
  )).for("share");
  if (referenced.length !== mediaIds.length) {
    throw new AppError("MEDIA_REFERENCE_INVALID", 422);
  }
}

export async function createPlaceDraft(
  actor: AuthenticatedUser | null,
  input: CreatePlaceDraftInput,
): Promise<PlaceDraftResult> {
  const authorized = requireRole(actor, "editor");
  const slug = normalizeSlug(input.slug);

  return catalogTransaction(() => db.transaction(async (tx) => {
    await validateCategoryAssignments(tx, input.categoryIds);
    await validateMediaAssignments(tx, input.media);
    const [identity] = await tx.insert(places).values({
      slug,
      legacyId: input.legacyId ?? null,
    }).returning();
    const [revision] = await tx.insert(placeRevisions).values({
      placeId: identity.id,
      revisionNumber: 1,
      primaryLocale: input.primaryLocale,
      address: input.address ?? null,
      district: input.district ?? null,
      latitude: numeric(input.latitude),
      longitude: numeric(input.longitude),
      twoGisUrl: input.twoGisUrl ?? null,
      phone: input.phone ?? null,
      websiteUrl: input.websiteUrl ?? null,
      instagramUrl: input.instagramUrl ?? null,
      priceLevel: input.priceLevel ?? null,
      openingHours: input.openingHours ?? null,
      editorialTags: input.editorialTags ?? [],
      featuredRank: input.featuredRank ?? null,
    }).returning();

    await insertTranslations(tx, revision.id, input.translations);
    await replaceAssignments(tx, revision.id, input.categoryIds);
    await replaceMedia(tx, revision.id, input.media);
    await tx.update(places).set({
      draftRevisionId: revision.id,
      updatedAt: new Date(),
    }).where(eq(places.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "place.created",
      targetType: "place",
      targetId: identity.id,
      metadata: safeAuditMetadata({ revisionNumber: 1, status: "draft" }),
    });

    return {
      id: identity.id,
      slug: identity.slug,
      status: "draft",
      draftRevisionId: revision.id,
    };
  }));
}

export async function updatePlaceDraft(
  actor: AuthenticatedUser | null,
  placeId: string,
  input: UpdatePlaceDraftInput,
): Promise<PlaceDraftResult> {
  const authorized = requireRole(actor, "editor");

  requireTargetUuid(placeId, "PLACE_NOT_FOUND");
  return catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(places)
      .where(eq(places.id, placeId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("PLACE_NOT_FOUND", 404);
    if (identity.publishedRevisionId) {
      const slugChanged = input.slug !== undefined
        && normalizeSlug(input.slug) !== identity.slug;
      const legacyIdChanged = input.legacyId !== undefined
        && input.legacyId !== identity.legacyId;
      if (slugChanged || legacyIdChanged) {
        throw new AppError("PUBLISHED_IDENTITY_IMMUTABLE", 409);
      }
    }
    if (identity.status === "archived") throw new AppError("CONTENT_ARCHIVED", 409);
    if (identity.draftRevisionId === identity.publishedRevisionId) {
      throw new AppError("IMMUTABLE_PUBLISHED_REVISION", 409);
    }

    const [revision] = await tx.select().from(placeRevisions)
      .where(and(
        eq(placeRevisions.id, identity.draftRevisionId),
        eq(placeRevisions.placeId, identity.id),
      ));
    if (!revision) throw new AppError("PLACE_DRAFT_NOT_FOUND", 409);

    const patch: Partial<PlaceRevisionInsert> = { updatedAt: new Date() };
    if (input.categoryIds) await validateCategoryAssignments(tx, input.categoryIds);
    if (input.media) await validateMediaAssignments(tx, input.media);
    if ("primaryLocale" in input) patch.primaryLocale = input.primaryLocale;
    if ("address" in input) patch.address = input.address;
    if ("district" in input) patch.district = input.district;
    if ("latitude" in input) patch.latitude = numeric(input.latitude);
    if ("longitude" in input) patch.longitude = numeric(input.longitude);
    if ("twoGisUrl" in input) patch.twoGisUrl = input.twoGisUrl;
    if ("phone" in input) patch.phone = input.phone;
    if ("websiteUrl" in input) patch.websiteUrl = input.websiteUrl;
    if ("instagramUrl" in input) patch.instagramUrl = input.instagramUrl;
    if ("priceLevel" in input) patch.priceLevel = input.priceLevel;
    if ("openingHours" in input) patch.openingHours = input.openingHours;
    if ("editorialTags" in input) patch.editorialTags = input.editorialTags;
    if ("featuredRank" in input) patch.featuredRank = input.featuredRank;
    await tx.update(placeRevisions).set(patch)
      .where(eq(placeRevisions.id, revision.id));

    if (input.translations) {
      await tx.delete(placeTranslations)
        .where(eq(placeTranslations.placeRevisionId, revision.id));
      await insertTranslations(tx, revision.id, input.translations);
    }
    if (input.categoryIds) await replaceAssignments(tx, revision.id, input.categoryIds);
    if (input.media) await replaceMedia(tx, revision.id, input.media);

    const identityPatch: Partial<typeof places.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) identityPatch.slug = normalizeSlug(input.slug);
    if (input.legacyId !== undefined) identityPatch.legacyId = input.legacyId;
    await tx.update(places).set(identityPatch).where(eq(places.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "place.updated",
      targetType: "place",
      targetId: identity.id,
      metadata: safeAuditMetadata({
        revisionNumber: revision.revisionNumber,
        status: identity.status,
      }),
    });

    return {
      id: identity.id,
      slug: identityPatch.slug ?? identity.slug,
      status: identity.status,
      draftRevisionId: revision.id,
    };
  }));
}

export async function publishPlace(
  actor: AuthenticatedUser | null,
  placeId: string,
  options: PublishOptions,
): Promise<PublishResult> {
  const authorized = requireRole(actor, "editor");

  requireTargetUuid(placeId, "PLACE_NOT_FOUND");
  return catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(places)
      .where(eq(places.id, placeId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("PLACE_NOT_FOUND", 404);
    if (options.expectedDraftRevisionId
      && options.expectedDraftRevisionId !== identity.draftRevisionId) {
      throw new AppError("STALE_DRAFT_REVISION", 409);
    }
    if (identity.status === "archived") throw new AppError("CONTENT_ARCHIVED", 409);
    if (identity.draftRevisionId === identity.publishedRevisionId) {
      throw new AppError("IMMUTABLE_PUBLISHED_REVISION", 409);
    }

    const [revision] = await tx.select().from(placeRevisions)
      .where(and(
        eq(placeRevisions.id, identity.draftRevisionId),
        eq(placeRevisions.placeId, identity.id),
      ));
    if (!revision) throw new AppError("PLACE_DRAFT_NOT_FOUND", 409);

    const translations = await tx.select().from(placeTranslations)
      .where(eq(placeTranslations.placeRevisionId, revision.id));
    const locales = translations.map((translation) => translation.locale);
    validatePublicationTranslations(locales, revision.primaryLocale);
    const warnings = publicationWarnings(locales, options);
    validateCoordinates(revision.latitude, revision.longitude);

    const categoryAssignments = await tx.select().from(placeRevisionCategories)
      .where(eq(placeRevisionCategories.placeRevisionId, revision.id));
    if (categoryAssignments.length === 0) {
      throw new AppError("PLACE_CATEGORY_REQUIRED", 422);
    }
    const referencedCategories = await tx.select({
      id: categories.id,
      status: categories.status,
    }).from(categories).where(inArray(
      categories.id,
      categoryAssignments.map((assignment) => assignment.categoryId),
    )).for("share");
    if (referencedCategories.length !== categoryAssignments.length) {
      throw new AppError("CATEGORY_REFERENCE_INVALID", 422);
    }
    if (referencedCategories.some((category) => category.status === "archived")) {
      throw new AppError("ARCHIVED_CATEGORY_REFERENCED", 422);
    }

    const mediaAssignments = await tx.select({
      mediaId: placeRevisionMedia.mediaId,
      sortOrder: placeRevisionMedia.sortOrder,
      isCover: placeRevisionMedia.isCover,
      deletedAt: media.deletedAt,
    }).from(placeRevisionMedia).leftJoin(
      media,
      eq(placeRevisionMedia.mediaId, media.id),
    ).where(eq(placeRevisionMedia.placeRevisionId, revision.id));
    const validCovers = mediaAssignments.filter(
      (assignment) => assignment.isCover && assignment.deletedAt === null,
    );
    if (validCovers.length !== 1) {
      throw new AppError("PLACE_COVER_REQUIRED", 422);
    }

    const nextRevisionNumber = revision.revisionNumber + 1;
    const [nextDraft] = await tx.insert(placeRevisions).values({
      placeId: identity.id,
      revisionNumber: nextRevisionNumber,
      primaryLocale: revision.primaryLocale,
      address: revision.address,
      district: revision.district,
      latitude: revision.latitude,
      longitude: revision.longitude,
      twoGisUrl: revision.twoGisUrl,
      phone: revision.phone,
      websiteUrl: revision.websiteUrl,
      instagramUrl: revision.instagramUrl,
      priceLevel: revision.priceLevel,
      openingHours: revision.openingHours,
      editorialTags: revision.editorialTags,
      featuredRank: revision.featuredRank,
    }).returning();
    if (translations.length > 0) {
      await tx.insert(placeTranslations).values(translations.map((translation) => ({
        placeRevisionId: nextDraft.id,
        locale: translation.locale,
        name: translation.name,
        tagline: translation.tagline,
        description: translation.description,
      })));
    }
    await replaceAssignments(
      tx,
      nextDraft.id,
      categoryAssignments
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((assignment) => assignment.categoryId),
    );
    await replaceMedia(tx, nextDraft.id, mediaAssignments.map((assignment) => ({
      mediaId: assignment.mediaId,
      sortOrder: assignment.sortOrder,
      isCover: assignment.isCover,
    })));

    const now = new Date();
    await tx.update(places).set({
      status: "published",
      publishedRevisionId: revision.id,
      draftRevisionId: nextDraft.id,
      publishedAt: now,
      archivedAt: null,
      updatedAt: now,
    }).where(eq(places.id, identity.id));
    const previousPublished = identity.publishedRevisionId
      ? await tx.select({ revisionNumber: placeRevisions.revisionNumber })
        .from(placeRevisions)
        .where(eq(placeRevisions.id, identity.publishedRevisionId))
      : [];
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "place.published",
      targetType: "place",
      targetId: identity.id,
      metadata: safeAuditMetadata({
        revisionNumber: revision.revisionNumber,
        previousPublishedRevisionNumber: previousPublished[0]?.revisionNumber ?? null,
        status: "published",
      }),
    });

    return {
      id: identity.id,
      status: "published",
      publishedRevisionId: revision.id,
      draftRevisionId: nextDraft.id,
      warnings,
    };
  }));
}

export async function archivePlace(
  actor: AuthenticatedUser | null,
  placeId: string,
): Promise<void> {
  const authorized = requireRole(actor, "editor");
  requireTargetUuid(placeId, "PLACE_NOT_FOUND");
  await catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(places)
      .where(eq(places.id, placeId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("PLACE_NOT_FOUND", 404);
    if (identity.status === "archived") throw new AppError("CONTENT_ALREADY_ARCHIVED", 409);
    const [revision] = await tx.select({ revisionNumber: placeRevisions.revisionNumber })
      .from(placeRevisions).where(eq(placeRevisions.id, identity.draftRevisionId));
    const now = new Date();
    await tx.update(places).set({
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    }).where(eq(places.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "place.archived",
      targetType: "place",
      targetId: identity.id,
      metadata: safeAuditMetadata({
        revisionNumber: revision?.revisionNumber ?? null,
        status: "archived",
      }),
    });
  }));
}

export async function restorePlace(
  actor: AuthenticatedUser | null,
  placeId: string,
): Promise<void> {
  const authorized = requireRole(actor, "editor");
  requireTargetUuid(placeId, "PLACE_NOT_FOUND");
  await catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(places)
      .where(eq(places.id, placeId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("PLACE_NOT_FOUND", 404);
    if (identity.status !== "archived") throw new AppError("CONTENT_NOT_ARCHIVED", 409);
    const [revision] = await tx.select({ revisionNumber: placeRevisions.revisionNumber })
      .from(placeRevisions).where(eq(placeRevisions.id, identity.draftRevisionId));
    await tx.update(places).set({
      status: "draft",
      archivedAt: null,
      updatedAt: new Date(),
    }).where(eq(places.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "place.restored",
      targetType: "place",
      targetId: identity.id,
      metadata: safeAuditMetadata({
        revisionNumber: revision?.revisionNumber ?? null,
        status: "draft",
      }),
    });
  }));
}
