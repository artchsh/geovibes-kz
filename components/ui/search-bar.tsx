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
      className="h-9 w-full flex-row items-center rounded-md border border-border bg-white px-3"
      onPress={onPress}
    >
      <Text className="flex-1 font-sans text-sm text-faint" numberOfLines={1}>
        {placeholder}
      </Text>
      <Ionicons color={colors.faint} name="search" size={17} />
    </Pressable>
  );
}
