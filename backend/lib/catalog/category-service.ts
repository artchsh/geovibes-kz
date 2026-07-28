import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditEvents,
  categories,
  categoryRevisions,
  categoryTranslations,
  media,
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
  validatePublicationTranslations,
  type PublishOptions,
  type PublishResult,
  type TranslationMap,
} from "@/lib/catalog/publication";
import type { SupportedLocale } from "@/lib/catalog/translation";
import { AppError } from "@/lib/result";

export type CategoryTranslationInput = {
  name: string;
  tagline?: string | null;
};

export type CreateCategoryDraftInput = {
  slug: string;
  legacyId?: string | null;
  primaryLocale: SupportedLocale | null;
  translations: TranslationMap<CategoryTranslationInput>;
  displayOrder: number;
  coverMediaId: string | null;
};

export type UpdateCategoryDraftInput = Partial<CreateCategoryDraftInput>;

export type CategoryDraftResult = {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  draftRevisionId: string;
};

type CategoryRevisionInsert = typeof categoryRevisions.$inferInsert;

function normalizeSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) || normalized.length > 128) {
    throw new AppError("INVALID_SLUG", 422);
  }
  return normalized;
}

function translationEntries(
  translations: TranslationMap<CategoryTranslationInput>,
): Array<{ locale: SupportedLocale; value: CategoryTranslationInput }> {
  return (Object.entries(translations) as Array<
    [SupportedLocale, CategoryTranslationInput | null | undefined]
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
  translations: TranslationMap<CategoryTranslationInput>,
): Promise<void> {
  const rows = translationEntries(translations).map(({ locale, value }) => ({
    categoryRevisionId: revisionId,
    locale,
    name: value.name,
    tagline: value.tagline ?? null,
  }));
  if (rows.length > 0) await tx.insert(categoryTranslations).values(rows);
}

type CatalogTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function validateCoverMedia(
  tx: CatalogTransaction,
  mediaId: string | null,
): Promise<void> {
  if (mediaId === null) return;
  requireReferenceUuid(mediaId, "MEDIA_REFERENCE_INVALID");
  const referenced = await tx.select({ id: media.id }).from(media).where(and(
    eq(media.id, mediaId),
    isNull(media.deletedAt),
  )).for("share");
  if (referenced.length !== 1) {
    throw new AppError("MEDIA_REFERENCE_INVALID", 422);
  }
}

export async function createCategoryDraft(
  actor: AuthenticatedUser | null,
  input: CreateCategoryDraftInput,
): Promise<CategoryDraftResult> {
  const authorized = requireRole(actor, "editor");
  const slug = normalizeSlug(input.slug);

  return catalogTransaction(() => db.transaction(async (tx) => {
    await validateCoverMedia(tx, input.coverMediaId);
    const [identity] = await tx.insert(categories).values({
      slug,
      legacyId: input.legacyId ?? null,
    }).returning();
    const [revision] = await tx.insert(categoryRevisions).values({
      categoryId: identity.id,
      revisionNumber: 1,
      primaryLocale: input.primaryLocale,
      displayOrder: input.displayOrder,
      coverMediaId: input.coverMediaId,
    }).returning();
    await insertTranslations(tx, revision.id, input.translations);
    await tx.update(categories).set({
      draftRevisionId: revision.id,
      updatedAt: new Date(),
    }).where(eq(categories.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "category.created",
      targetType: "category",
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

export async function updateCategoryDraft(
  actor: AuthenticatedUser | null,
  categoryId: string,
  input: UpdateCategoryDraftInput,
): Promise<CategoryDraftResult> {
  const authorized = requireRole(actor, "editor");

  requireTargetUuid(categoryId, "CATEGORY_NOT_FOUND");
  return catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(categories)
      .where(eq(categories.id, categoryId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("CATEGORY_NOT_FOUND", 404);
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
    const [revision] = await tx.select().from(categoryRevisions)
      .where(and(
        eq(categoryRevisions.id, identity.draftRevisionId),
        eq(categoryRevisions.categoryId, identity.id),
      ));
    if (!revision) throw new AppError("CATEGORY_DRAFT_NOT_FOUND", 409);

    const patch: Partial<CategoryRevisionInsert> = { updatedAt: new Date() };
    if (input.coverMediaId !== undefined) {
      await validateCoverMedia(tx, input.coverMediaId);
    }
    if ("primaryLocale" in input) patch.primaryLocale = input.primaryLocale;
    if ("displayOrder" in input) patch.displayOrder = input.displayOrder;
    if ("coverMediaId" in input) patch.coverMediaId = input.coverMediaId;
    await tx.update(categoryRevisions).set(patch)
      .where(eq(categoryRevisions.id, revision.id));
    if (input.translations) {
      await tx.delete(categoryTranslations)
        .where(eq(categoryTranslations.categoryRevisionId, revision.id));
      await insertTranslations(tx, revision.id, input.translations);
    }

    const identityPatch: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.slug !== undefined) identityPatch.slug = normalizeSlug(input.slug);
    if (input.legacyId !== undefined) identityPatch.legacyId = input.legacyId;
    await tx.update(categories).set(identityPatch)
      .where(eq(categories.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "category.updated",
      targetType: "category",
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

export async function publishCategory(
  actor: AuthenticatedUser | null,
  categoryId: string,
  options: PublishOptions,
): Promise<PublishResult> {
  const authorized = requireRole(actor, "editor");

  requireTargetUuid(categoryId, "CATEGORY_NOT_FOUND");
  return catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(categories)
      .where(eq(categories.id, categoryId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("CATEGORY_NOT_FOUND", 404);
    if (options.expectedDraftRevisionId
      && options.expectedDraftRevisionId !== identity.draftRevisionId) {
      throw new AppError("STALE_DRAFT_REVISION", 409);
    }
    if (identity.status === "archived") throw new AppError("CONTENT_ARCHIVED", 409);
    if (identity.draftRevisionId === identity.publishedRevisionId) {
      throw new AppError("IMMUTABLE_PUBLISHED_REVISION", 409);
    }
    const [revision] = await tx.select().from(categoryRevisions)
      .where(and(
        eq(categoryRevisions.id, identity.draftRevisionId),
        eq(categoryRevisions.categoryId, identity.id),
      ));
    if (!revision) throw new AppError("CATEGORY_DRAFT_NOT_FOUND", 409);

    const translations = await tx.select().from(categoryTranslations)
      .where(eq(categoryTranslations.categoryRevisionId, revision.id));
    const locales = translations.map((translation) => translation.locale);
    validatePublicationTranslations(locales, revision.primaryLocale);
    const warnings = publicationWarnings(locales, options);

    const cover = revision.coverMediaId
      ? await tx.select({ id: media.id }).from(media).where(and(
        eq(media.id, revision.coverMediaId),
        isNull(media.deletedAt),
      ))
      : [];
    if (cover.length !== 1) throw new AppError("CATEGORY_COVER_REQUIRED", 422);

    const nextRevisionNumber = revision.revisionNumber + 1;
    const [nextDraft] = await tx.insert(categoryRevisions).values({
      categoryId: identity.id,
      revisionNumber: nextRevisionNumber,
      primaryLocale: revision.primaryLocale,
      displayOrder: revision.displayOrder,
      coverMediaId: revision.coverMediaId,
    }).returning();
    if (translations.length > 0) {
      await tx.insert(categoryTranslations).values(translations.map((translation) => ({
        categoryRevisionId: nextDraft.id,
        locale: translation.locale,
        name: translation.name,
        tagline: translation.tagline,
      })));
    }

    const now = new Date();
    await tx.update(categories).set({
      status: "published",
      publishedRevisionId: revision.id,
      draftRevisionId: nextDraft.id,
      publishedAt: now,
      archivedAt: null,
      updatedAt: now,
    }).where(eq(categories.id, identity.id));
    const previousPublished = identity.publishedRevisionId
      ? await tx.select({ revisionNumber: categoryRevisions.revisionNumber })
        .from(categoryRevisions)
        .where(eq(categoryRevisions.id, identity.publishedRevisionId))
      : [];
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "category.published",
      targetType: "category",
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

export async function archiveCategory(
  actor: AuthenticatedUser | null,
  categoryId: string,
): Promise<void> {
  const authorized = requireRole(actor, "editor");
  requireTargetUuid(categoryId, "CATEGORY_NOT_FOUND");
  await catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(categories)
      .where(eq(categories.id, categoryId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("CATEGORY_NOT_FOUND", 404);
    if (identity.status === "archived") throw new AppError("CONTENT_ALREADY_ARCHIVED", 409);
    const [revision] = await tx.select({ revisionNumber: categoryRevisions.revisionNumber })
      .from(categoryRevisions).where(eq(categoryRevisions.id, identity.draftRevisionId));
    const now = new Date();
    await tx.update(categories).set({
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    }).where(eq(categories.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "category.archived",
      targetType: "category",
      targetId: identity.id,
      metadata: safeAuditMetadata({
        revisionNumber: revision?.revisionNumber ?? null,
        status: "archived",
      }),
    });
  }));
}

export async function restoreCategory(
  actor: AuthenticatedUser | null,
  categoryId: string,
): Promise<void> {
  const authorized = requireRole(actor, "editor");
  requireTargetUuid(categoryId, "CATEGORY_NOT_FOUND");
  await catalogTransaction(() => db.transaction(async (tx) => {
    const [identity] = await tx.select().from(categories)
      .where(eq(categories.id, categoryId)).for("update");
    if (!identity?.draftRevisionId) throw new AppError("CATEGORY_NOT_FOUND", 404);
    if (identity.status !== "archived") throw new AppError("CONTENT_NOT_ARCHIVED", 409);
    const [revision] = await tx.select({ revisionNumber: categoryRevisions.revisionNumber })
      .from(categoryRevisions).where(eq(categoryRevisions.id, identity.draftRevisionId));
    await tx.update(categories).set({
      status: "draft",
      archivedAt: null,
      updatedAt: new Date(),
    }).where(eq(categories.id, identity.id));
    await tx.insert(auditEvents).values({
      actorUserId: authorized.id,
      action: "category.restored",
      targetType: "category",
      targetId: identity.id,
      metadata: safeAuditMetadata({
        revisionNumber: revision?.revisionNumber ?? null,
        status: "draft",
      }),
    });
  }));
}
