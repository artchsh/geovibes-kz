import { AppError } from "@/lib/result";

type DatabaseError = {
  code?: string;
  constraint?: string;
  cause?: unknown;
};

const CONSTRAINT_ERRORS: Record<string, { code: string; status: number }> = {
  places_slug_unique: { code: "PLACE_SLUG_CONFLICT", status: 409 },
  places_legacy_id_unique: { code: "PLACE_LEGACY_ID_CONFLICT", status: 409 },
  categories_slug_unique: { code: "CATEGORY_SLUG_CONFLICT", status: 409 },
  categories_legacy_id_unique: { code: "CATEGORY_LEGACY_ID_CONFLICT", status: 409 },
  place_revision_categories_revision_category_unique: {
    code: "DUPLICATE_CATEGORY_ASSIGNMENT",
    status: 422,
  },
  place_revision_media_revision_media_unique: {
    code: "DUPLICATE_MEDIA_ASSIGNMENT",
    status: 422,
  },
  place_revision_media_revision_sort_unique: {
    code: "DUPLICATE_MEDIA_SORT_ORDER",
    status: 422,
  },
  place_revision_media_one_cover_unique: {
    code: "MULTIPLE_COVER_MEDIA",
    status: 422,
  },
  place_revision_categories_category_id_categories_id_fk: {
    code: "CATEGORY_REFERENCE_INVALID",
    status: 422,
  },
  place_revision_media_media_id_media_id_fk: {
    code: "MEDIA_REFERENCE_INVALID",
    status: 422,
  },
  category_revisions_cover_media_id_media_id_fk: {
    code: "MEDIA_REFERENCE_INVALID",
    status: 422,
  },
};

function findDatabaseError(error: unknown): DatabaseError | null {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return null;
    const candidate = current as DatabaseError;
    if (candidate.code) return candidate;
    current = candidate.cause;
  }
  return null;
}

export function mapCatalogDatabaseError(error: unknown): Error {
  if (error instanceof AppError) return error;
  const databaseError = findDatabaseError(error);
  if (!databaseError) return error instanceof Error
    ? error
    : new AppError("CATALOG_WRITE_FAILED", 500);

  if (databaseError.constraint) {
    const mapped = CONSTRAINT_ERRORS[databaseError.constraint];
    if (mapped) return new AppError(mapped.code, mapped.status);
  }
  if (databaseError.code === "23505") return new AppError("CATALOG_CONFLICT", 409);
  if (databaseError.code === "23503") {
    return new AppError("CATALOG_REFERENCE_INVALID", 422);
  }
  if (databaseError.code === "22P02") return new AppError("INVALID_IDENTIFIER", 422);
  return new AppError("CATALOG_WRITE_FAILED", 500);
}

export async function catalogTransaction<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapCatalogDatabaseError(error);
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireTargetUuid(value: string, notFoundCode: string): void {
  if (!UUID_PATTERN.test(value)) throw new AppError(notFoundCode, 404);
}

export function requireReferenceUuid(value: string, invalidCode: string): void {
  if (!UUID_PATTERN.test(value)) throw new AppError(invalidCode, 422);
}
