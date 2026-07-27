import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { BookmarkButton } from "@/components/ui/bookmark-button";
import { RatingPill } from "@/components/ui/rating-pill";
import { Tag } from "@/components/ui/tag";
import { images } from "@/lib/images";
import type { ImageKey } from "@/lib/mock-data";
import { colors } from "@/theme";

type PlaceCardTallProps = {
  title: string;
  subtitle: string;
  rating: number;
  tag?: string;
  imageKey?: ImageKey;
  onPress?: () => void;
};

const placeholderColors: Record<ImageKey, string> = {
  operation: "#d9e4e5",
  cooperative: "#dce88a",
  cocktails: "#dce88a",
  burgers: "#efd7ad",
  disco: "#d9d9e2",
  clothing: "#d8d3cb",
  jewelry: "#ead9d7",
  atelier: "#ddd6c9",
  rooftop: "#cbd9df",
};

export function PlaceCardTall({
  title,
  subtitle,
  rating,
  tag,
  imageKey = "operation",
  onPress,
}: PlaceCardTallProps) {
  const [saved, setSaved] = useState(false);
  const imageSource = images[imageKey];

  return (
    <Pressable
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityRole="button"
      className="w-full"
      onPress={onPress}
    >
      <View
        className="w-full overflow-hidden rounded-2xl"
        style={{
          aspectRatio: 345 / 204,
          backgroundColor: placeholderColors[imageKey],
        }}
      >
        {imageSource ? (
          <Image
            accessibilityIgnoresInvertColors
            className="h-full w-full"
            resizeMode="cover"
            source={imageSource}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-white/45">
              <Ionicons color={colors.muted} name="location-outline" size={34} />
              <Text className="mt-1 font-sans-semibold text-xs text-muted">
                {title.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        <View className="absolute left-2 top-2 items-start gap-2">
          <RatingPill rating={rating} />
          {tag ? <Tag label={tag} /> : null}
        </View>

        <View className="absolute right-2 top-2">
          <BookmarkButton
            onPress={(event) => {
              event.stopPropagation();
              setSaved((current) => !current);
            }}
            saved={saved}
          />
        </View>
      </View>

      <View className="gap-0.5 pt-2">
        <Text
          className="font-sans text-base leading-5 text-black"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="font-sans text-sm leading-[19px] text-[#525252]"
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
