import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { colors, fonts } from "@/theme";

const tabs = {
  index: { icon: "home-outline", activeIcon: "home", label: "nav.home" },
  list: { icon: "list-outline", activeIcon: "list", label: "nav.list" },
  profile: {
    icon: "person-outline",
    activeIcon: "person",
    label: "nav.profile",
  },
  settings: {
    icon: "settings-outline",
    activeIcon: "settings",
    label: "nav.settings",
  },
} as const;

type TabName = keyof typeof tabs;
type TabsProps = ComponentProps<typeof Tabs>;
type CustomTabBarProps = Parameters<NonNullable<TabsProps["tabBar"]>>[0];

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const tab = tabs[route.name as TabName];

        if (!tab) {
          return null;
        }

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={
              descriptors[route.key].options.tabBarAccessibilityLabel
            }
            key={route.key}
            onPress={onPress}
            style={[styles.item, isFocused && styles.activeItem]}
          >
            <Ionicons
              color={isFocused ? colors.darkSurface : colors.white}
              name={isFocused ? tab.activeIcon : tab.icon}
              size={20}
            />
            {isFocused ? (
              <Text numberOfLines={1} style={styles.activeLabel}>
                {t(tab.label)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 24,
    backgroundColor: colors.darkSurface,
    paddingHorizontal: 8,
    shadowColor: colors.darkSurface,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  item: {
    minWidth: 44,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  activeItem: {
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.white,
  },
  activeLabel: {
    color: colors.darkSurface,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
});
