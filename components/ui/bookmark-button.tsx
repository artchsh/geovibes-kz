import { Ionicons } from "@expo/vector-icons";
import type { GestureResponderEvent } from "react-native";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme";

type BookmarkButtonProps = {
  saved?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
};

export function BookmarkButton({
  saved = false,
  onPress,
}: BookmarkButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityLabel={
        saved ? t("a11y.removeBookmark") : t("a11y.saveBookmark")
      }
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      className={`h-11 w-11 items-center justify-center rounded-full active:opacity-70 ${
        saved ? "bg-primary" : "bg-darkSurface"
      }`}
      onPress={onPress}
    >
      <Ionicons
        color={colors.white}
        name={saved ? "bookmark" : "bookmark-outline"}
        size={21}
      />
    </Pressable>
  );
}
