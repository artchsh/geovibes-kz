import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppState } from "@/lib/app-state";
import type { SupportedLanguage } from "@/lib/get-device-language";
import { colors } from "@/theme";

const languages: { code: SupportedLanguage; label: string }[] = [
  { code: "ru", label: "Русский" },
  { code: "kk", label: "Қазақша" },
  { code: "en", label: "English" },
];

type SettingsRowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
};

function SettingsRow({
  icon,
  label,
  description,
  onPress,
  trailing,
  destructive = false,
  disabled = false,
}: SettingsRowProps) {
  const content = (
    <>
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          destructive ? "bg-pink" : "bg-white"
        }`}
      >
        <Ionicons
          color={destructive ? colors.primary : colors.darkSurface}
          name={icon}
          size={20}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`font-sans-semibold text-sm ${
            destructive ? "text-primary" : "text-darkSurface"
          }`}
        >
          {label}
        </Text>
        {description ? (
          <Text className="mt-0.5 font-sans text-xs leading-4 text-muted">
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Ionicons color={colors.faint} name="chevron-forward" size={20} />
        ) : null)}
    </>
  );

  if (!onPress) {
    return <View className="min-h-14 flex-row items-center gap-3 p-3">{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-14 flex-row items-center gap-3 p-3 active:opacity-70 ${
        disabled ? "opacity-40" : ""
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-3 font-sans-bold text-xs uppercase tracking-wider text-muted">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    clearSavedVenues,
    language,
    savedVenueIds,
    setLanguage,
  } = useAppState();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const confirmClearSaved = () => {
    if (!savedVenueIds.length) return;
    Alert.alert(t("settings.clearConfirmTitle"), t("settings.clearConfirmBody"), [
      { style: "cancel", text: t("settings.cancel") },
      {
        style: "destructive",
        text: t("settings.clearAction"),
        onPress: clearSavedVenues,
      },
    ]);
  };

  const sendEmail = (subject: string) => {
    void Linking.openURL(
      `mailto:geovibeskz@protonmail.com?subject=${encodeURIComponent(subject)}`,
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 112 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-8 px-4 pt-4">
          <ScreenHeader titleLines={[t("settings.title")]} />

          <View>
            <SectionTitle>{t("settings.languageTitle")}</SectionTitle>
            <View className="flex-row gap-1 rounded-2xl bg-white p-1.5">
              {languages.map((item) => {
                const selected = language === item.code;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-11 flex-1 items-center justify-center rounded-xl px-2 ${
                      selected ? "bg-primary" : "bg-transparent"
                    }`}
                    key={item.code}
                    onPress={() => void setLanguage(item.code)}
                  >
                    <Text
                      className={`font-sans-semibold text-xs ${
                        selected ? "text-white" : "text-darkSurface"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <SectionTitle>{t("settings.placeTitle")}</SectionTitle>
            <View className="overflow-hidden rounded-2xl bg-[#edf5bb]">
              <SettingsRow
                description={t("settings.cityDescription")}
                icon="location"
                label={t("settings.cityLabel")}
                trailing={
                  <View className="rounded-full bg-white px-3 py-1.5">
                    <Text className="font-sans-bold text-xs text-darkSurface">
                      {t("settings.onlyCity")}
                    </Text>
                  </View>
                }
              />
            </View>
          </View>

          <View>
            <SectionTitle>{t("settings.dataTitle")}</SectionTitle>
            <View className="overflow-hidden rounded-2xl bg-white">
              <SettingsRow
                description={t("settings.savedDescription", {
                  count: savedVenueIds.length,
                })}
                icon="bookmark"
                label={t("settings.savedLabel")}
                trailing={
                  <View className="h-8 min-w-8 items-center justify-center rounded-full bg-white px-2">
                    <Text className="font-sans-bold text-xs text-primary">
                      {savedVenueIds.length}
                    </Text>
                  </View>
                }
              />
              <View className="ml-[64px] h-px bg-border" />
              <SettingsRow
                destructive
                disabled={!savedVenueIds.length}
                icon="trash-outline"
                label={t("settings.clearSaved")}
                onPress={confirmClearSaved}
              />
            </View>
          </View>

          <View>
            <SectionTitle>{t("settings.contactTitle")}</SectionTitle>
            <View className="overflow-hidden rounded-2xl bg-white">
              <SettingsRow
                description={t("settings.suggestDescription")}
                icon="add-circle-outline"
                label={t("settings.suggestPlace")}
                onPress={() => sendEmail(t("settings.suggestSubject"))}
              />
              <View className="ml-[64px] h-px bg-border" />
              <SettingsRow
                description="geovibeskz@protonmail.com"
                icon="mail-outline"
                label={t("settings.feedback")}
                onPress={() => sendEmail(t("settings.feedbackSubject"))}
              />
            </View>
          </View>

          <View className="items-center rounded-3xl bg-white px-6 py-8">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary">
              <Ionicons color={colors.white} name="heart" size={24} />
            </View>
            <Text className="mt-3 font-display text-2xl text-darkSurface">
              GeoVibes
            </Text>
            <Text className="mt-1 text-center font-sans text-sm leading-5 text-[#525252]">
              {t("settings.about")}
            </Text>
            <Text className="mt-3 font-sans-semibold text-xs text-muted">
              {t("settings.version", { version })}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
