import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";

import { colors } from "@/theme";

type SearchBarProps = {
  placeholder: string;
  onPress?: () => void;
};

export function SearchBar({ placeholder, onPress }: SearchBarProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      className="h-14 w-full flex-row items-center gap-3 rounded-2xl bg-white px-4 active:opacity-70"
      onPress={onPress}
    >
      <Ionicons color={colors.muted} name="search" size={20} />
      <Text className="flex-1 font-sans text-sm text-muted" numberOfLines={1}>
        {placeholder}
      </Text>
      <Ionicons color={colors.faint} name="arrow-forward" size={18} />
    </Pressable>
  );
}
