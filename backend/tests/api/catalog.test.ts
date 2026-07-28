import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  categories,
  categoryRevisions,
  categoryTranslations,
  media,
  placeRevisionCategories,
  placeRevisionMedia,
  placeRevisions,
  places,
  placeTranslations,
} from "@/db/schema";
import { GET as listCategoriesRoute } from "@/app/api/v1/categories/route";
import { GET as listPlacesRoute } from "@/app/api/v1/places/route";
import { GET as getPlaceRoute } from "@/app/api/v1/places/[slug]/route";
import { resetTestDatabase } from "@/tests/setup/database";
import { env } from "@/lib/env";

type Locale = "ru" | "kk" | "en";

let sequence = 0;

function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

async function image(storageKey = `${randomUUID()}.jpg`) {
  const [record] = await db.insert(media).values({
    storageKey,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    byteSize: 1024,
    altText: "Public alt",
  }).returning();
  return record;
}

async function categoryFixture(options: {
  slug?: string;
  status?: "draft" | "published" | "archived";
  primaryLocale?: Locale | null;
  translations?: Partial<Record<Locale, { name: string; tagline?: string | null }>>;
  displayOrder?: number;
  legacyId?: string | null;
  validPublishedPointer?: boolean;
} = {}) {
  const slug = options.slug ?? unique("category");
  const status = options.status ?? "published";
  const cover = await image();
  const [identity] = await db.insert(categories).values({
    slug,
    status,
    legacyId: options.legacyId ?? null,
  }).returning();
  const [revision] = await db.insert(categoryRevisions).values({
    categoryId: identity.id,
    revisionNumber: 1,
    primaryLocale: options.primaryLocale === undefined ? "ru" : options.primaryLocale,
    displayOrder: options.displayOrder ?? 0,
    coverMediaId: cover.id,
  }).returning();
  const translations = options.translations ?? { ru: { name: slug } };
  await db.insert(categoryTranslations).values(
    Object.entries(translations).map(([locale, value]) => ({
      categoryRevisionId: revision.id,
      locale: locale as Locale,
      name: value!.name,
      tagline: value!.tagline ?? null,
    })),
  );
  let publishedRevisionId: string | null = status === "archived" ? revision.id : null;
  if (status === "published") {
    if (options.validPublishedPointer === false) {
      const [foreignIdentity] = await db.insert(categories).values({
        slug: unique("foreign-category"),
      }).returning();
      const [foreignRevision] = await db.insert(categoryRevisions).values({
        categoryId: foreignIdentity.id,
        revisionNumber: 1,
        displayOrder: 0,
      }).returning();
      publishedRevisionId = foreignRevision.id;
    } else {
      publishedRevisionId = revision.id;
    }
  }
  await db.update(categories).set({
    draftRevisionId: revision.id,
    publishedRevisionId,
  }).where(eq(categories.id, identity.id));
  return { ...identity, slug, revision, cover };
}

