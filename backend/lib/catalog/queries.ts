import { createHmac, timingSafeEqual } from "node:crypto";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
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
import { ApiError } from "@/lib/api/errors";
import {
  selectTranslation,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/catalog/translation";
import { env } from "@/lib/env";

export type PublicCategory = {
  id: string;
  legacyId: string | null;
  slug: string;
  name: string;
  tagline: string | null;
  requestedLanguage: SupportedLocale;
  contentLanguage: SupportedLocale;
  displayOrder: number;
  coverMediaId: string;
  coverImageUrl: string;
};

export type PublicMedia = {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isCover: boolean;
};

export type PublicPlace = {
  id: string;
  legacyId: string | null;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  requestedLanguage: SupportedLocale;
  contentLanguage: SupportedLocale;
  address: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  twoGisUrl: string | null;
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  priceLevel: number | null;
  openingHours: Record<string, unknown> | null;
  editorialTags: string[];
  featuredRank: number | null;
  categoryIds: string[];
  coverImageUrl: string | null;
  media: PublicMedia[];
};

export type Page<T> = {
  data: T[];
  page: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type ListPlacesInput = {
  locale: SupportedLocale;
  category?: string;
  query?: string;
  cursor?: string;
  limit?: number;
};

const cursorSchema = z.object({
  v: z.literal(1),
  kind: z.literal("places"),
  locale: z.enum(SUPPORTED_LOCALES),
  category: z.string().nullable(),
  query: z.string().nullable(),
  rank: z.number().int(),
  slug: z.string(),
  id: z.string().uuid(),
}).strict();

type PlacesCursor = z.infer<typeof cursorSchema>;

const NULL_FEATURED_RANK = 2_147_483_647;
const featuredSort = sql<number>`coalesce(${placeRevisions.featuredRank}, ${NULL_FEATURED_RANK})`;

function publicMediaUrl(id: string): string {
  return new URL(`/media/${id}`, env.APP_ORIGIN).toString();
}

function normalizedOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function cursorShape(input: ListPlacesInput): Pick<
  PlacesCursor,
  "locale" | "category" | "query"
> {
  return {
    locale: input.locale,
    category: normalizedOptional(input.category),
    query: normalizedOptional(input.query),
  };
}

function signCursorPayload(encodedPayload: string): Buffer {
  return createHmac("sha256", env.AUTH_SECRET).update(encodedPayload).digest();
}

function encodeCursor(payload: PlacesCursor): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signCursorPayload(encodedPayload).toString("base64url")}`;
}

function invalidCursor(): never {
  throw new ApiError("INVALID_CURSOR", 400, "Invalid pagination cursor");
}

function decodeCursor(value: string, expected: ReturnType<typeof cursorShape>): PlacesCursor {
  const parts = value.split(".");
  if (
    parts.length !== 2
    || !parts[0]
    || !parts[1]
    || !/^[A-Za-z0-9_-]+$/.test(parts[0])
    || !/^[A-Za-z0-9_-]+$/.test(parts[1])
  ) {
    return invalidCursor();
  }

  const suppliedSignature = Buffer.from(parts[1], "base64url");
  const expectedSignature = signCursorPayload(parts[0]);
  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return invalidCursor();
  }

  try {
    const decoded = Buffer.from(parts[0], "base64url");
    if (decoded.toString("base64url") !== parts[0]) return invalidCursor();
    const parsed = cursorSchema.parse(JSON.parse(decoded.toString("utf8")));
    if (
      parsed.locale !== expected.locale
      || parsed.category !== expected.category
      || parsed.query !== expected.query
    ) {
      return invalidCursor();
    }
    return parsed;
  } catch {
    return invalidCursor();
  }
}

function escapeLike(value: string): string {
  return value
    .replace(/!/g, "!!")
    .replace(/%/g, "!%")
    .replace(/_/g, "!_");
}

type PlaceIdentityRow = {
  id: string;
  legacyId: string | null;
  slug: string;
  revisionId: string;
  primaryLocale: SupportedLocale | null;
  address: string | null;
  district: string | null;
  latitude: string | null;
  longitude: string | null;
  twoGisUrl: string | null;
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  priceLevel: number | null;
  openingHours: Record<string, unknown> | null;
  editorialTags: string[];
  featuredRank: number | null;
  sortRank: number;
};

const publicPlaceSelection = {
  id: places.id,
  legacyId: places.legacyId,
  slug: places.slug,
  revisionId: placeRevisions.id,
  primaryLocale: placeRevisions.primaryLocale,
  address: placeRevisions.address,
  district: placeRevisions.district,
  latitude: placeRevisions.latitude,
  longitude: placeRevisions.longitude,
  twoGisUrl: placeRevisions.twoGisUrl,
  phone: placeRevisions.phone,
  websiteUrl: placeRevisions.websiteUrl,
  instagramUrl: placeRevisions.instagramUrl,
  priceLevel: placeRevisions.priceLevel,
  openingHours: placeRevisions.openingHours,
  editorialTags: placeRevisions.editorialTags,
  featuredRank: placeRevisions.featuredRank,
  sortRank: featuredSort,
};

function publishedPlaceConditions(): SQL[] {
  return [
    eq(places.status, "published"),
    sql`exists (
      select 1
      from ${placeTranslations}
      where ${placeTranslations.placeRevisionId} = ${placeRevisions.id}
    )`,
    sql`exists (
      select 1
      from ${placeRevisionMedia}
      inner join ${media} on ${media.id} = ${placeRevisionMedia.mediaId}
      where ${placeRevisionMedia.placeRevisionId} = ${placeRevisions.id}
        and ${placeRevisionMedia.isCover} = true
        and ${media.deletedAt} is null
    )`,
  ];
}

function categoryFilter(slug: string): SQL {
  return sql`exists (
    select 1
    from ${placeRevisionCategories}
    inner join ${categories}
      on ${categories.id} = ${placeRevisionCategories.categoryId}
    inner join ${categoryRevisions}
      on ${categoryRevisions.id} = ${categories.publishedRevisionId}
      and ${categoryRevisions.categoryId} = ${categories.id}
    where ${placeRevisionCategories.placeRevisionId} = ${placeRevisions.id}
      and ${categories.status} = 'published'
      and ${categories.slug} = ${slug}
  )`;
}

function searchFilter(query: string): SQL {
  const pattern = `%${escapeLike(query)}%`;
  return sql`exists (
    select 1
    from ${placeTranslations}
    where ${placeTranslations.placeRevisionId} = ${placeRevisions.id}
      and (
        to_tsvector(
          'simple',
          concat_ws(
            ' ',
            ${placeTranslations.name},
            ${placeTranslations.tagline},
            ${placeTranslations.description}
          )
        ) @@ websearch_to_tsquery('simple', ${query})
        or ${placeTranslations.name} ilike ${pattern} escape '!'
        or coalesce(${placeTranslations.tagline}, '') ilike ${pattern} escape '!'
        or coalesce(${placeTranslations.description}, '') ilike ${pattern} escape '!'
      )
  )`;
}

function afterCursor(cursor: PlacesCursor): SQL {
  return or(
    gt(featuredSort, cursor.rank),
    and(
      eq(featuredSort, cursor.rank),
      gt(places.slug, cursor.slug),
    ),
    and(
      eq(featuredSort, cursor.rank),
      eq(places.slug, cursor.slug),
      gt(places.id, cursor.id),
    ),
  ) as SQL;
}

async function hydratePlaces(
  rows: PlaceIdentityRow[],
  requestedLanguage: SupportedLocale,
): Promise<PublicPlace[]> {
  if (rows.length === 0) return [];
  const revisionIds = rows.map((row) => row.revisionId);
  const translationRows = await db.select({
    revisionId: placeTranslations.placeRevisionId,
    locale: placeTranslations.locale,
    name: placeTranslations.name,
    tagline: placeTranslations.tagline,
    description: placeTranslations.description,
  }).from(placeTranslations).where(inArray(
    placeTranslations.placeRevisionId,
    revisionIds,
  ));
  const categoryRows = await db.select({
    revisionId: placeRevisionCategories.placeRevisionId,
    categoryId: placeRevisionCategories.categoryId,
    sortOrder: placeRevisionCategories.sortOrder,
  }).from(placeRevisionCategories)
    .innerJoin(categories, and(
      eq(categories.id, placeRevisionCategories.categoryId),
      eq(categories.status, "published"),
    ))
    .innerJoin(categoryRevisions, and(
      eq(categoryRevisions.id, categories.publishedRevisionId),
      eq(categoryRevisions.categoryId, categories.id),
    ))
    .where(inArray(placeRevisionCategories.placeRevisionId, revisionIds))
    .orderBy(
      asc(placeRevisionCategories.placeRevisionId),
      asc(placeRevisionCategories.sortOrder),
      asc(placeRevisionCategories.categoryId),
    );
  const mediaRows = await db.select({
    revisionId: placeRevisionMedia.placeRevisionId,
    id: media.id,
    altText: media.altText,
    sortOrder: placeRevisionMedia.sortOrder,
    isCover: placeRevisionMedia.isCover,
  }).from(placeRevisionMedia)
    .innerJoin(media, and(
      eq(media.id, placeRevisionMedia.mediaId),
      isNull(media.deletedAt),
    ))
    .where(inArray(placeRevisionMedia.placeRevisionId, revisionIds))
    .orderBy(
      asc(placeRevisionMedia.placeRevisionId),
      asc(placeRevisionMedia.sortOrder),
      asc(media.id),
    );

  return rows.map((row) => {
    const selected = selectTranslation(
      translationRows
        .filter((translation) => translation.revisionId === row.revisionId)
        .map((translation) => ({
          locale: translation.locale,
          value: {
            name: translation.name,
            tagline: translation.tagline,
            description: translation.description,
          },
        })),
      requestedLanguage,
      row.primaryLocale,
    );
    const publicMedia = mediaRows
      .filter((item) => item.revisionId === row.revisionId)
      .map((item) => ({
        id: item.id,
        url: publicMediaUrl(item.id),
        altText: item.altText,
        sortOrder: item.sortOrder,
        isCover: item.isCover,
      }));
    return {
      id: row.id,
      legacyId: row.legacyId,
      slug: row.slug,
      name: selected.value.name,
      tagline: selected.value.tagline,
      description: selected.value.description,
      requestedLanguage,
      contentLanguage: selected.locale,
      address: row.address,
      district: row.district,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      twoGisUrl: row.twoGisUrl,
      phone: row.phone,
      websiteUrl: row.websiteUrl,
      instagramUrl: row.instagramUrl,
      priceLevel: row.priceLevel,
      openingHours: row.openingHours,
      editorialTags: row.editorialTags,
      featuredRank: row.featuredRank,
      categoryIds: categoryRows
        .filter((item) => item.revisionId === row.revisionId)
        .map((item) => item.categoryId),
      coverImageUrl: publicMedia.find((item) => item.isCover)?.url ?? null,
      media: publicMedia,
    };
  });
}

export async function listCategories(input: {
  locale: SupportedLocale;
}): Promise<PublicCategory[]> {
  const rows = await db.select({
    id: categories.id,
    legacyId: categories.legacyId,
    slug: categories.slug,
    revisionId: categoryRevisions.id,
    primaryLocale: categoryRevisions.primaryLocale,
    displayOrder: categoryRevisions.displayOrder,
    coverMediaId: categoryRevisions.coverMediaId,
  }).from(categories).innerJoin(categoryRevisions, and(
    eq(categoryRevisions.id, categories.publishedRevisionId),
    eq(categoryRevisions.categoryId, categories.id),
  )).where(and(
    eq(categories.status, "published"),
    sql`exists (
      select 1
      from ${categoryTranslations}
      where ${categoryTranslations.categoryRevisionId} = ${categoryRevisions.id}
    )`,
    sql`exists (
      select 1
      from ${media}
      where ${media.id} = ${categoryRevisions.coverMediaId}
        and ${media.deletedAt} is null
    )`,
  )).orderBy(
    asc(categoryRevisions.displayOrder),
    asc(categories.slug),
    asc(categories.id),
  );
  if (rows.length === 0) return [];
  const translationRows = await db.select({
    revisionId: categoryTranslations.categoryRevisionId,
    locale: categoryTranslations.locale,
    name: categoryTranslations.name,
    tagline: categoryTranslations.tagline,
  }).from(categoryTranslations).where(inArray(
    categoryTranslations.categoryRevisionId,
    rows.map((row) => row.revisionId),
  ));

  return rows.map((row) => {
    const selected = selectTranslation(
      translationRows
        .filter((translation) => translation.revisionId === row.revisionId)
        .map((translation) => ({
          locale: translation.locale,
          value: {
            name: translation.name,
            tagline: translation.tagline,
          },
        })),
      input.locale,
      row.primaryLocale,
    );
    const coverMediaId = row.coverMediaId as string;
    return {
      id: row.id,
      legacyId: row.legacyId,
      slug: row.slug,
      name: selected.value.name,
      tagline: selected.value.tagline,
      requestedLanguage: input.locale,
      contentLanguage: selected.locale,
      displayOrder: row.displayOrder,
      coverMediaId,
      coverImageUrl: publicMediaUrl(coverMediaId),
    };
  });
}

export async function listPlaces(input: ListPlacesInput): Promise<Page<PublicPlace>> {
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      limit: "Limit must be an integer from 1 through 50",
    });
  }
  const shape = cursorShape(input);
  const cursor = input.cursor ? decodeCursor(input.cursor, shape) : null;
  const conditions = publishedPlaceConditions();
  if (shape.category) conditions.push(categoryFilter(shape.category));
  if (shape.query) conditions.push(searchFilter(shape.query));
  if (cursor) conditions.push(afterCursor(cursor));

  const rows = await db.select(publicPlaceSelection)
    .from(places)
    .innerJoin(placeRevisions, and(
      eq(placeRevisions.id, places.publishedRevisionId),
      eq(placeRevisions.placeId, places.id),
    ))
    .where(and(...conditions))
    .orderBy(asc(featuredSort), asc(places.slug), asc(places.id))
    .limit(limit + 1) as PlaceIdentityRow[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const data = await hydratePlaces(pageRows, input.locale);
  const last = pageRows.at(-1);

  return {
    data,
    page: {
      hasMore,
      nextCursor: hasMore && last
        ? encodeCursor({
          v: 1,
          kind: "places",
          ...shape,
          rank: last.sortRank,
          slug: last.slug,
          id: last.id,
        })
        : null,
    },
  };
}

export async function getPlaceBySlug(input: {
  slug: string;
  locale: SupportedLocale;
}): Promise<PublicPlace | null> {
  const rows = await db.select(publicPlaceSelection)
    .from(places)
    .innerJoin(placeRevisions, and(
      eq(placeRevisions.id, places.publishedRevisionId),
      eq(placeRevisions.placeId, places.id),
    ))
    .where(and(
      ...publishedPlaceConditions(),
      eq(places.slug, input.slug),
    ))
    .limit(1) as PlaceIdentityRow[];
  return (await hydratePlaces(rows, input.locale))[0] ?? null;
}
