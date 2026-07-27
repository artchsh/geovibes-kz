import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { CustomTabBar } from "@/components/ui/custom-tab-bar";

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home") }} />
      <Tabs.Screen name="list" options={{ title: t("nav.list") }} />
      <Tabs.Screen name="profile" options={{ title: t("nav.profile") }} />
      <Tabs.Screen name="settings" options={{ title: t("nav.settings") }} />
    </Tabs>
  );
}
