import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  auditEvents,
  categories,
  categoryRevisions,
  media,
  placeRevisionCategories,
  placeRevisionMedia,
  placeRevisions,
  places,
  users,
} from "@/db/schema";
import type { AuthenticatedUser } from "@/lib/auth/authorization";
import {
  archiveCategory,
  createCategoryDraft,
  publishCategory,
  restoreCategory,
  updateCategoryDraft,
} from "@/lib/catalog/category-service";
import {
  archivePlace,
  createPlaceDraft,
  publishPlace,
  restorePlace,
  updatePlaceDraft,
  type CreatePlaceDraftInput,
} from "@/lib/catalog/place-service";
import { resetTestDatabase } from "@/tests/setup/database";

let sequence = 0;

function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

async function editor(): Promise<AuthenticatedUser> {
  const username = unique("editor");
  const [record] = await db.insert(users).values({
    normalizedUsername: username,
    displayUsername: username,
    role: "editor",
  }).returning();
  return record;
}

async function image(deleted = false): Promise<string> {
  const [record] = await db.insert(media).values({
    storageKey: `${randomUUID()}.jpg`,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    byteSize: 2048,
    deletedAt: deleted ? new Date() : null,
  }).returning({ id: media.id });
  return record.id;
}

async function draftCategory(
  actor: AuthenticatedUser,
  overrides: {
    slug?: string;
    legacyId?: string | null;
    coverMediaId?: string | null;
  } = {},
) {
  return createCategoryDraft(actor, {
    slug: overrides.slug ?? unique("category"),
    legacyId: overrides.legacyId,
    primaryLocale: "ru",
    translations: {
      ru: { name: "Категория" },
      kk: { name: "Санат" },
      en: { name: "Category" },
    },
    displayOrder: 0,
    coverMediaId: overrides.coverMediaId === undefined
      ? await image()
      : overrides.coverMediaId,
  });
}

async function publishedCategory(actor: AuthenticatedUser) {
  const record = await draftCategory(actor);
  await publishCategory(actor, record.id, {
    acknowledgeMissingLocales: false,
    expectedDraftRevisionId: record.draftRevisionId,
  });
  return record;
}

async function placeInput(
  categoryId: string,
  overrides: Partial<CreatePlaceDraftInput> = {},
): Promise<CreatePlaceDraftInput> {
  return {
    slug: unique("place"),
    primaryLocale: "ru",
    translations: {
      ru: { name: "Место" },
      kk: { name: "Орын" },
      en: { name: "Place" },
    },
    latitude: 43.238949,
    longitude: 76.889709,
    categoryIds: [categoryId],
    media: [{ mediaId: await image(), sortOrder: 0, isCover: true }],
    ...overrides,
  };
}

async function targetAuditCount(
  targetType: "place" | "category",
  targetId: string,
): Promise<number> {
  return (await db.select({ id: auditEvents.id }).from(auditEvents).where(and(
    eq(auditEvents.targetType, targetType),
    eq(auditEvents.targetId, targetId),
  ))).length;
}

