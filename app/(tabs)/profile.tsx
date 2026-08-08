import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { BookmarkButton } from "@/components/ui/bookmark-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAppState } from "@/lib/app-state";
import { images } from "@/lib/images";
import {
  getCategories,
  getPlaces,
  type Place,
} from "@/lib/mock-data";
import { colors } from "@/theme";

function SavedPlaceSeparator() {
  return <View className="h-2.5" />;
}

function savedPlaceKey(place: Place) {
  return place.id;
}

function renderSavedPlace({ item }: { item: Place }) {
  return <SavedPlaceRow place={item} />;
}

function SavedPlaceRow({ place }: { place: Place }) {
  const { t } = useTranslation();
  const { toggleSavedVenue } = useAppState();
  const categories = getCategories(t);
  const category = categories.find((item) => item.id === place.categoryId);

  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-white p-3">
      <Pressable
        accessibilityLabel={`${place.title}. ${place.subtitle}`}
        accessibilityRole="button"
        className="min-w-0 flex-1 flex-row items-center gap-3"
        onPress={() => router.push(`/space/${place.id}`)}
      >
        <Image
          accessibilityIgnoresInvertColors
          className="rounded-xl"
          contentFit="cover"
          recyclingKey={place.id}
          source={images[place.imageKey]}
          style={{ height: 88, width: 88 }}
        />
        <View className="min-w-0 flex-1 gap-1">
          <Text
            className="font-sans-semibold text-base text-darkSurface"
            numberOfLines={1}
          >
            {place.title}
          </Text>
          <Text className="font-sans text-xs text-primary" numberOfLines={1}>
            {category?.label}
          </Text>
          <Text
            className="font-sans text-xs leading-4 text-muted"
            numberOfLines={2}
          >
            {place.subtitle}
          </Text>
        </View>
      </Pressable>
      <BookmarkButton
        onPress={() => toggleSavedVenue(place.id)}
        saved
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { savedVenueIds } = useAppState();
  const places = getPlaces(t);
  const savedPlaces = savedVenueIds
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => place !== undefined);
  const savedCategoryCount = new Set(
    savedPlaces.map((place) => place.categoryId),
  ).size;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <FlatList
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: 112,
          paddingHorizontal: 16,
          paddingTop: 12,
        }}
        contentInsetAdjustmentBehavior="automatic"
        data={savedPlaces}
        ItemSeparatorComponent={SavedPlaceSeparator}
        keyExtractor={savedPlaceKey}
        ListEmptyComponent={
          <View className="items-center rounded-3xl bg-[#edf5bb] px-6 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-darkSurface">
              <Ionicons
                color={colors.white}
                name="bookmark-outline"
                size={27}
              />
            </View>
            <Text className="mt-4 text-center font-display text-2xl text-darkSurface">
              {t("profile.emptyTitle")}
            </Text>
            <Text className="mt-1 text-center font-sans text-sm leading-5 text-[#525252]">
              {t("profile.emptyBody")}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-5 min-h-12 items-center justify-center rounded-full bg-primary px-6 active:opacity-80"
              onPress={() => router.push("/search")}
            >
              <Text className="font-sans-bold text-sm text-white">
                {t("profile.discover")}
              </Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <View className="mt-6 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5">
            <Ionicons
              color={colors.muted}
              name="phone-portrait-outline"
              size={22}
            />
            <Text className="min-w-0 flex-1 font-sans text-xs leading-4 text-muted">
              {t("profile.localNote")}
            </Text>
          </View>
        }
        ListHeaderComponent={
          <View className="mb-4 gap-8">
            <ScreenHeader titleLines={[t("profile.title")]} />

            <View className="overflow-hidden rounded-3xl bg-darkSurface p-6">
              <View className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-primary" />
              <View className="absolute -right-4 top-24 h-16 w-16 rounded-full border-[10px] border-white/10" />

              <View className="flex-row items-start justify-between">
                <View className="max-w-[68%]">
                  <Text className="font-sans-bold text-xs tracking-wider text-white/60">
                    {t("profile.passport")}
                  </Text>
                  <Text className="mt-1 font-display text-[38px] leading-[44px] text-white">
                    {t("profile.city")}
                  </Text>
                  <View className="mt-2 self-start rounded-full bg-white px-2.5 py-1.5">
                    <Text className="font-sans-bold text-[11px] text-darkSurface">
                      {t("profile.status")}
                    </Text>
                  </View>
                </View>

                <View className="h-16 w-16 items-center justify-center rounded-full bg-white">
                  <Ionicons color={colors.primary} name="person" size={30} />
                </View>
              </View>

              <View className="mt-7 flex-row border-t border-white/15 pt-4">
                <View className="flex-1">
                  <Text className="font-display text-[30px] leading-8 text-white">
                    {savedPlaces.length}
                  </Text>
                  <Text className="font-sans text-xs text-white/60">
                    {t("profile.savedStat")}
                  </Text>
                </View>
                <View className="flex-1 border-l border-white/15 pl-5">
                  <Text className="font-display text-[30px] leading-8 text-white">
                    {savedCategoryCount}
                  </Text>
                  <Text className="font-sans text-xs text-white/60">
                    {t("profile.categoryStat")}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row items-end justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="font-display text-[28px] leading-9 text-darkSurface">
                  {t("profile.savedTitle")}
                </Text>
                <Text className="font-sans text-sm text-muted">
                  {t("profile.savedSubtitle")}
                </Text>
              </View>
              {savedPlaces.length ? (
                <View className="rounded-full bg-pink px-3 py-1.5">
                  <Text className="font-sans-bold text-xs text-primary">
                    {savedPlaces.length}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        }
        renderItem={renderSavedPlace}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
