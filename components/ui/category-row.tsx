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
      className="min-h-[92px] flex-row items-center gap-3 rounded-2xl bg-white p-2 active:opacity-70"
      onPress={onPress}
    >
      <Image
        accessibilityIgnoresInvertColors
        className="h-[76px] w-[76px] rounded-xl"
        contentFit="cover"
        recyclingKey={imageKey}
        source={images[imageKey]}
        style={{ height: 76, width: 76 }}
      />

      <View className="flex-1">
        <Text
          className="font-sans-semibold text-base leading-5 text-darkSurface"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className="font-sans text-[13px] leading-5 text-muted"
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>

      <View className="h-11 w-8 items-center justify-center">
        <Ionicons color={colors.faint} name="chevron-forward" size={20} />
      </View>
    </Pressable>
  );
}
