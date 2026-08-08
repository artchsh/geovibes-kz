import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { BookmarkButton } from "@/components/ui/bookmark-button";
import { RatingPill } from "@/components/ui/rating-pill";
import { Tag } from "@/components/ui/tag";
import { images } from "@/lib/images";
import { useAppState } from "@/lib/app-state";
import type { ImageKey } from "@/lib/mock-data";
import { colors } from "@/theme";

type PlaceCardTallProps = {
  id: string;
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
  id,
  title,
  subtitle,
  rating,
  tag,
  imageKey = "operation",
  onPress,
}: PlaceCardTallProps) {
  const { isVenueSaved, toggleSavedVenue } = useAppState();
  const saved = isVenueSaved(id);
  const imageSource = images[imageKey];

  return (
    <View className="w-full">
      <Pressable
        accessibilityLabel={`${title}. ${subtitle}`}
        accessibilityRole="button"
        className="w-full"
        onPress={onPress}
      >
        <View
          className="w-full overflow-hidden rounded-3xl"
          style={{
            aspectRatio: 345 / 204,
            backgroundColor: placeholderColors[imageKey],
          }}
        >
          {imageSource ? (
            <Image
              accessibilityIgnoresInvertColors
              className="h-full w-full"
              contentFit="cover"
              recyclingKey={id}
              source={imageSource}
              style={{ height: "100%", width: "100%" }}
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

          <View className="absolute left-3 top-3 items-start gap-2">
            <RatingPill rating={rating} />
            {tag ? <Tag label={tag} /> : null}
          </View>
        </View>

        <View className="gap-1 pt-3">
          <Text
            className="font-sans-semibold text-[17px] leading-6 text-darkSurface"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            className="font-sans text-[13px] leading-[19px] text-muted"
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>

      <View className="absolute right-3 top-3">
        <BookmarkButton
          onPress={() => toggleSavedVenue(id)}
          saved={saved}
        />
      </View>
    </View>
  );
}
