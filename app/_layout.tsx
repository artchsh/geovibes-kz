import "../global.css";
import "@/locales/i18n";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import {
  Oswald_400Regular,
  Oswald_700Bold,
  useFonts as useOswaldFonts,
} from "@expo-google-fonts/oswald";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [oswaldLoaded, oswaldError] = useOswaldFonts({
    Oswald_400Regular,
    Oswald_700Bold,
  });

  const fontsLoaded = interLoaded && oswaldLoaded;
  const fontError = interError ?? oswaldError;

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="space/[id]" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </>
  );
}
