import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";

import { images } from "@/lib/images";
import type { ImageKey } from "@/lib/mock-data";
import { colors } from "@/theme";

type CategoryCardProps = {
  label: string;
  active?: boolean;
  imageKey?: ImageKey;
  onPress?: () => void;
};

const categoryIcons: Partial<
  Record<ImageKey, React.ComponentProps<typeof Ionicons>["name"]>
> = {
  cocktails: "wine-outline",
  burgers: "fast-food-outline",
  disco: "disc-outline",
  clothing: "shirt-outline",
  jewelry: "diamond-outline",
};

export function CategoryCard({
  label,
  active = false,
  imageKey,
  onPress,
}: CategoryCardProps) {
  const iconName = imageKey ? categoryIcons[imageKey] : undefined;
  const imageSource = imageKey ? images[imageKey] : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : {}}
      className={`h-[120px] w-[110px] overflow-hidden rounded-md ${
        active ? "bg-primary" : "bg-border"
      }`}
      onPress={onPress}
    >
      <View className="mx-[5px] h-[88px] overflow-hidden rounded-b-md">
        {imageSource ? (
          <Image
            accessibilityIgnoresInvertColors
            className="h-full w-full"
            resizeMode="cover"
            source={imageSource}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-white/55">
              <Ionicons
                color={active ? colors.white : colors.muted}
                name={iconName ?? "image-outline"}
                size={34}
              />
            </View>
          </View>
        )}
      </View>
      <View className="flex-1 items-center justify-center px-1">
        <Text
          className={`font-sans-medium text-sm ${
            active ? "text-white" : "text-black"
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
