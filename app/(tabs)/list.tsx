import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { CategoryRow } from "@/components/ui/category-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { categories } from "@/lib/mock-data";

const listCategoryOrder = ["1", "4", "2", "3", "5"];

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const orderedCategories = listCategoryOrder
    .map((id) => categories.find((category) => category.id === id))
    .filter((category) => category !== undefined);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-5 px-4 pt-3">
          <ScreenHeader titleLines={t("list.heading").split("\n")} />

          <View className="gap-2.5">
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
