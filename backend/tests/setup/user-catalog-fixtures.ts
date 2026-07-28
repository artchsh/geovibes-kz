import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  categories,
  categoryRevisions,
  categoryTranslations,
  media,
  placeRevisionMedia,
  placeRevisions,
  places,
  placeTranslations,
  users,
} from "@/db/schema";
import { createSession } from "@/lib/auth/session";

let sequence = 0;

function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export async function userFixture(
  values: Partial<typeof users.$inferInsert> = {},
) {
  const username = unique("user");
  const [user] = await db.insert(users).values({
    normalizedUsername: username,
    displayUsername: username,
    ...values,
  }).returning();
  return user;
}

export async function sessionFixture(
  userId: string,
): Promise<{ token: string; cookie: string }> {
  const { token } = await createSession(userId, {
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  });
  return { token, cookie: `geovibes_session=${token}` };
}

export async function categoryFixture(options: {
  status?: "draft" | "published" | "archived";
  corrupt?: "pointer" | "translation" | "cover";
} = {}) {
  const slug = unique("category");
  const [category] = await db.insert(categories).values({
    slug,
    status: options.status ?? "published",
  }).returning();
  const [cover] = await db.insert(media).values({
    storageKey: unique("category-cover"),
    mimeType: "image/webp",
    width: 100,
    height: 100,
    byteSize: 100,
    deletedAt: options.corrupt === "cover" ? new Date() : null,
  }).returning();
  const [revision] = await db.insert(categoryRevisions).values({
    categoryId: category.id,
    revisionNumber: 1,
    primaryLocale: "ru",
    coverMediaId: cover.id,
  }).returning();
  if (options.corrupt !== "translation") {
    await db.insert(categoryTranslations).values({
      categoryRevisionId: revision.id,
      locale: "ru",
      name: slug,
    });
  }
  let pointer = revision.id;
  if (options.corrupt === "pointer") {
    const [other] = await db.insert(categories).values({ slug: unique("other-category") }).returning();
    const [foreignRevision] = await db.insert(categoryRevisions).values({
      categoryId: other.id,
      revisionNumber: 1,
    }).returning();
    pointer = foreignRevision.id;
  }
  await db.update(categories).set({ publishedRevisionId: pointer })
    .where(eq(categories.id, category.id));
  return category;
}

export async function placeFixture(options: {
  status?: "draft" | "published" | "archived";
  corrupt?: "pointer" | "translation" | "cover" | "coordinates";
} = {}) {
  const slug = unique("place");
  const [place] = await db.insert(places).values({
    slug,
    status: options.status ?? "published",
  }).returning();
  const [revision] = await db.insert(placeRevisions).values({
    placeId: place.id,
    revisionNumber: 1,
    primaryLocale: "ru",
    latitude: options.corrupt === "coordinates" ? null : "43.238949",
    longitude: "76.889709",
  }).returning();
  if (options.corrupt !== "translation") {
    await db.insert(placeTranslations).values({
      placeRevisionId: revision.id,
      locale: "ru",
      name: slug,
    });
  }
  const [cover] = await db.insert(media).values({
    storageKey: unique("place-cover"),
    mimeType: "image/webp",
    width: 100,
    height: 100,
    byteSize: 100,
    deletedAt: options.corrupt === "cover" ? new Date() : null,
  }).returning();
  await db.insert(placeRevisionMedia).values({
    placeRevisionId: revision.id,
    mediaId: cover.id,
    sortOrder: 0,
    isCover: true,
  });
  let pointer = revision.id;
  if (options.corrupt === "pointer") {
    const [other] = await db.insert(places).values({ slug: unique("other-place") }).returning();
    const [foreignRevision] = await db.insert(placeRevisions).values({
      placeId: other.id,
      revisionNumber: 1,
    }).returning();
    pointer = foreignRevision.id;
  }
  await db.update(places).set({ publishedRevisionId: pointer })
    .where(eq(places.id, place.id));
  return place;
}
