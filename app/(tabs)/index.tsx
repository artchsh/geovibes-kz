import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CategoryCard } from "@/components/ui/category-card";
import { PlaceCard } from "@/components/ui/place-card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchBar } from "@/components/ui/search-bar";
import {
  getCategories,
  getFeaturedPlace,
  getPlaces,
} from "@/lib/mock-data";

export default function HomeScreen() {
  const { t } = useTranslation();
  const categories = getCategories(t);
  const places = getPlaces(t);
  const featuredPlace = getFeaturedPlace(t);
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0].id);
  // TODO: sort by nearest (needs geolocation)
  const filteredPlaces = places.filter(
    (place) => place.categoryId === activeCategoryId,
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-4">
          <ScreenHeader titleLines={t("home.heading").split("\n")} />

          <View className="mt-6">
            <SearchBar
              onPress={() => router.push("/search")}
              placeholder={t("home.searchPlaceholder")}
            />
          </View>

          <View className="mt-6">
            <PlaceCard
              {...featuredPlace}
              onPress={() => router.push(`/space/${featuredPlace.id}`)}
              variant="featured"
            />
          </View>

          <ScrollView
            className="mt-8"
            contentContainerStyle={{ gap: 12 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((category) => (
              <CategoryCard
                active={category.id === activeCategoryId}
                imageKey={category.imageKey}
                key={category.id}
                label={category.label}
                onPress={() => setActiveCategoryId(category.id)}
              />
            ))}
          </ScrollView>

          <View className="mb-3 mt-8 flex-row items-end justify-between">
            <Text className="font-display text-2xl leading-8 text-darkSurface">
              {t("home.allPlaces")}
            </Text>
            <Text className="font-sans-semibold text-xs text-muted">
              {filteredPlaces.length}
            </Text>
          </View>

          <View className="gap-4">
            {filteredPlaces.length === 0 ? (
              <Text className="py-8 text-center font-sans text-sm text-muted">
                {t("home.emptyCategory")}
              </Text>
            ) : (
              filteredPlaces.map((place) => (
                <PlaceCard
                  {...place}
                  key={place.id}
                  onPress={() => router.push(`/space/${place.id}`)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
