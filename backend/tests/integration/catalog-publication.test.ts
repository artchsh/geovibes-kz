import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  auditEvents,
  categories,
  categoryRevisions,
  categoryTranslations,
  media,
  placeRevisions,
  places,
  placeTranslations,
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
} from "@/lib/catalog/place-service";
import { resetTestDatabase } from "@/tests/setup/database";

let sequence = 0;

function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

async function user(role: "user" | "editor" | "admin" = "editor"): Promise<AuthenticatedUser> {
  const username = unique(role);
  const [record] = await db.insert(users).values({
    normalizedUsername: username,
    displayUsername: username,
    role,
  }).returning();
  return record;
}

async function image(): Promise<string> {
  const [record] = await db.insert(media).values({
    storageKey: `${randomUUID()}.jpg`,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    byteSize: 1024,
  }).returning({ id: media.id });
  return record.id;
}

async function categoryFixture(
  actor: AuthenticatedUser,
  options: {
    translations?: Record<string, { name: string; tagline?: string }>;
    primaryLocale?: "ru" | "kk" | "en" | null;
    coverMediaId?: string | null;
    publish?: boolean;
  } = {},
) {
  const record = await createCategoryDraft(actor, {
    slug: unique("category"),
    primaryLocale: options.primaryLocale === undefined ? "ru" : options.primaryLocale,
    translations: options.translations ?? { ru: { name: "Category" }, en: { name: "Category" } },
    displayOrder: 1,
    coverMediaId: options.coverMediaId === undefined ? await image() : options.coverMediaId,
  });
  if (options.publish !== false) {
    await publishCategory(actor, record.id, { acknowledgeMissingLocales: true });
  }
  return record;
}

async function placeFixture(
  actor: AuthenticatedUser,
  categoryId: string,
  options: {
    translations?: Record<string, { name: string; tagline?: string; description?: string }>;
    primaryLocale?: "ru" | "kk" | "en" | null;
    latitude?: number | null;
    longitude?: number | null;
    media?: Array<{ mediaId: string; sortOrder: number; isCover: boolean }>;
    categoryIds?: string[];
  } = {},
) {
  return createPlaceDraft(actor, {
    slug: unique("place"),
    primaryLocale: options.primaryLocale === undefined ? "ru" : options.primaryLocale,
    translations: options.translations ?? { ru: { name: "Old" } },
    latitude: options.latitude === undefined ? 43.238949 : options.latitude,
    longitude: options.longitude === undefined ? 76.889709 : options.longitude,
    categoryIds: options.categoryIds ?? [categoryId],
    media: options.media ?? [{
      mediaId: await image(),
      sortOrder: 0,
      isCover: true,
    }],
  });
}

async function publishedName(placeId: string): Promise<string | undefined> {
  const [identity] = await db.select({
    publishedRevisionId: places.publishedRevisionId,
  }).from(places).where(eq(places.id, placeId));
  if (!identity?.publishedRevisionId) return undefined;
  const [translation] = await db.select({ name: placeTranslations.name })
    .from(placeTranslations)
    .where(and(
      eq(placeTranslations.placeRevisionId, identity.publishedRevisionId),
      eq(placeTranslations.locale, "ru"),
    ));
  return translation?.name;
}

