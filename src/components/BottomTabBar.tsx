import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing, typography } from '../theme';

/**
 * Themed bottom tab bar built on React Navigation's bottom-tabs primitives.
 * Pass as the `tabBar` prop of a `Tab.Navigator`. Icon per-route name is
 * resolved from `TAB_ICONS`; add an entry there for any new route name.
 */
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Dashboard: 'home-outline',
  Bookings: 'calendar-outline',
  Requests: 'file-tray-outline',
  Listings: 'list-outline',
  Profile: 'person-outline',
};

const TAB_ICONS_ACTIVE: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Dashboard: 'home',
  Bookings: 'calendar',
  Requests: 'file-tray',
  Listings: 'list',
  Profile: 'person',
};

export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const iconName = isFocused
          ? TAB_ICONS_ACTIVE[route.name] ?? 'ellipse'
          : TAB_ICONS[route.name] ?? 'ellipse-outline';

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <Ionicons
              name={iconName}
              size={22}
              color={isFocused ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
  },
});
