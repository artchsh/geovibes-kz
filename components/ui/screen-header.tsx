import type { ReactNode } from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { logoHeart } from "@/lib/images";

type ScreenHeaderProps = {
  titleLines: string[];
  logo?: ReactNode;
};

export function ScreenHeader({ titleLines, logo }: ScreenHeaderProps) {
  return (
    <View className="min-h-[72px] flex-row items-start justify-between">
      <Text className="font-display text-[32px] leading-[34px] text-text">
        {titleLines.join("\n")}
      </Text>
      {logo ?? (
        <Image
          accessibilityIgnoresInvertColors
          className="h-16 w-16 rounded-2xl"
          contentFit="contain"
          source={logoHeart}
          style={{ height: 64, width: 64 }}
        />
      )}
    </View>
  );
}
