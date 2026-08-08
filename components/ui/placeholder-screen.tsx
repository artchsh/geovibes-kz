import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

type PlaceholderScreenProps = {
  name: string;
};

export function PlaceholderScreen({ name }: PlaceholderScreenProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-bg px-6">
      <Text className="font-display text-4xl text-text">{name}</Text>
      <Text className="mt-3 text-center font-sans text-base text-muted">
        {t("common.comingSoon")}
      </Text>
    </View>
  );
}
