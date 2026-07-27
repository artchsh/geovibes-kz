import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { getDeviceLanguage } from "@/lib/get-device-language";
import en from "./en.json";
import kk from "./kk.json";
import ru from "./ru.json";

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: getDeviceLanguage(),
  fallbackLng: "ru",
  supportedLngs: ["ru", "kk", "en"],
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
