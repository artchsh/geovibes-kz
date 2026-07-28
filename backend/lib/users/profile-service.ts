import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
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
  savedPlaces,
  userInterests,
  users,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { normalizeUsername } from "@/lib/auth/username";

export type SupportedLocale = "ru" | "kk" | "en";

export type PublicProfile = {
  id: string;
  username: string;
  preferredLocale: SupportedLocale;
  onboardingCompleted: boolean;
  interestCategoryIds: string[];
};

export type UpdateProfileInput = {
  username?: string;
  preferredLocale?: SupportedLocale;
  onboardingCompleted?: boolean;
  interestCategoryIds?: string[];
};

export type MergeGuestInput = {
  savedPlaceIds: string[];
  interestCategoryIds?: string[];
};

export type GuestState = {
  savedPlaceIds: string[];
  interestCategoryIds: string[];
};

// Two full 100-UUID collections serialize below the shared 8 KiB JSON cap.
// Keep these limits coordinated with AUTH_JSON_BODY_LIMIT_BYTES.
const MAX_INTERESTS = 100;
const MAX_SAVED_PLACES_PER_MERGE = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Transaction;

function invalidInput(field: string, message: string): never {
  throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
    [field]: message,
  });
}


export function requireValidUserId(userId: string): void {
  if (!UUID_PATTERN.test(userId)) {
    throw new ApiError("INVALID_REQUEST", 400, "Request validation failed", {
      userId: "Must be a valid UUID",
    });
  }
}
function validateIds(
  values: string[],
  field: string,
  maximum: number,
): string[] {
  if (values.length > maximum) {
    invalidInput(field, `Must contain at most ${maximum} IDs`);
  }
  if (values.some((value) => !UUID_PATTERN.test(value))) {
    invalidInput(field, "Must contain valid UUIDs");
  }
  if (new Set(values).size !== values.length) {
    invalidInput(field, "Must not contain duplicate IDs");
  }
  return [...values].sort();
}

function publicCategoryCondition(): SQL {
  return sql`exists (
    select 1
    from ${categoryRevisions}
    inner join ${media}
      on ${media.id} = ${categoryRevisions.coverMediaId}
      and ${media.deletedAt} is null
    where ${categoryRevisions.id} = ${categories.publishedRevisionId}
      and ${categoryRevisions.categoryId} = ${categories.id}
      and exists (
        select 1
        from ${categoryTranslations}
        where ${categoryTranslations.categoryRevisionId} = ${categoryRevisions.id}
      )
  )`;
}

function publicPlaceCondition(): SQL {
  return sql`exists (
    select 1
    from ${placeRevisions}
    where ${placeRevisions.id} = ${places.publishedRevisionId}
      and ${placeRevisions.placeId} = ${places.id}
      and ${placeRevisions.latitude} is not null
      and ${placeRevisions.latitude} between -90 and 90
      and ${placeRevisions.longitude} is not null
      and ${placeRevisions.longitude} between -180 and 180
      and exists (
        select 1
        from ${placeTranslations}
        where ${placeTranslations.placeRevisionId} = ${placeRevisions.id}
      )
      and exists (
        select 1
        from ${placeRevisionMedia}
        inner join ${media}
          on ${media.id} = ${placeRevisionMedia.mediaId}
          and ${media.deletedAt} is null
        where ${placeRevisionMedia.placeRevisionId} = ${placeRevisions.id}
          and ${placeRevisionMedia.isCover} = true
      )
  )`;
}

async function assertPublicCategories(
  executor: Executor,
  categoryIds: string[],
  code = "CATEGORY_NOT_PUBLIC",
): Promise<void> {
  if (categoryIds.length === 0) return;
  const rows = await executor.select({ id: categories.id })
    .from(categories)
    .where(and(
      inArray(categories.id, categoryIds),
      eq(categories.status, "published"),
      publicCategoryCondition(),
    ))
    .orderBy(asc(categories.id))
    .for("share");
  if (rows.length !== categoryIds.length) {
    throw new ApiError(code, 422, "One or more category references are unavailable");
  }
}

async function assertPublicPlaces(
  executor: Executor,
  placeIds: string[],
  code = "PLACE_NOT_PUBLIC",
): Promise<void> {
  if (placeIds.length === 0) return;
  const rows = await executor.select({ id: places.id })
    .from(places)
    .where(and(
      inArray(places.id, placeIds),
      eq(places.status, "published"),
      publicPlaceCondition(),
    ))
    .orderBy(asc(places.id))
    .for("share");
  if (rows.length !== placeIds.length) {
    throw new ApiError(code, 422, "One or more place references are unavailable");
  }
}

async function replaceInterests(
  executor: Transaction,
  userId: string,
  categoryIds: string[],
): Promise<void> {
  await assertPublicCategories(executor, categoryIds);
  await executor.delete(userInterests).where(eq(userInterests.userId, userId));
  if (categoryIds.length > 0) {
    await executor.insert(userInterests).values(
      categoryIds.map((categoryId) => ({ userId, categoryId })),
    );
  }
}

async function lockUser(
  executor: Transaction,
  userId: string,
): Promise<void> {
  // All Task 7 writes lock in user -> sorted catalog identity order.
  // Catalog lifecycle writes take FOR UPDATE on the same identities.
  const [user] = await executor.select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for("update")
    .limit(1);
  if (!user) {
    throw new ApiError("AUTH_REQUIRED", 401, "Authentication required");
  }
}

