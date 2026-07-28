import { AppError } from "@/lib/result";

export const SUPPORTED_LOCALES = ["ru", "kk", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type SelectedTranslation<T> = { locale: SupportedLocale; value: T };

type Translation<T> = {
  locale: SupportedLocale;
  value: T;
};

export function selectTranslation<T>(
  translations: readonly Translation<T>[],
  requested: SupportedLocale,
  primary: SupportedLocale | null,
): SelectedTranslation<T> {
  if (translations.length === 0) {
    throw new AppError("CONTENT_HAS_NO_TRANSLATION", 422);
  }

  const byLocale = new Map(translations.map((translation) => [
    translation.locale,
    translation.value,
  ]));

  for (const locale of [requested, primary, ...SUPPORTED_LOCALES]) {
    if (locale && byLocale.has(locale)) {
      return { locale, value: byLocale.get(locale) as T };
    }
  }

  throw new AppError("CONTENT_HAS_NO_TRANSLATION", 422);
}
