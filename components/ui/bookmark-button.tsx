import { Ionicons } from "@expo/vector-icons";
import type { GestureResponderEvent } from "react-native";
import { Pressable } from "react-native";

import { colors } from "@/theme";

type BookmarkButtonProps = {
  saved?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
};

export function BookmarkButton({
  saved = false,
  onPress,
}: BookmarkButtonProps) {
  return (
    <Pressable
      accessibilityLabel={saved ? "Remove bookmark" : "Save bookmark"}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      className="h-11 w-11 items-center justify-center rounded-full bg-darkSurface"
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
