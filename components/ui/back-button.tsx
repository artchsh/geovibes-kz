import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import { colors } from "@/theme";

type BackButtonProps = {
  onPress?: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      className="h-11 w-11 items-center justify-center rounded-full bg-darkSurface"
      onPress={onPress}
    >
      <Ionicons color={colors.white} name="chevron-back" size={24} />
    </Pressable>
  );
}
