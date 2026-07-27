import { getLocales } from "expo-localization";

export type SupportedLanguage = "ru" | "kk" | "en";

const supportedLanguages: SupportedLanguage[] = ["ru", "kk", "en"];

export function getDeviceLanguage(): SupportedLanguage {
  const languageCode = getLocales()[0]?.languageCode;

  return supportedLanguages.includes(languageCode as SupportedLanguage)
    ? (languageCode as SupportedLanguage)
    : "ru";
}
