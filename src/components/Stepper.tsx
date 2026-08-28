import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

export interface StepperProps {
  label: string;
  valueLabel: string;
  onIncrement: () => void;
  onDecrement: () => void;
  canIncrement?: boolean;
  canDecrement?: boolean;
}

/**
 * Generic +/- stepper used for duration and time-of-day controls across the
 * booking flow — deliberately custom-built rather than pulling in a native
 * date/time picker dependency.
 */
export function Stepper({
  label,
  valueLabel,
  onIncrement,
  onDecrement,
  canIncrement = true,
  canDecrement = true,
}: StepperProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={onDecrement}
          disabled={!canDecrement}
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="remove"
            size={18}
            color={canDecrement ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>
        <Text style={styles.valueLabel}>{valueLabel}</Text>
        <Pressable
          onPress={onIncrement}
          disabled={!canIncrement}
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="add"
            size={18}
            color={canIncrement ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  valueLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    minWidth: 78,
    textAlign: 'center',
  },
});
