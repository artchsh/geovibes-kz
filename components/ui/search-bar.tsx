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
      className="h-12 w-full flex-row items-center rounded-xl border border-border bg-white px-4"
      onPress={onPress}
    >
      <Text className="flex-1 font-sans text-sm text-faint" numberOfLines={1}>
        {placeholder}
      </Text>
      <Ionicons color={colors.faint} name="search" size={20} />
    </Pressable>
  );
}