async function placeFixture(options: {
  slug?: string;
  status?: "draft" | "published" | "archived";
  primaryLocale?: Locale | null;
  translations?: Partial<Record<Locale, {
    name: string;
    tagline?: string | null;
    description?: string | null;
  }>>;
  draftTranslations?: Partial<Record<Locale, { name: string }>>;
  categoryIds?: string[];
  draftCategoryIds?: string[];
  legacyId?: string | null;
  featuredRank?: number | null;
  validPublishedPointer?: boolean;
} = {}) {
  const slug = options.slug ?? unique("place");
  const status = options.status ?? "published";
  const cover = await image(`private/${slug}.jpg`);
  const [identity] = await db.insert(places).values({
    slug,
    status,
    legacyId: options.legacyId ?? null,
  }).returning();
  const [publishedRevision] = await db.insert(placeRevisions).values({
    placeId: identity.id,
    revisionNumber: 1,
    primaryLocale: options.primaryLocale === undefined ? "ru" : options.primaryLocale,
    address: "Published address",
    district: "Medeu",
    latitude: "43.238949",
    longitude: "76.889709",
    twoGisUrl: "https://2gis.kz/almaty",
    phone: "+7 700 000 00 00",
    websiteUrl: "https://example.test",
    instagramUrl: "https://instagram.com/example",
    priceLevel: 2,
    openingHours: { mon: "09:00-18:00" },
    editorialTags: ["quiet"],
    featuredRank: options.featuredRank ?? null,
  }).returning();
  const translations = options.translations ?? {
    ru: { name: slug, tagline: "Published tagline", description: "Published description" },
  };
  await db.insert(placeTranslations).values(
    Object.entries(translations).map(([locale, value]) => ({
      placeRevisionId: publishedRevision.id,
      locale: locale as Locale,
      name: value!.name,
      tagline: value!.tagline ?? null,
      description: value!.description ?? null,
    })),
  );
  const categoryIds = options.categoryIds ?? [];
  if (categoryIds.length > 0) {
    await db.insert(placeRevisionCategories).values(categoryIds.map((categoryId, sortOrder) => ({
      placeRevisionId: publishedRevision.id,
      categoryId,
      sortOrder,
    })));
  }
  await db.insert(placeRevisionMedia).values({
    placeRevisionId: publishedRevision.id,
    mediaId: cover.id,
    sortOrder: 0,
    isCover: true,
  });

  const [draftRevision] = await db.insert(placeRevisions).values({
    placeId: identity.id,
    revisionNumber: 2,
    primaryLocale: "ru",
    address: "Secret draft address",
    latitude: "44.000000",
    longitude: "77.000000",
    featuredRank: options.featuredRank ?? null,
  }).returning();
  const draftTranslations = options.draftTranslations ?? { ru: { name: "Secret draft name" } };
  await db.insert(placeTranslations).values(
    Object.entries(draftTranslations).map(([locale, value]) => ({
      placeRevisionId: draftRevision.id,
      locale: locale as Locale,
      name: value!.name,
    })),
  );
  if ((options.draftCategoryIds ?? []).length > 0) {
    await db.insert(placeRevisionCategories).values(
      options.draftCategoryIds!.map((categoryId, sortOrder) => ({
        placeRevisionId: draftRevision.id,
        categoryId,
        sortOrder,
      })),
    );
  }
  let publishedRevisionId: string | null = status === "archived" ? publishedRevision.id : null;
  if (status === "published") {
    if (options.validPublishedPointer === false) {
      const [foreignIdentity] = await db.insert(places).values({
        slug: unique("foreign-place"),
      }).returning();
      const [foreignRevision] = await db.insert(placeRevisions).values({
        placeId: foreignIdentity.id,
        revisionNumber: 1,
      }).returning();
      publishedRevisionId = foreignRevision.id;
    } else {
      publishedRevisionId = publishedRevision.id;
    }
  }
  await db.update(places).set({
    draftRevisionId: draftRevision.id,
    publishedRevisionId,
  }).where(eq(places.id, identity.id));
  return { ...identity, slug, publishedRevision, draftRevision, cover };
}

function request(path: string): Request {
  return new Request(`http://localhost:3001${path}`, {
    headers: { origin: "http://localhost:8081" },
  });
}

