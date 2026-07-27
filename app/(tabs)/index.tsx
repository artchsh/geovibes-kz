import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CategoryCard } from "@/components/ui/category-card";
import { PlaceCard } from "@/components/ui/place-card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchBar } from "@/components/ui/search-bar";
import { categories, featuredPlace, places } from "@/lib/mock-data";

export default function HomeScreen() {
  const { t } = useTranslation();
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0].id);
  // TODO: sort by nearest (needs geolocation)
  const filteredPlaces = places.filter(
    (place) => place.categoryId === activeCategoryId,
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-5 px-4 pt-3">
          <ScreenHeader titleLines={["Лучшие Вайб", "Места!"]} />

          <SearchBar
            onPress={() => undefined}
            placeholder={t("home.searchPlaceholder")}
          />

          <PlaceCard
            {...featuredPlace}
            onPress={() => router.push("/space/1")}
            variant="featured"
          />

          <ScrollView
            contentContainerStyle={{ gap: 6 }}
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

          <Text className="font-sans-semibold text-base text-text">
            {t("home.allPlaces")}
          </Text>

          <View className="gap-2.5">
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
