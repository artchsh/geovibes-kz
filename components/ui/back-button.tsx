import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme";

type BackButtonProps = {
  onPress?: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityLabel={t("a11y.back")}
      accessibilityRole="button"
      className="h-11 w-11 items-center justify-center rounded-full bg-darkSurface active:opacity-70"
      onPress={onPress}
    >
      <Ionicons color={colors.white} name="chevron-back" size={24} />
    </Pressable>
  );
}