describe("catalog publication services", () => {
  beforeAll(resetTestDatabase);
  afterAll(() => db.$client.end());

  it("keeps the old immutable snapshot live until republish, then switches atomically", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);
    const place = await placeFixture(editor, category.id);

    const first = await publishPlace(editor, place.id, { acknowledgeMissingLocales: true });
    expect(await publishedName(place.id)).toBe("Old");

    await updatePlaceDraft(editor, place.id, {
      translations: { ru: { name: "New" } },
    });

    expect(await publishedName(place.id)).toBe("Old");
    const second = await publishPlace(editor, place.id, { acknowledgeMissingLocales: true });
    expect(await publishedName(place.id)).toBe("New");
    expect(second.publishedRevisionId).not.toBe(first.publishedRevisionId);

    const oldRows = await db.select({ name: placeTranslations.name })
      .from(placeTranslations)
      .where(eq(placeTranslations.placeRevisionId, first.publishedRevisionId));
    expect(oldRows).toEqual([{ name: "Old" }]);

    const revisions = await db.select({ revisionNumber: placeRevisions.revisionNumber })
      .from(placeRevisions)
      .where(eq(placeRevisions.placeId, place.id))
      .orderBy(asc(placeRevisions.revisionNumber));
    expect(revisions).toEqual([
      { revisionNumber: 1 },
      { revisionNumber: 2 },
      { revisionNumber: 3 },
    ]);
  });

  it("requires acknowledgement for one language and returns a success warning", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);
    const place = await placeFixture(editor, category.id);

    await expect(publishPlace(editor, place.id, {
      acknowledgeMissingLocales: false,
    })).rejects.toMatchObject({ code: "MISSING_LOCALES_CONFIRMATION_REQUIRED" });

    const result = await publishPlace(editor, place.id, {
      acknowledgeMissingLocales: true,
    });
    expect(result.warnings).toEqual([{
      code: "MISSING_TRANSLATIONS",
      missingLocales: ["kk", "en"],
    }]);
  });

  it("publishes two human-authored languages without a warning", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);
    const place = await placeFixture(editor, category.id, {
      translations: { ru: { name: "Тест" }, kk: { name: "Сынақ" } },
    });

    await expect(publishPlace(editor, place.id, {
      acknowledgeMissingLocales: false,
    })).resolves.toMatchObject({ warnings: [] });
  });

  it("validates primary locale, coordinates, categories, and place cover media", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);

    const missingPrimary = await placeFixture(editor, category.id, {
      primaryLocale: "en",
    });
    await expect(publishPlace(editor, missingPrimary.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "PRIMARY_LOCALE_TRANSLATION_REQUIRED" });

    const badCoordinates = await placeFixture(editor, category.id, { latitude: 91 });
    await expect(publishPlace(editor, badCoordinates.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "INVALID_COORDINATES" });

    const noCategory = await placeFixture(editor, category.id, { categoryIds: [] });
    await expect(publishPlace(editor, noCategory.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "PLACE_CATEGORY_REQUIRED" });

    const noCover = await placeFixture(editor, category.id, { media: [] });
    await expect(publishPlace(editor, noCover.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "PLACE_COVER_REQUIRED" });
  });

  it("blocks a place publication when any referenced category is archived", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);
    const place = await placeFixture(editor, category.id);
    await archiveCategory(editor, category.id);

    await expect(publishPlace(editor, place.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "ARCHIVED_CATEGORY_REFERENCED" });
  });

  it("validates category primary locale and non-deleted cover media", async () => {
    const editor = await user();
    const missingPrimary = await categoryFixture(editor, {
      primaryLocale: "en",
      translations: { ru: { name: "Категория" } },
      publish: false,
    });
    await expect(publishCategory(editor, missingPrimary.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "PRIMARY_LOCALE_TRANSLATION_REQUIRED" });

    const deletedCoverId = await image();
    await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, deletedCoverId));
    const deletedCover = await categoryFixture(editor, {
      coverMediaId: deletedCoverId,
      publish: false,
    });
    await expect(publishCategory(editor, deletedCover.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "CATEGORY_COVER_REQUIRED" });
  });

  it("archives without deleting revisions and restores to editable non-public draft", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);
    const place = await placeFixture(editor, category.id);
    await publishPlace(editor, place.id, { acknowledgeMissingLocales: true });

    await archivePlace(editor, place.id);
    let [identity] = await db.select().from(places).where(eq(places.id, place.id));
    expect(identity).toMatchObject({
      status: "archived",
      publishedRevisionId: expect.any(String),
      archivedAt: expect.any(Date),
    });

    await restorePlace(editor, place.id);
    [identity] = await db.select().from(places).where(eq(places.id, place.id));
    expect(identity).toMatchObject({
      status: "draft",
      publishedRevisionId: expect.any(String),
      archivedAt: null,
    });

    await archiveCategory(editor, category.id);
    await restoreCategory(editor, category.id);
    const [categoryIdentity] = await db.select().from(categories)
      .where(eq(categories.id, category.id));
    expect(categoryIdentity).toMatchObject({ status: "draft", archivedAt: null });
  });

  it("enforces editor authorization inside every mutation service", async () => {
    const editor = await user();
    const ordinary = await user("user");
    const category = await categoryFixture(editor);
    const place = await placeFixture(editor, category.id);

    await expect(createPlaceDraft(ordinary, {
      slug: unique("forbidden-place"),
      primaryLocale: "ru",
      translations: { ru: { name: "No" } },
      latitude: 43,
      longitude: 76,
      categoryIds: [category.id],
      media: [],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updatePlaceDraft(ordinary, place.id, {
      translations: { ru: { name: "No" } },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(publishPlace(ordinary, place.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(archivePlace(ordinary, place.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(restorePlace(ordinary, place.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createCategoryDraft(ordinary, {
      slug: unique("forbidden-category"),
      primaryLocale: "ru",
      translations: { ru: { name: "No" } },
      displayOrder: 0,
      coverMediaId: null,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateCategoryDraft(ordinary, category.id, {
      translations: { ru: { name: "No" } },
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(publishCategory(ordinary, category.id, {
      acknowledgeMissingLocales: true,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(archiveCategory(ordinary, category.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(restoreCategory(ordinary, category.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("writes allowlisted audit events atomically with every mutation", async () => {
    const editor = await user();
    const category = await categoryFixture(editor, { publish: false });
    await updateCategoryDraft(editor, category.id, { displayOrder: 2 });
    await publishCategory(editor, category.id, { acknowledgeMissingLocales: false });
    await archiveCategory(editor, category.id);
    await restoreCategory(editor, category.id);

    const events = await db.select().from(auditEvents)
      .where(and(
        eq(auditEvents.targetType, "category"),
        eq(auditEvents.targetId, category.id),
      ))
      .orderBy(asc(auditEvents.createdAt));
    expect(events.map((event) => event.action)).toEqual([
      "category.created",
      "category.updated",
      "category.published",
      "category.archived",
      "category.restored",
    ]);
    for (const event of events) {
      expect(Object.keys(event.metadata).sort()).toEqual(
        expect.arrayContaining(["revisionNumber"]),
      );
      expect(JSON.stringify(event.metadata)).not.toMatch(
        /password|token|secret|proxy|credential|payload/i,
      );
    }

    const fakeActor = { ...editor, id: randomUUID() };
    const slug = unique("rolled-back");
    await expect(createCategoryDraft(fakeActor, {
      slug,
      primaryLocale: "ru",
      translations: { ru: { name: "Rollback" } },
      displayOrder: 0,
      coverMediaId: await image(),
    })).rejects.toThrow();
    expect(await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    })).toBeUndefined();
  });

  it("never mutates the previous published category revision", async () => {
    const editor = await user();
    const category = await categoryFixture(editor);
    const [firstIdentity] = await db.select().from(categories)
      .where(eq(categories.id, category.id));

    await updateCategoryDraft(editor, category.id, {
      translations: { ru: { name: "Changed" }, en: { name: "Changed" } },
    });
    const [oldTranslation] = await db.select().from(categoryTranslations)
      .where(and(
        eq(categoryTranslations.categoryRevisionId, firstIdentity.publishedRevisionId!),
        eq(categoryTranslations.locale, "ru"),
      ));
    expect(oldTranslation.name).toBe("Category");

    await publishCategory(editor, category.id, { acknowledgeMissingLocales: false });
    const [secondIdentity] = await db.select().from(categories)
      .where(eq(categories.id, category.id));
    expect(secondIdentity.publishedRevisionId).not.toBe(firstIdentity.publishedRevisionId);

    const revisions = await db.select({ revisionNumber: categoryRevisions.revisionNumber })
      .from(categoryRevisions)
      .where(eq(categoryRevisions.categoryId, category.id))
      .orderBy(asc(categoryRevisions.revisionNumber));
    expect(revisions).toEqual([
      { revisionNumber: 1 },
      { revisionNumber: 2 },
      { revisionNumber: 3 },
    ]);
  });
});