async function profileFrom(
  executor: Executor,
  userId: string,
): Promise<PublicProfile> {
  const [user] = await executor.select({
    id: users.id,
    username: users.displayUsername,
    preferredLocale: users.preferredLocale,
    onboardingCompletedAt: users.onboardingCompletedAt,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new ApiError("AUTH_REQUIRED", 401, "Authentication required");
  }
  const interests = await executor.select({ id: userInterests.categoryId })
    .from(userInterests)
    .where(eq(userInterests.userId, userId))
    .orderBy(asc(userInterests.categoryId));
  return {
    id: user.id,
    username: user.username,
    preferredLocale: user.preferredLocale,
    onboardingCompleted: user.onboardingCompletedAt !== null,
    interestCategoryIds: interests.map(({ id }) => id),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === "23505" || candidate.cause?.code === "23505";
}

export function getProfile(userId: string): Promise<PublicProfile> {
  requireValidUserId(userId);
  return db.transaction(
    (transaction) => profileFrom(transaction, userId),
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
}

export async function setInterests(
  userId: string,
  interestCategoryIds: string[],
): Promise<string[]> {
  requireValidUserId(userId);
  const ids = validateIds(
    interestCategoryIds,
    "interestCategoryIds",
    MAX_INTERESTS,
  );
  return db.transaction(async (transaction) => {
    await lockUser(transaction, userId);
    await replaceInterests(transaction, userId, ids);
    return ids;
  });
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicProfile> {
  requireValidUserId(userId);
  let username:
    | { normalizedUsername: string; displayUsername: string }
    | undefined;
  if (input.username !== undefined) {
    try {
      username = {
        normalizedUsername: normalizeUsername(input.username),
        displayUsername: input.username.trim(),
      };
    } catch {
      invalidInput(
        "username",
        "Username must use 3-30 letters, numbers, dots, or underscores",
      );
    }
  }
  const interestIds = input.interestCategoryIds === undefined
    ? undefined
    : validateIds(input.interestCategoryIds, "interestCategoryIds", MAX_INTERESTS);

  try {
    return await db.transaction(async (transaction) => {
      await lockUser(transaction, userId);
      if (interestIds !== undefined) {
        await replaceInterests(transaction, userId, interestIds);
      }
      const update: Partial<typeof users.$inferInsert> = {};
      if (username) Object.assign(update, username);
      if (input.preferredLocale !== undefined) {
        update.preferredLocale = input.preferredLocale;
      }
      if (input.onboardingCompleted !== undefined) {
        update.onboardingCompletedAt = input.onboardingCompleted ? new Date() : null;
      }
      if (Object.keys(update).length > 0) {
        update.updatedAt = new Date();
        await transaction.update(users).set(update).where(eq(users.id, userId));
      }
      return profileFrom(transaction, userId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("USERNAME_UNAVAILABLE", 409, "Username is unavailable");
    }
    throw error;
  }
}

export async function mergeGuestState(
  userId: string,
  input: MergeGuestInput,
): Promise<GuestState> {
  requireValidUserId(userId);
  const placeIds = validateIds(
    input.savedPlaceIds,
    "savedPlaceIds",
    MAX_SAVED_PLACES_PER_MERGE,
  );
  const interestIds = input.interestCategoryIds === undefined
    ? undefined
    : validateIds(input.interestCategoryIds, "interestCategoryIds", MAX_INTERESTS);

  return db.transaction(async (transaction) => {
    await lockUser(transaction, userId);
    try {
      await assertPublicPlaces(
        transaction,
        placeIds,
        "INVALID_CATALOG_REFERENCE",
      );
      if (interestIds !== undefined) {
        await assertPublicCategories(
          transaction,
          interestIds,
          "INVALID_CATALOG_REFERENCE",
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_CATALOG_REFERENCE") {
        throw error;
      }
      throw error;
    }

    if (placeIds.length > 0) {
      await transaction.insert(savedPlaces).values(
        placeIds.map((placeId) => ({ userId, placeId })),
      ).onConflictDoNothing();
    }
    if (interestIds !== undefined) {
      await transaction.delete(userInterests)
        .where(eq(userInterests.userId, userId));
      if (interestIds.length > 0) {
        await transaction.insert(userInterests).values(
          interestIds.map((categoryId) => ({ userId, categoryId })),
        );
      }
    }

    const [saved, interests] = await Promise.all([
      transaction.select({ id: savedPlaces.placeId })
        .from(savedPlaces)
        .where(eq(savedPlaces.userId, userId))
        .orderBy(asc(savedPlaces.placeId)),
      transaction.select({ id: userInterests.categoryId })
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .orderBy(asc(userInterests.categoryId)),
    ]);
    return {
      savedPlaceIds: saved.map(({ id }) => id),
      interestCategoryIds: interests.map(({ id }) => id),
    };
  });
}

export const profileLimits = {
  maxInterests: MAX_INTERESTS,
  maxSavedPlacesPerMerge: MAX_SAVED_PLACES_PER_MERGE,
} as const;

export const catalogReferenceValidation = {
  assertPublicPlaces,
  lockUser,
} as const;
