import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useDeferredValue, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { BackButton } from "@/components/ui/back-button";
import { PlaceCard } from "@/components/ui/place-card";
import { getCategories, getPlaces, type Place } from "@/lib/mock-data";
import { colors } from "@/theme";

function SearchResultSeparator() {
  return <View className="h-4" />;
}

function searchResultKey(place: Place) {
  return place.id;
}

function renderSearchResult({ item }: { item: Place }) {
  return (
    <PlaceCard
      {...item}
      onPress={() => router.push(`/space/${item.id}`)}
    />
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
  const categories = getCategories(t);
  const places = getPlaces(t);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const results = deferredQuery
    ? places.filter((place) => {
        const category = categories.find(
          (item) => item.id === place.categoryId,
        );
        return [place.title, place.subtitle, place.tag, category?.label].some(
          (value) => value?.toLocaleLowerCase().includes(deferredQuery),
        );
      })
    : places;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pt-4">
        <BackButton onPress={() => router.back()} />
        <View className="h-14 flex-1 flex-row items-center gap-3 rounded-2xl bg-white px-4">
          <Ionicons color={colors.muted} name="search" size={20} />
          <TextInput
            accessibilityLabel={t("home.searchPlaceholder")}
            autoFocus
            className="flex-1 font-sans text-sm text-darkSurface outline-none"
            onChangeText={setQuery}
            placeholder={t("home.searchPlaceholder")}
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel={t("search.clear")}
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-full active:opacity-60"
              onPress={() => setQuery("")}
            >
              <Ionicons color={colors.muted} name="close" size={22} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={results}
        ItemSeparatorComponent={SearchResultSeparator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={searchResultKey}
        ListEmptyComponent={
          <View className="items-center rounded-3xl bg-white px-6 py-10">
            <Ionicons color={colors.primary} name="search" size={32} />
            <Text className="mt-4 text-center font-display text-2xl text-darkSurface">
              {t("search.empty")}
            </Text>
            <Pressable
              className="mt-5 min-h-12 items-center justify-center rounded-full bg-primary px-6"
              onPress={() => setQuery("")}
            >
              <Text className="font-sans-bold text-sm text-white">
                {t("search.clear")}
              </Text>
            </Pressable>
          </View>
        }
        ListHeaderComponent={
          <View className="mb-4 mt-2 flex-row items-end justify-between">
            <Text className="font-display text-[28px] leading-9 text-darkSurface">
              {query ? t("search.results") : t("search.popular")}
            </Text>
            <Text className="font-sans-semibold text-xs text-muted">
              {results.length}
            </Text>
          </View>
        }
        renderItem={renderSearchResult}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
