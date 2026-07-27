import { router, useLocalSearchParams } from "expo-router";
import { Image, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ActionChip } from "@/components/ui/action-chip";
import { BackButton } from "@/components/ui/back-button";
import { PlaceCard } from "@/components/ui/place-card";
import { SpaceGallery } from "@/components/ui/space-gallery";
import { logoHeart } from "@/lib/images";
import { spaceDetail } from "@/lib/mock-data";

export default function SpaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  // TODO: Look up the space by id when space data comes from the backend.
  void id;

  const openRoute = () => {
    // TODO: deep link to Yandex Maps
  };

  const callVenue = () => {
    // TODO: tel: link
  };

  const shareVenue = () => {
    void Share.share({ message: spaceDetail.name });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-3">
          <BackButton onPress={() => router.back()} />

          <View className="mt-2 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1 pt-0.5">
              <Text className="font-display text-[32px] leading-[38px] text-black">
                {spaceDetail.name}
              </Text>
              <Text className="font-sans text-sm leading-5 text-[#525252]">
                <Text className="text-[#b38a2e]">★</Text>{" "}
                {spaceDetail.rating} · {spaceDetail.address} ·{" "}
                {spaceDetail.hours}
              </Text>
            </View>

            <Image
              accessibilityIgnoresInvertColors
              className="h-16 w-16 rounded-xl"
              resizeMode="contain"
              source={logoHeart}
            />
          </View>

          <View className="mt-5">
            <SpaceGallery
              categoryLabel={spaceDetail.categoryTag}
              imageKeys={spaceDetail.gallery}
            />
          </View>

          <View className="mt-2.5">
            <Text className="font-display text-2xl leading-8 text-black">
              {t("space.description")}
            </Text>
            <Text className="mt-0.5 font-sans text-base leading-5 text-black">
              {spaceDetail.description}
            </Text>
          </View>

          <View className="mt-2.5 flex-row gap-2">
            <ActionChip
              label={t("space.route")}
              onPress={openRoute}
              variant="primary"
            />
            <ActionChip label={t("space.call")} onPress={callVenue} />
            <ActionChip label={t("space.share")} onPress={shareVenue} />
          </View>

          <View className="mt-2.5">
            <Text className="mb-1.5 font-display text-2xl leading-8 text-black">
              {t("space.whatInside")}
            </Text>
            <View className="gap-2.5">
              {spaceDetail.inside.map((place) => (
                <PlaceCard
                  {...place}
                  key={place.id}
                  onPress={() => undefined}
                  variant="featured"
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
