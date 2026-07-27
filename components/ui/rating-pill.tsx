import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type RatingPillProps = {
  rating: number;
};

export function RatingPill({ rating }: RatingPillProps) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-white px-2 py-1">
      <Ionicons color="#f5a623" name="star" size={13} />
      <Text className="font-sans-bold text-xs text-darkSurface">
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}
