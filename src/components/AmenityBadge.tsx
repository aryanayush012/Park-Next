import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

export interface AmenityBadgeProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tone?: 'neutral' | 'secondary';
}

export function AmenityBadge({ icon, label, tone = 'neutral' }: AmenityBadgeProps) {
  const isSecondary = tone === 'secondary';
  return (
    <View style={[styles.badge, isSecondary && styles.badgeSecondary]}>
      <Ionicons
        name={icon}
        size={12}
        color={isSecondary ? colors.secondary : colors.textSecondary}
        style={styles.icon}
      />
      <Text style={[styles.label, isSecondary && styles.labelSecondary]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  badgeSecondary: {
    backgroundColor: colors.secondaryMuted,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  labelSecondary: {
    color: colors.secondary,
  },
});
