import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { images } from "@/lib/images";
import type { ImageKey } from "@/lib/mock-data";
import { colors } from "@/theme";

type PlaceCardProps = {
  title: string;
  subtitle: string;
  tag?: string;
  imageKey?: ImageKey;
  variant?: "featured" | "list";
  onPress?: () => void;
};

const placeholderColors: Record<ImageKey, string> = {
  operation: "#d9e4e5",
  cooperative: "#dce88a",
  cocktails: "#f7c3be",
  burgers: "#efd7ad",
  disco: "#d9d9e2",
  clothing: "#d8d3cb",
  jewelry: "#ead9d7",
  atelier: "#ddd6c9",
  rooftop: "#cbd9df",
};

export function PlaceCard({
  title,
  subtitle,
  tag,
  imageKey = "operation",
  variant = "list",
  onPress,
}: PlaceCardProps) {
  const imageSource = images[imageKey];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      className="h-[182px] w-full overflow-hidden rounded-md"
      onPress={onPress}
    >
      {imageSource ? (
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          recyclingKey={`${imageKey}-${title}`}
          source={imageSource}
          style={styles.image}
        />
      ) : (
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: placeholderColors[imageKey] }}
        >
          <View className="h-20 w-20 items-center justify-center rounded-full bg-white/45">
            <Ionicons
              color={colors.muted}
              name={
                variant === "featured"
                  ? "storefront-outline"
                  : "location-outline"
              }
              size={34}
            />
            <Text className="mt-1 font-sans-semibold text-xs text-muted">
              {title.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      <LinearGradient
        colors={["transparent", "rgba(15, 23, 42, 0.82)"]}
        pointerEvents="none"
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          left: 0,
          height: 106,
          zIndex: 1,
        }}
      />

      <View className="flex-1 p-2" style={styles.content}>
        {tag ? (
          <View className="self-start rounded-md bg-accentOrange px-[9px] py-1.5">
            <Text className="font-sans-bold text-xs text-white">{tag}</Text>
          </View>
        ) : null}

        <View className="mt-auto">
          <Text
            className="font-sans-bold text-base text-white"
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            className="font-sans text-[13px] leading-[17px] text-white/80"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  content: {
    zIndex: 2,
  },
});
