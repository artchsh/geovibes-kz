import type { ReactNode } from "react";
import { Image, Text, View } from "react-native";

import { logoHeart } from "@/lib/images";

type ScreenHeaderProps = {
  titleLines: string[];
  logo?: ReactNode;
};

export function ScreenHeader({ titleLines, logo }: ScreenHeaderProps) {
  return (
    <View className="h-16 flex-row items-start justify-between">
      <Text className="font-display text-[32px] leading-[32px] text-text">
        {titleLines.join("\n")}
      </Text>
      {logo ?? (
        <Image
          accessibilityIgnoresInvertColors
          className="h-16 w-16 rounded-2xl"
          resizeMode="contain"
          source={logoHeart}
        />
      )}
    </View>
  );
}
