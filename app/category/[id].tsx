import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { BackButton } from "@/components/ui/back-button";
import { PlaceCardTall } from "@/components/ui/place-card-tall";
import { getCategoryDetail } from "@/lib/mock-data";
import { colors } from "@/theme";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const categoryDetail = getCategoryDetail(id);

  if (!categoryDetail) {
    return (
      <SafeAreaView className="flex-1 bg-white px-4 pt-3" edges={["top"]}>
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 items-center justify-center pb-16">
          <Text className="font-display text-3xl text-black">
            {t("category.notFound")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-3">
          <BackButton onPress={() => router.back()} />

          <View className="mt-2 flex-row items-start justify-between gap-4">
            <View className="flex-1 pt-0.5">
              <Text className="font-display text-[32px] leading-[38px] text-black">
                {categoryDetail.name}
              </Text>
              <Text className="font-sans text-sm leading-5 text-[#525252]">
                {categoryDetail.subtitle} ·{" "}
                {t("category.placeCount", { count: categoryDetail.count })}
              </Text>
            </View>

            <View className="h-16 w-16 items-center justify-center rounded-xl bg-[#f7c3be]">
              <Ionicons color={colors.primary} name="wine-outline" size={30} />
            </View>
          </View>

          <View className="mt-5 gap-2.5">
            {categoryDetail.places.map((place) => (
              <PlaceCardTall
                {...place}
                key={place.id}
                onPress={() => router.push(`/space/${place.id}`)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
