import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { onboardingPhone } from "@/lib/images";
import { colors, fonts } from "@/theme";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const tagline = t("app.tagline").replace(/\. /g, ".\n");

  const enterApp = () => {
    // TODO: first-run gating (AsyncStorage hasSeenOnboarding) later
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-1 px-4 pt-3">
        <View className="flex-row items-center gap-1">
          <View className="h-8 w-8 rounded-lg bg-primary" />
          <Text
            className="text-xl text-black"
            style={{ fontFamily: fonts.sansSemiBold }}
          >
            Geo
            <Text style={{ color: colors.primary }}>Vibes</Text>
          </Text>
        </View>

        <Text
          className="mt-5 text-black"
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            lineHeight: 74,
          }}
        >
          {tagline}
        </Text>

        <View className="mt-2 flex-row items-center justify-between">
          <Text
            className="text-black"
            style={{
              fontFamily: fonts.display,
              fontSize: 20,
              lineHeight: 20,
            }}
          >
            {t("onboarding.slogan")}
          </Text>

          <Pressable
            accessibilityLabel={t("onboarding.cta")}
            accessibilityRole="button"
            className="flex-row items-center gap-1 rounded-xl bg-primary px-2.5 py-2 active:opacity-80"
            onPress={enterApp}
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
            <Ionicons color={colors.white} name="arrow-forward" size={28} />
          </Pressable>
        </View>

        <View className="mt-2 flex-1">
          <View
            className="absolute h-[200px] w-[200px] rounded-full bg-[#ff0000]"
            style={{ left: -72, top: 226, zIndex: 0 }}
          />
          <Image
            resizeMode="contain"
            source={onboardingPhone}
            style={{
              height: 690,
              left: -145,
              position: "absolute",
              top: 0,
              width: 560,
              zIndex: 1,
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
