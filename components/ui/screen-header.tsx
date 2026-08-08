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
    <View className="min-h-14 flex-row items-start justify-between gap-4">
      <Text className="min-w-0 flex-1 font-display text-[36px] leading-10 text-darkSurface">
        {titleLines.join("\n")}
      </Text>
      {logo ?? (
        <Image
          accessibilityIgnoresInvertColors
          className="h-12 w-12 rounded-2xl"
          contentFit="contain"
          source={logoHeart}
          style={{ height: 48, width: 48 }}
        />
      )}
    </View>
  );
}
