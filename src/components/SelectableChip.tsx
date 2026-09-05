import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

export interface SelectableChipProps {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
}

/**
 * Toggleable pill chip for multi-select pickers (vehicle types, amenities)
 * in the provider Add Listing flow. Distinct from `AmenityBadge`, which is
 * a static display-only chip with no selected/unselected state.
 */
export function SelectableChip({ label, icon, selected, onPress }: SelectableChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? colors.textOnPrimary : colors.textSecondary}
          style={styles.icon}
        />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  labelSelected: {
    color: colors.textOnPrimary,
  },
});
