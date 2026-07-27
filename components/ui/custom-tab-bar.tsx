import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { type ComponentProps, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
type TabItemProps = {
  isFocused: boolean;
  label: string;
  onPress: () => void;
  tab: (typeof tabs)[TabName];
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabItem({ isFocused, label, onPress, tab }: TabItemProps) {
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(isFocused ? 1 : 0, { duration: 100 }));
  }, [isFocused, progress]);

  const itemStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [colors.darkSurface, colors.white],
    ),
  }));
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
  }));
  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.get(),
  }));

  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      layout={LinearTransition.duration(140)}
      onPress={onPress}
      style={[styles.item, itemStyle]}
    >
      <View style={styles.iconSlot}>
        <Animated.View style={[styles.iconLayer, inactiveIconStyle]}>
          <Ionicons color={colors.white} name={tab.icon} size={20} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, activeIconStyle]}>
          <Ionicons color={colors.darkSurface} name={tab.activeIcon} size={20} />
        </Animated.View>
      </View>
      {isFocused ? (
        <Animated.Text
          entering={FadeIn.delay(30).duration(90)}
          numberOfLines={1}
          style={styles.activeLabel}
        >
          {label}
        </Animated.Text>
      ) : null}
    </AnimatedPressable>
  );
}

export function CustomTabBar({
  state,
  navigation,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.container}>
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
            <TabItem
              isFocused={isFocused}
              key={route.key}
              label={t(tab.label)}
              onPress={onPress}
              tab={tab}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  container: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 24,
    backgroundColor: colors.darkSurface,
    padding: 8,
    shadowColor: colors.darkSurface,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  item: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    paddingHorizontal: 12,
    gap: 7,
    overflow: "hidden",
  },
  activeLabel: {
    color: colors.darkSurface,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
  iconSlot: {
    height: 20,
    width: 20,
  },
  iconLayer: {
    position: "absolute",
    inset: 0,
  },
});
