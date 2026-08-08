import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
    <View
      className="w-full overflow-hidden rounded-3xl bg-border"
      style={{ aspectRatio: 4 / 3 }}
    >
      <Image
        accessibilityIgnoresInvertColors
        className="h-full w-full"
        contentFit="cover"
        recyclingKey={imageKeys[currentIndex]}
        source={images[imageKeys[currentIndex]]}
        style={{ height: "100%", width: "100%" }}
      />

      <View className="absolute left-3 top-3">
        <Tag label={categoryLabel} variant="dark" />
      </View>

      <Pressable
        accessibilityLabel={
          isSaved ? t("a11y.removeSavedVenue") : t("a11y.saveVenue")
        }
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
            accessibilityLabel={t("a11y.previousImage")}
            accessibilityRole="button"
            className="absolute left-3 top-1/2 h-11 w-11 -translate-y-[22px] items-center justify-center rounded-full bg-darkSurface/80"
            onPress={() => changeImage(-1)}
          >
            <Ionicons color={colors.white} name="chevron-back" size={22} />
          </Pressable>
          <Pressable
            accessibilityLabel={t("a11y.nextImage")}
            accessibilityRole="button"
            className="absolute right-3 top-1/2 h-11 w-11 -translate-y-[22px] items-center justify-center rounded-full bg-darkSurface/80"
            onPress={() => changeImage(1)}
          >
            <Ionicons color={colors.white} name="chevron-forward" size={22} />
          </Pressable>
        </>
      ) : null}

      <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-1.5">
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