describe("catalog mutation invariants", () => {
  beforeAll(resetTestDatabase);
  afterAll(() => db.$client.end());

  it("keeps published place and category identifiers immutable without audit side effects", async () => {
    const actor = await editor();
    const category = await publishedCategory(actor);
    const place = await createPlaceDraft(actor, await placeInput(category.id, {
      legacyId: unique("place-legacy"),
    }));
    await publishPlace(actor, place.id, {
      acknowledgeMissingLocales: false,
      expectedDraftRevisionId: place.draftRevisionId,
    });

    const placeAuditCount = await targetAuditCount("place", place.id);
    const categoryAuditCount = await targetAuditCount("category", category.id);
    await expect(updatePlaceDraft(actor, place.id, {
      slug: unique("changed-place"),
    })).rejects.toMatchObject({ code: "PUBLISHED_IDENTITY_IMMUTABLE" });
    await expect(updateCategoryDraft(actor, category.id, {
      slug: unique("changed-category"),
    })).rejects.toMatchObject({ code: "PUBLISHED_IDENTITY_IMMUTABLE" });

    await archivePlace(actor, place.id);
    await restorePlace(actor, place.id);
    await expect(updatePlaceDraft(actor, place.id, {
      legacyId: unique("changed-place-legacy"),
    })).rejects.toMatchObject({ code: "PUBLISHED_IDENTITY_IMMUTABLE" });
    await archiveCategory(actor, category.id);
    await restoreCategory(actor, category.id);
    await expect(updateCategoryDraft(actor, category.id, {
      legacyId: unique("changed-category-legacy"),
    })).rejects.toMatchObject({ code: "PUBLISHED_IDENTITY_IMMUTABLE" });

    expect(await db.query.places.findFirst({
      where: eq(places.id, place.id),
    })).toMatchObject({ slug: place.slug });
    expect(await db.query.categories.findFirst({
      where: eq(categories.id, category.id),
    })).toMatchObject({ slug: category.slug });
    expect(await targetAuditCount("place", place.id)).toBe(placeAuditCount + 2);
    expect(await targetAuditCount("category", category.id)).toBe(categoryAuditCount + 2);
  });

  it("allows identifier edits only before the first publication", async () => {
    const actor = await editor();
    const category = await draftCategory(actor);
    const nextCategorySlug = unique("next-category");
    await expect(updateCategoryDraft(actor, category.id, {
      slug: nextCategorySlug,
      legacyId: unique("category-legacy"),
    })).resolves.toMatchObject({ slug: nextCategorySlug });

    const place = await createPlaceDraft(actor, await placeInput(category.id));
    const nextPlaceSlug = unique("next-place");
    await expect(updatePlaceDraft(actor, place.id, {
      slug: nextPlaceSlug,
      legacyId: unique("place-legacy"),
    })).resolves.toMatchObject({ slug: nextPlaceSlug });
  });

  it("rejects archived and nonexistent categories during place creation and update atomically", async () => {
    const actor = await editor();
    const validCategory = await draftCategory(actor);
    const archivedCategory = await draftCategory(actor);
    await archiveCategory(actor, archivedCategory.id);

    const archivedSlug = unique("archived-assignment");
    await expect(createPlaceDraft(actor, await placeInput(archivedCategory.id, {
      slug: archivedSlug,
    }))).rejects.toMatchObject({ code: "ARCHIVED_CATEGORY_REFERENCED" });
    expect(await db.query.places.findFirst({
      where: eq(places.slug, archivedSlug),
    })).toBeUndefined();

    const missingSlug = unique("missing-assignment");
    await expect(createPlaceDraft(actor, await placeInput(randomUUID(), {
      slug: missingSlug,
    }))).rejects.toMatchObject({ code: "CATEGORY_REFERENCE_INVALID" });
    expect(await db.query.places.findFirst({
      where: eq(places.slug, missingSlug),
    })).toBeUndefined();

    const place = await createPlaceDraft(actor, await placeInput(validCategory.id));
    const auditCount = await targetAuditCount("place", place.id);
    await expect(updatePlaceDraft(actor, place.id, {
      categoryIds: [archivedCategory.id],
    })).rejects.toMatchObject({ code: "ARCHIVED_CATEGORY_REFERENCED" });
    await expect(updatePlaceDraft(actor, place.id, {
      categoryIds: [randomUUID()],
    })).rejects.toMatchObject({ code: "CATEGORY_REFERENCE_INVALID" });
    expect(await db.select({ categoryId: placeRevisionCategories.categoryId })
      .from(placeRevisionCategories)
      .where(eq(placeRevisionCategories.placeRevisionId, place.draftRevisionId)))
      .toEqual([{ categoryId: validCategory.id }]);
    expect(await targetAuditCount("place", place.id)).toBe(auditCount);
  });

  it("maps concurrent place slug and legacy collisions to stable conflict errors", async () => {
    const actor = await editor();
    const category = await draftCategory(actor);
    const slug = unique("collision-place");
    const results = await Promise.allSettled([
      createPlaceDraft(actor, await placeInput(category.id, { slug })),
      createPlaceDraft(actor, await placeInput(category.id, { slug })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "PLACE_SLUG_CONFLICT", status: 409 });

    const legacyId = unique("collision-place-legacy");
    const legacyResults = await Promise.allSettled([
      createPlaceDraft(actor, await placeInput(category.id, { legacyId })),
      createPlaceDraft(actor, await placeInput(category.id, { legacyId })),
    ]);
    expect(legacyResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const legacyRejected = legacyResults.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(legacyRejected.reason).toMatchObject({
      code: "PLACE_LEGACY_ID_CONFLICT",
      status: 409,
    });
  });

  it("maps category slug and legacy collisions to stable conflict errors", async () => {
    const actor = await editor();
    const slug = unique("collision-category");
    const slugResults = await Promise.allSettled([
      draftCategory(actor, { slug }),
      draftCategory(actor, { slug }),
    ]);
    expect(slugResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const slugRejected = slugResults.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(slugRejected.reason).toMatchObject({
      code: "CATEGORY_SLUG_CONFLICT",
      status: 409,
    });

    const legacyId = unique("collision-category-legacy");
    const results = await Promise.allSettled([
      draftCategory(actor, { legacyId }),
      draftCategory(actor, { legacyId }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({
      code: "CATEGORY_LEGACY_ID_CONFLICT",
      status: 409,
    });
  });

  it("returns not-found domain errors for malformed target identifiers", async () => {
    const actor = await editor();
    await expect(updatePlaceDraft(actor, "not-a-uuid", {
      slug: unique("never"),
    })).rejects.toMatchObject({ code: "PLACE_NOT_FOUND", status: 404 });
    await expect(publishCategory(actor, "not-a-uuid", {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND", status: 404 });
  });

  it.each([
    {
      name: "duplicate category IDs",
      code: "DUPLICATE_CATEGORY_ASSIGNMENT",
      mutate: async (categoryId: string) => ({
        categoryIds: [categoryId, categoryId],
      }),
    },
    {
      name: "duplicate media IDs",
      code: "DUPLICATE_MEDIA_ASSIGNMENT",
      mutate: async () => {
        const mediaId = await image();
        return {
          media: [
            { mediaId, sortOrder: 0, isCover: true },
            { mediaId, sortOrder: 1, isCover: false },
          ],
        };
      },
    },
    {
      name: "duplicate media sort positions",
      code: "DUPLICATE_MEDIA_SORT_ORDER",
      mutate: async () => ({
        media: [
          { mediaId: await image(), sortOrder: 0, isCover: true },
          { mediaId: await image(), sortOrder: 0, isCover: false },
        ],
      }),
    },
    {
      name: "multiple cover images",
      code: "MULTIPLE_COVER_MEDIA",
      mutate: async () => ({
        media: [
          { mediaId: await image(), sortOrder: 0, isCover: true },
          { mediaId: await image(), sortOrder: 1, isCover: true },
        ],
      }),
    },
  ])("rejects $name without partial writes", async ({ code, mutate }) => {
    const actor = await editor();
    const category = await draftCategory(actor);
    const slug = unique("invalid-collection");
    await expect(createPlaceDraft(actor, await placeInput(category.id, {
      slug,
      ...await mutate(category.id),
    }))).rejects.toMatchObject({ code, status: 422 });
    expect(await db.query.places.findFirst({
      where: eq(places.slug, slug),
    })).toBeUndefined();
  });

  it("rejects nonexistent and soft-deleted place media on create and update", async () => {
    const actor = await editor();
    const category = await draftCategory(actor);
    await expect(createPlaceDraft(actor, await placeInput(category.id, {
      media: [{ mediaId: randomUUID(), sortOrder: 0, isCover: true }],
    }))).rejects.toMatchObject({ code: "MEDIA_REFERENCE_INVALID" });
    const deletedMediaId = await image(true);
    await expect(createPlaceDraft(actor, await placeInput(category.id, {
      media: [{ mediaId: deletedMediaId, sortOrder: 0, isCover: true }],
    }))).rejects.toMatchObject({ code: "MEDIA_REFERENCE_INVALID" });

    const place = await createPlaceDraft(actor, await placeInput(category.id));
    const auditCount = await targetAuditCount("place", place.id);
    const originalAssignments = await db.select().from(placeRevisionMedia)
      .where(eq(placeRevisionMedia.placeRevisionId, place.draftRevisionId));
    await expect(updatePlaceDraft(actor, place.id, {
      media: [{ mediaId: deletedMediaId, sortOrder: 0, isCover: true }],
    })).rejects.toMatchObject({ code: "MEDIA_REFERENCE_INVALID" });
    expect(await db.select().from(placeRevisionMedia)
      .where(eq(placeRevisionMedia.placeRevisionId, place.draftRevisionId)))
      .toEqual(originalAssignments);
    expect(await targetAuditCount("place", place.id)).toBe(auditCount);
  });

  it("rejects nonexistent and soft-deleted category cover references", async () => {
    const actor = await editor();
    await expect(draftCategory(actor, {
      coverMediaId: randomUUID(),
    })).rejects.toMatchObject({ code: "MEDIA_REFERENCE_INVALID" });
    await expect(draftCategory(actor, {
      coverMediaId: await image(true),
    })).rejects.toMatchObject({ code: "MEDIA_REFERENCE_INVALID" });
  });

  it("rejects a stale place or category publication precondition", async () => {
    const actor = await editor();
    const category = await draftCategory(actor);
    const firstCategoryPublish = await publishCategory(actor, category.id, {
      acknowledgeMissingLocales: false,
      expectedDraftRevisionId: category.draftRevisionId,
    });
    await expect(publishCategory(actor, category.id, {
      acknowledgeMissingLocales: false,
      expectedDraftRevisionId: category.draftRevisionId,
    })).rejects.toMatchObject({ code: "STALE_DRAFT_REVISION", status: 409 });

    const place = await createPlaceDraft(actor, await placeInput(category.id));
    const firstPlacePublish = await publishPlace(actor, place.id, {
      acknowledgeMissingLocales: false,
      expectedDraftRevisionId: place.draftRevisionId,
    });
    await expect(publishPlace(actor, place.id, {
      acknowledgeMissingLocales: false,
      expectedDraftRevisionId: place.draftRevisionId,
    })).rejects.toMatchObject({ code: "STALE_DRAFT_REVISION", status: 409 });

    expect(await db.query.categories.findFirst({
      where: eq(categories.id, category.id),
    })).toMatchObject({
      publishedRevisionId: firstCategoryPublish.publishedRevisionId,
      draftRevisionId: firstCategoryPublish.draftRevisionId,
    });
    expect(await db.query.places.findFirst({
      where: eq(places.id, place.id),
    })).toMatchObject({
      publishedRevisionId: firstPlacePublish.publishedRevisionId,
      draftRevisionId: firstPlacePublish.draftRevisionId,
    });
    expect(await db.select().from(categoryRevisions)
      .where(eq(categoryRevisions.categoryId, category.id))).toHaveLength(2);
    expect(await db.select().from(placeRevisions)
      .where(eq(placeRevisions.placeId, place.id))).toHaveLength(2);
  });
});