function signedCursor(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", env.AUTH_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

async function categoriesRequest(query = ""): Promise<Response> {
  return listCategoriesRoute(request(`/api/v1/categories${query}`));
}

async function placesRequest(query = ""): Promise<Response> {
  return listPlacesRoute(request(`/api/v1/places${query}`));
}

async function detailRequest(slug: string, query = ""): Promise<Response> {
  return getPlaceRoute(
    request(`/api/v1/places/${slug}${query}`),
    { params: Promise.resolve({ slug }) },
  );
}

describe("public catalog API", () => {
  beforeEach(resetTestDatabase);

  it("returns only valid published categories with deterministic human-authored fallback", async () => {
    await categoryFixture({ status: "draft", slug: "draft-category" });
    await categoryFixture({ status: "archived", slug: "archived-category" });
    await categoryFixture({
      slug: "russian-only",
      legacyId: "1",
      primaryLocale: "ru",
      displayOrder: 2,
      translations: { ru: { name: "Только русский", tagline: "Без перевода" } },
    });
    await categoryFixture({
      slug: "three-languages",
      primaryLocale: "kk",
      displayOrder: 1,
      translations: {
        ru: { name: "Русский" },
        kk: { name: "Қазақша" },
        en: { name: "English" },
      },
    });
    await categoryFixture({
      slug: "broken-pointer",
      validPublishedPointer: false,
    });
    const deletedCoverCategory = await categoryFixture({ slug: "deleted-cover-category" });
    await db.update(media).set({ deletedAt: new Date() })
      .where(eq(media.id, deletedCoverCategory.cover.id));

    const response = await categoriesRequest("?locale=kk");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([
      expect.objectContaining({
        slug: "three-languages",
        name: "Қазақша",
        requestedLanguage: "kk",
        contentLanguage: "kk",
      }),
      expect.objectContaining({
        slug: "russian-only",
        legacyId: "1",
        name: "Только русский",
        tagline: "Без перевода",
        requestedLanguage: "kk",
        contentLanguage: "ru",
      }),
    ]);
    expect(Object.keys(body.data[0]).sort()).toEqual([
      "contentLanguage",
      "coverImageUrl",
      "coverMediaId",
      "displayOrder",
      "id",
      "legacyId",
      "name",
      "requestedLanguage",
      "slug",
      "tagline",
    ]);
    expect(JSON.stringify(body)).not.toMatch(
      /draftRevisionId|publishedRevisionId|storageKey|private\/|createdAt|updatedAt/,
    );
  });

  it("serves the immutable published place snapshot and stable media URLs only", async () => {
    const category = await categoryFixture({ slug: "coffee" });
    const place = await placeFixture({
      slug: "published-cafe",
      legacyId: "7",
      categoryIds: [category.id],
      primaryLocale: "ru",
      translations: {
        ru: {
          name: "Опубликованное кафе",
          tagline: "Публичный текст",
          description: "Человеческий русский текст",
        },
        en: { name: "Published cafe", description: "Human English text" },
      },
      draftTranslations: { ru: { name: "Невидимый черновик" } },
    });

    const response = await detailRequest(place.slug, "?locale=kk");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: place.id,
      legacyId: "7",
      slug: "published-cafe",
      name: "Опубликованное кафе",
      description: "Человеческий русский текст",
      address: "Published address",
      requestedLanguage: "kk",
      contentLanguage: "ru",
      categoryIds: [category.id],
      coverImageUrl: `http://localhost:3001/media/${place.cover.id}`,
      latitude: 43.238949,
      longitude: 76.889709,
    });
    expect(body.data.media).toEqual([{
      id: place.cover.id,
      url: `http://localhost:3001/media/${place.cover.id}`,
      altText: "Public alt",
      sortOrder: 0,
      isCover: true,
    }]);
    expect(Object.keys(body.data).sort()).toEqual([
      "address",
      "categoryIds",
      "contentLanguage",
      "coverImageUrl",
      "description",
      "district",
      "editorialTags",
      "featuredRank",
      "id",
      "instagramUrl",
      "latitude",
      "legacyId",
      "longitude",
      "media",
      "name",
      "openingHours",
      "phone",
      "priceLevel",
      "requestedLanguage",
      "slug",
      "tagline",
      "twoGisUrl",
      "websiteUrl",
    ]);
    expect(JSON.stringify(body)).not.toMatch(
      /Невидимый|Secret draft|draftRevisionId|publishedRevisionId|storageKey|private\/|createdAt|updatedAt/,
    );
  });

  it("does not resolve draft, archived, missing, or invalidly pointed places by slug", async () => {
    const category = await categoryFixture();
    const draft = await placeFixture({ status: "draft", categoryIds: [category.id] });
    const archived = await placeFixture({ status: "archived", categoryIds: [category.id] });
    const invalid = await placeFixture({
      slug: "mismatched-pointer",
      categoryIds: [category.id],
      validPublishedPointer: false,
    });
    const deletedCover = await placeFixture({
      slug: "deleted-cover-place",
      categoryIds: [category.id],
    });
    await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, deletedCover.cover.id));

    for (const slug of [draft.slug, archived.slug, invalid.slug, deletedCover.slug, "missing"]) {
      const response = await detailRequest(slug);
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe("PLACE_NOT_FOUND");
    }
    const list = await placesRequest();
    expect((await list.json()).data).toEqual([]);
  });


  it("filters through the published assignment snapshot and excludes archived categories", async () => {
    const publishedCategory = await categoryFixture({ slug: "published-category" });
    const draftOnlyCategory = await categoryFixture({ slug: "draft-only-category" });
    const archivedCategory = await categoryFixture({ slug: "archived-filter" });
    const place = await placeFixture({
      slug: "snapshot-place",
      categoryIds: [publishedCategory.id, archivedCategory.id],
      draftCategoryIds: [draftOnlyCategory.id],
    });
    await db.update(categories).set({ status: "archived" })
      .where(eq(categories.id, archivedCategory.id));
    await db.update(categories).set({ status: "published" })
      .where(eq(categories.id, publishedCategory.id));
    await db.update(categories).set({ status: "published" })
      .where(eq(categories.id, draftOnlyCategory.id));

    const published = await placesRequest("?category=published-category");
    expect((await published.json()).data).toEqual([
      expect.objectContaining({
        id: place.id,
        categoryIds: [publishedCategory.id],
      }),
    ]);
    expect((await placesRequest("?category=draft-only-category")).json())
      .resolves.toMatchObject({ data: [] });
    expect((await placesRequest("?category=archived-filter")).json())
      .resolves.toMatchObject({ data: [] });
  });

  it("searches multilingual published text while treating percent and underscore literally", async () => {
    const category = await categoryFixture();
    await placeFixture({
      slug: "kazakh-result",
      categoryIds: [category.id],
      translations: {
        kk: { name: "Көктөбе", description: "Алматы көрінісі" },
        ru: { name: "Кок-Тобе" },
      },
    });
    await placeFixture({
      slug: "literal-wildcards",
      categoryIds: [category.id],
      translations: { ru: { name: "100%_настоящее место" } },
    });
    await placeFixture({
      slug: "wildcard-decoy",
      categoryIds: [category.id],
      translations: { ru: { name: "100ABнастоящее место" } },
    });

    expect((await (await placesRequest("?query=%D0%BA%D3%A9%D1%80%D1%96%D0%BD%D1%96%D1%81%D1%96")).json()).data)
      .toEqual([expect.objectContaining({ slug: "kazakh-result" })]);
    expect((await (await placesRequest("?query=%25_")).json()).data)
      .toEqual([expect.objectContaining({ slug: "literal-wildcards" })]);
  });

  it("uses stable keyset pagination across tied sort values without gaps or duplicates", async () => {
    const category = await categoryFixture();
    for (const slug of ["delta", "alpha", "charlie", "bravo", "echo"]) {
      await placeFixture({ slug, categoryIds: [category.id], featuredRank: 3 });
    }

    const first = await (await placesRequest("?limit=2")).json();
    const second = await (await placesRequest(`?limit=2&cursor=${encodeURIComponent(first.page.nextCursor)}`)).json();
    const third = await (await placesRequest(`?limit=2&cursor=${encodeURIComponent(second.page.nextCursor)}`)).json();
    const slugs = [...first.data, ...second.data, ...third.data].map((item) => item.slug);

    expect(slugs).toEqual(["alpha", "bravo", "charlie", "delta", "echo"]);
    expect(new Set(slugs).size).toBe(5);
    expect(first.page).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });
    expect(second.page).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });
    expect(third.page).toEqual({ hasMore: false, nextCursor: null });
  });

  it("rejects tampered cursors and cursors replayed against another filter", async () => {
    const category = await categoryFixture({ slug: "cursor-category" });
    await placeFixture({ slug: "cursor-a", categoryIds: [category.id] });
    await placeFixture({ slug: "cursor-b", categoryIds: [category.id] });
    const first = await (await placesRequest("?limit=1&category=cursor-category")).json();
    const cursor = first.page.nextCursor as string;
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith("a") ? "b" : "a"}`;

    const staleShape = signedCursor({
      v: 2,
      kind: "places",
      locale: "ru",
      category: "cursor-category",
      query: null,
      rank: 2_147_483_647,
      slug: "cursor-a",
      id: randomUUID(),
    });

    for (const query of [
      `?limit=1&category=cursor-category&cursor=${encodeURIComponent(tampered)}`,
      `?limit=1&cursor=${encodeURIComponent(cursor)}`,
      "?cursor=not-a-cursor",
      `?limit=1&category=cursor-category&cursor=${encodeURIComponent(staleShape)}`,
    ]) {
      const response = await placesRequest(query);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatchObject({
        code: "INVALID_CURSOR",
        message: "Invalid pagination cursor",
      });
    }
  });

  it("validates locale, limit bounds, repeated values, and unknown parameters", async () => {
    for (const query of [
      "?locale=fr",
      "?limit=0",
      "?limit=51",
      "?limit=1.5",
      "?limit=2&limit=3",
      "?unknown=true",
      "?category=Not%20A%20Slug",
      "?query=",
    ]) {
      const response = await placesRequest(query);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("INVALID_REQUEST");
    }
    const categoryUnknown = await categoriesRequest("?cursor=nope");
    expect(categoryUnknown.status).toBe(400);
  });

  it("returns request IDs and exact configured CORS headers on public responses", async () => {
    const response = await placesRequest();
    const body = await response.json();
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:8081");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

afterAll(() => db.$client.end());
