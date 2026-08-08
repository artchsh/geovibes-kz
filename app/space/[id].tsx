import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ActionChip } from "@/components/ui/action-chip";
import { BackButton } from "@/components/ui/back-button";
import { PlaceCard } from "@/components/ui/place-card";
import { SpaceGallery } from "@/components/ui/space-gallery";
import { useAppState } from "@/lib/app-state";
import { getSpaceDetail } from "@/lib/mock-data";

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { isVenueSaved, toggleSavedVenue } = useAppState();
  const spaceDetail = getSpaceDetail(id, t);

  if (!spaceDetail) {
    return (
      <SafeAreaView className="flex-1 bg-bg px-4 pt-4" edges={["top"]}>
        <BackButton onPress={() => router.back()} />
        <View className="flex-1 items-center justify-center pb-16">
          <Text className="font-display text-3xl text-black">
            {t("space.notFound")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const openRoute = () => {
    const point = `${spaceDetail.longitude},${spaceDetail.latitude}`;
    void Linking.openURL(
      `https://yandex.com/maps/?pt=${point}&z=16&l=map`,
    );
  };

  const callVenue = () => {
    void Linking.openURL(`tel:${spaceDetail.phone.replace(/[^+\d]/g, "")}`);
  };

  const shareVenue = () => {
    const url = Linking.createURL(`/space/${spaceDetail.id}`);
    void Share.share({
      message: `${spaceDetail.name}\n${spaceDetail.address}\n${url}`,
      title: spaceDetail.name,
      url,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-4">
          <BackButton onPress={() => router.back()} />

          <View className="mt-6">
            <View className="min-w-0">
              <Text className="font-display text-[38px] leading-[44px] text-darkSurface">
                {spaceDetail.name}
              </Text>
            </View>
            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              <View className="rounded-full bg-white px-3 py-2">
                <Text className="font-sans-bold text-sm text-darkSurface">
                  <Text className="text-[#b38a2e]">★</Text> {spaceDetail.rating}
                </Text>
              </View>
              <View className="rounded-full bg-white px-3 py-2">
                <Text className="font-sans-semibold text-xs text-muted">
                  {spaceDetail.hours}
                </Text>
              </View>
            </View>
            <Text className="mt-3 font-sans text-sm text-muted">
              {spaceDetail.address}
            </Text>
          </View>

          <View className="mt-6">
            <SpaceGallery
              categoryLabel={spaceDetail.categoryTag}
              imageKeys={spaceDetail.gallery}
              isSaved={isVenueSaved(spaceDetail.id)}
              onToggleSaved={() => toggleSavedVenue(spaceDetail.id)}
            />
          </View>

          <View className="mt-8">
            <Text className="font-display text-2xl leading-8 text-black">
              {t("space.description")}
            </Text>
            <Text className="mt-2 font-sans text-[15px] leading-6 text-darkSurface">
              {spaceDetail.description}
            </Text>
          </View>

          <View className="mt-5 flex-row gap-2">
            <ActionChip
              label={t("space.route")}
              onPress={openRoute}
              variant="primary"
              wide
            />
            <ActionChip label={t("space.call")} onPress={callVenue} />
            <ActionChip label={t("space.share")} onPress={shareVenue} />
          </View>

          <View className="mt-8">
            <Text className="mb-3 font-display text-2xl leading-8 text-darkSurface">
              {t("space.whatInside")}
            </Text>
            <View className="gap-4">
              {spaceDetail.inside.map((place) => (
                <PlaceCard
                  {...place}
                  key={place.id}
                  onPress={() => router.push(`/space/${place.id}`)}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
