import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { logoHeart, onboardingPhone } from "@/lib/images";
import { useAppState } from "@/lib/app-state";
import { colors, fonts } from "@/theme";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { completeOnboarding } = useAppState();
  const tagline = t("app.tagline").replace(/\. /g, ".\n");
  const [entering, setEntering] = useState(false);

  const enterApp = async () => {
    if (entering) return;
    setEntering(true);
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      className="flex-1 overflow-hidden bg-bg"
      edges={["top", "bottom"]}
    >
      <View className="flex-1 px-4 pb-4 pt-4">
        <View className="flex-row items-center gap-2">
          <Image
            contentFit="contain"
            source={logoHeart}
            style={{ height: 36, width: 36 }}
          />
          <Text
            className="text-xl text-darkSurface"
            style={{ fontFamily: fonts.sansSemiBold }}
          >
            Geo
            <Text style={{ color: colors.primary }}>Vibes</Text>
          </Text>
        </View>

        <Text className="mt-6 font-display text-xl leading-6 text-primary">
          {t("onboarding.slogan").replace("\n", " ")}
        </Text>

        <Text
          className="mt-2 text-darkSurface"
          style={{
            fontFamily: fonts.display,
            fontSize: 52,
            lineHeight: 58,
          }}
        >
          {tagline}
        </Text>

        <View className="mt-3 flex-1 overflow-hidden rounded-3xl bg-pink">
          <View
            className="absolute h-52 w-52 rounded-full bg-primary"
            style={{ left: -72, top: 140, zIndex: 0 }}
          />
          <Image
            contentFit="contain"
            source={onboardingPhone}
            style={{
              bottom: -100,
              height: 520,
              left: -48,
              position: "absolute",
              width: 430,
              zIndex: 1,
            }}
          />
        </View>

        <Pressable
          accessibilityLabel={t("onboarding.cta")}
          accessibilityRole="button"
          className={`mt-4 min-h-14 flex-row items-center justify-between rounded-2xl bg-primary px-5 active:opacity-80 ${
            entering ? "opacity-60" : ""
          }`}
          disabled={entering}
          onPress={() => void enterApp()}
        >
          <Text
            className="text-white"
            style={{
              fontFamily: fonts.displayBold,
              fontSize: 20,
              lineHeight: 24,
            }}
          >
            {t("onboarding.cta")}
          </Text>
          <Ionicons color={colors.white} name="arrow-forward" size={26} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
