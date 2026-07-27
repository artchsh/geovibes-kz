import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import type { SupportedLanguage } from "@/lib/get-device-language";
import i18n from "@/locales/i18n";

const ONBOARDING_KEY = "geovibes.hasSeenOnboarding";
const SAVED_KEY = "geovibes.savedVenueIds";
const LANGUAGE_KEY = "geovibes.language";

type AppStateValue = {
  ready: boolean;
  hasSeenOnboarding: boolean;
  savedVenueIds: string[];
  language: SupportedLanguage;
  completeOnboarding: () => Promise<void>;
  clearSavedVenues: () => void;
  isVenueSaved: (id: string) => boolean;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  toggleSavedVenue: (id: string) => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [language, setLanguageState] = useState<SupportedLanguage>(
    (i18n.resolvedLanguage as SupportedLanguage) ?? "ru",
  );

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(SAVED_KEY),
      AsyncStorage.getItem(LANGUAGE_KEY),
    ])
      .then(([onboarding, saved, storedLanguage]) => {
        setHasSeenOnboarding(onboarding === "true");
        if (saved) setSavedVenueIds(JSON.parse(saved) as string[]);
        if (
          storedLanguage === "ru" ||
          storedLanguage === "kk" ||
          storedLanguage === "en"
        ) {
          setLanguageState(storedLanguage);
          void i18n.changeLanguage(storedLanguage);
        }
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const completeOnboarding = async () => {
    setHasSeenOnboarding(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, "true").catch(() => undefined);
  };

  const toggleSavedVenue = (id: string) => {
    setSavedVenueIds((current) => {
      const next = current.includes(id)
        ? current.filter((venueId) => venueId !== id)
        : [...current, id];
      void AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(
        () => undefined,
      );
      return next;
    });
  };

  const clearSavedVenues = () => {
    setSavedVenueIds([]);
    void AsyncStorage.removeItem(SAVED_KEY).catch(() => undefined);
  };

  const setLanguage = async (nextLanguage: SupportedLanguage) => {
    setLanguageState(nextLanguage);
    await Promise.all([
      i18n.changeLanguage(nextLanguage),
      AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage),
    ]).catch(() => undefined);
  };

  return (
    <AppStateContext.Provider
      value={{
        ready,
        hasSeenOnboarding,
        savedVenueIds,
        language,
        completeOnboarding,
        clearSavedVenues,
        isVenueSaved: (id) => savedVenueIds.includes(id),
        setLanguage,
        toggleSavedVenue,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used within AppStateProvider");
  return value;
}
