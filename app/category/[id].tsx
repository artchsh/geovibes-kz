import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { BackButton } from "@/components/ui/back-button";
import { PlaceCardTall } from "@/components/ui/place-card-tall";
import { images } from "@/lib/images";
import { getCategoryDetail } from "@/lib/mock-data";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const categoryDetail = getCategoryDetail(id, t);

  if (!categoryDetail) {
    return (
      <SafeAreaView className="flex-1 bg-bg px-4 pt-4" edges={["top"]}>
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
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-4">
          <BackButton onPress={() => router.back()} />

          <View className="mt-6 flex-row items-start justify-between gap-4">
            <View className="flex-1 pt-0.5">
              <Text className="font-display text-[36px] leading-10 text-darkSurface">
                {categoryDetail.name}
              </Text>
              <Text className="mt-1 font-sans text-[13px] leading-5 text-muted">
                {categoryDetail.subtitle} ·{" "}
                {t("category.placeCount", { count: categoryDetail.count })}
              </Text>
            </View>

            <Image
              className="rounded-2xl bg-white"
              contentFit="cover"
              source={images[categoryDetail.imageKey]}
              style={{ height: 80, width: 80 }}
            />
          </View>

          <View className="mt-8 gap-6">
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
