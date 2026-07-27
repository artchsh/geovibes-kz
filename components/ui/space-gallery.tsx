import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { Tag } from "@/components/ui/tag";
import { images } from "@/lib/images";
import type { ImageKey } from "@/lib/mock-data";
import { colors } from "@/theme";

type SpaceGalleryProps = {
  imageKeys: ImageKey[];
  categoryLabel: string;
  isSaved: boolean;
  onToggleSaved: () => void;
};

export function SpaceGallery({
  imageKeys,
  categoryLabel,
  isSaved,
  onToggleSaved,
}: SpaceGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const hasMultipleImages = imageKeys.length > 1;

  const changeImage = (offset: number) => {
    setCurrentIndex((index) => {
      return (index + offset + imageKeys.length) % imageKeys.length;
    });
  };

  if (imageKeys.length === 0) {
    return null;
  }

  return (
    <View className="h-[271px] w-full overflow-hidden rounded-[20px] bg-border">
      <Image
        accessibilityIgnoresInvertColors
        className="h-full w-full"
        contentFit="cover"
        recyclingKey={imageKeys[currentIndex]}
        source={images[imageKeys[currentIndex]]}
        style={{ height: "100%", width: "100%" }}
      />

      <View className="absolute left-2 top-2">
        <Tag label={categoryLabel} variant="dark" />
      </View>

      <Pressable
        accessibilityLabel={isSaved ? "Remove from saved" : "Save venue"}
        accessibilityRole="button"
        className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-darkSurface"
        hitSlop={6}
        onPress={onToggleSaved}
      >
        <Ionicons
          color={colors.white}
          name={isSaved ? "heart" : "heart-outline"}
          size={24}
        />
      </Pressable>

      {hasMultipleImages ? (
        <>
          <Pressable
            accessibilityLabel="Previous image"
            accessibilityRole="button"
            className="absolute left-2 top-1/2 h-6 w-6 -translate-y-3 items-center justify-center rounded-full bg-[#b93b36]"
            hitSlop={8}
            onPress={() => changeImage(-1)}
          >
            <Ionicons color={colors.white} name="chevron-back" size={16} />
          </Pressable>
          <Pressable
            accessibilityLabel="Next image"
            accessibilityRole="button"
            className="absolute right-2 top-1/2 h-6 w-6 -translate-y-3 items-center justify-center rounded-full bg-[#b93b36]"
            hitSlop={8}
            onPress={() => changeImage(1)}
          >
            <Ionicons color={colors.white} name="chevron-forward" size={16} />
          </Pressable>
        </>
      ) : null}

      <View className="absolute bottom-2.5 left-0 right-0 flex-row justify-center gap-1.5">
        {imageKeys.map((imageKey, index) => (
          <View
            className={`h-2 w-2 rounded-full ${
              index === currentIndex ? "bg-white" : "bg-[#eeeeee]"
            }`}
            key={`${imageKey}-${index}`}
          />
        ))}
      </View>
    </View>
  );
}
