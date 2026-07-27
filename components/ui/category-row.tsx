import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { images } from "@/lib/images";
import type { ImageKey } from "@/lib/mock-data";
import { colors } from "@/theme";

type CategoryRowProps = {
  label: string;
  subtitle: string;
  imageKey: ImageKey;
  onPress: () => void;
};

export function CategoryRow({
  label,
  subtitle,
  imageKey,
  onPress,
}: CategoryRowProps) {
  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-[58px] flex-row items-center gap-2 border-b border-border"
      onPress={onPress}
    >
      <Image
        accessibilityIgnoresInvertColors
        className="h-12 w-12 rounded-xl"
        contentFit="cover"
        recyclingKey={imageKey}
        source={images[imageKey]}
        style={{ height: 48, width: 48 }}
      />

      <View className="flex-1">
        <Text
          className="font-sans text-base leading-5 text-black"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className="font-sans text-sm leading-5 text-[#525252]"
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons color={colors.faint} name="chevron-forward" size={18} />
    </Pressable>
  );
}
