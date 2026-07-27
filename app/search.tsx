import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useDeferredValue, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { BackButton } from "@/components/ui/back-button";
import { PlaceCard } from "@/components/ui/place-card";
import { categories, places } from "@/lib/mock-data";
import { colors } from "@/theme";

function SearchResultSeparator() {
  return <View className="h-2.5" />;
}

function searchResultKey(place: (typeof places)[number]) {
  return place.id;
}

function renderSearchResult({ item }: { item: (typeof places)[number] }) {
  return (
    <PlaceCard
      {...item}
      onPress={() => router.push(`/space/${item.id}`)}
    />
  );
}

export default function SearchScreen() {
  const { t } = useTranslation();
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
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pt-3">
        <BackButton onPress={() => router.back()} />
        <View className="h-12 flex-1 flex-row items-center rounded-xl border border-border px-4">
          <TextInput
            accessibilityLabel={t("home.searchPlaceholder")}
            autoFocus
            className="flex-1 font-sans text-sm text-black outline-none"
            onChangeText={setQuery}
            placeholder={t("home.searchPlaceholder")}
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            value={query}
          />
          <Ionicons color={colors.faint} name="search" size={20} />
        </View>
      </View>

      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={results}
        ItemSeparatorComponent={SearchResultSeparator}
        keyboardShouldPersistTaps="handled"
        keyExtractor={searchResultKey}
        ListEmptyComponent={
          <Text className="py-12 text-center font-sans text-muted">
            {t("search.empty")}
          </Text>
        }
        ListHeaderComponent={
          <Text className="mb-3 font-display text-3xl text-black">
            {t("search.heading")}
          </Text>
        }
        renderItem={renderSearchResult}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
