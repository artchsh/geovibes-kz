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
      className="h-9 w-9 items-center justify-center rounded-full bg-darkSurface"
      hitSlop={8}
      onPress={onPress}
    >
      <Ionicons color={colors.white} name="chevron-back" size={22} />
    </Pressable>
  );
}
