import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { colors, elevation, radius, spacing, typography } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const look = VARIANTS[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        look.container,
        !isDisabled ? look.glow : elevation.none,
        pressed && !isDisabled && look.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.spinner} />
      ) : (
        <Text
          style={[
            typography.buttonLabel,
            styles.label,
            look.label,
            isDisabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * One entry per variant, so adding another is a new row rather than another
 * branch in four separate ternaries.
 *
 * Only `primary` glows: the glow is the app's way of saying "this is the
 * thing to press", and a destructive button should never be that.
 */
const VARIANTS: Record<
  ButtonVariant,
  {
    container: ViewStyle;
    pressed: ViewStyle;
    glow: ViewStyle;
    label: TextStyle;
    spinner: string;
  }
> = {
  primary: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: '#DC901C' },
    glow: elevation.glowPrimary,
    label: { color: colors.textOnPrimary },
    spinner: colors.textOnPrimary,
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
    },
    pressed: { backgroundColor: colors.surface, borderColor: colors.primary },
    glow: elevation.none,
    label: { color: colors.textPrimary },
    spinner: colors.primary,
  },
  danger: {
    container: { backgroundColor: colors.error },
    pressed: { backgroundColor: '#C93434' },
    glow: elevation.none,
    label: { color: colors.white },
    spinner: colors.white,
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  label: {
    // Without these the label keeps its intrinsic width inside the row and
    // spills past the horizontal padding, which clips wider scripts.
    flexShrink: 1,
    textAlign: 'center',
  },
  disabled: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
  },
  disabledLabel: {
    color: colors.textMuted,
  },
});
