import { router } from "expo-router";
import { ScrollView, Text as RNText, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CategoryRow } from "@/components/ui/category-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getCategories } from "@/lib/mock-data";

const listCategoryOrder = ["1", "4", "2", "3", "5"];

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const categories = getCategories(t);
  const orderedCategories = listCategoryOrder
    .map((id) => categories.find((category) => category.id === id))
    .filter((category) => category !== undefined);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-4">
          <ScreenHeader titleLines={t("list.heading").split("\n")} />

          <RNText className="mt-3 font-sans text-sm leading-5 text-muted">
            {t("list.subtitle")}
          </RNText>

          <View className="mt-6 gap-3">
            {orderedCategories.map((category) => (
              <CategoryRow
                imageKey={category.imageKey}
                key={category.id}
                label={category.label}
                onPress={() => router.push(`/category/${category.id}`)}
                subtitle={category.tagline}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
