import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type RatingPillProps = {
  rating: number;
};

export function RatingPill({ rating }: RatingPillProps) {
  return (
    <View className="min-h-8 flex-row items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
      <Ionicons color="#f5a623" name="star" size={15} />
      <Text className="font-sans-bold text-sm text-darkSurface">
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}
