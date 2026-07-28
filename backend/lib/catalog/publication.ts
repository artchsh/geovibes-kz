import { AppError } from "@/lib/result";
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/catalog/translation";

export type TranslationMap<T> = Partial<Record<SupportedLocale, T | null>>;

export type PublishOptions = {
  acknowledgeMissingLocales: boolean;
};

export type MissingTranslationWarning = {
  code: "MISSING_TRANSLATIONS";
  missingLocales: SupportedLocale[];
};

export type PublishResult = {
  id: string;
  status: "published";
  publishedRevisionId: string;
  draftRevisionId: string;
  warnings: MissingTranslationWarning[];
};

export function publicationWarnings(
  locales: readonly SupportedLocale[],
  options: PublishOptions,
): MissingTranslationWarning[] {
  if (locales.length !== 1) return [];

  const missingLocales = SUPPORTED_LOCALES.filter((locale) => !locales.includes(locale));
  if (!options.acknowledgeMissingLocales) {
    throw new AppError("MISSING_LOCALES_CONFIRMATION_REQUIRED", 409);
  }
  return [{ code: "MISSING_TRANSLATIONS", missingLocales }];
}

export function validatePublicationTranslations(
  locales: readonly SupportedLocale[],
  primaryLocale: SupportedLocale | null,
): void {
  if (locales.length === 0) {
    throw new AppError("CONTENT_HAS_NO_TRANSLATION", 422);
  }
  if (!primaryLocale || !locales.includes(primaryLocale)) {
    throw new AppError("PRIMARY_LOCALE_TRANSLATION_REQUIRED", 422);
  }
}

export function validateCoordinates(
  latitude: string | null,
  longitude: string | null,
): void {
  const parsedLatitude = latitude === null ? Number.NaN : Number(latitude);
  const parsedLongitude = longitude === null ? Number.NaN : Number(longitude);
  if (
    !Number.isFinite(parsedLatitude)
    || !Number.isFinite(parsedLongitude)
    || parsedLatitude < -90
    || parsedLatitude > 90
    || parsedLongitude < -180
    || parsedLongitude > 180
  ) {
    throw new AppError("INVALID_COORDINATES", 422);
  }
}

const AUDIT_METADATA_KEYS = new Set([
  "revisionNumber",
  "previousPublishedRevisionNumber",
  "status",
]);

export function safeAuditMetadata(
  input: Record<string, string | number | null | undefined>,
): Record<string, string | number | null> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => AUDIT_METADATA_KEYS.has(key) && value !== undefined,
    ),
  ) as Record<string, string | number | null>;
}
