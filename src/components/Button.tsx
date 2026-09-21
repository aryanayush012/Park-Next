import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleIcon } from './GoogleIcon';
import { LampBloom } from './LampBloom';
import { colors, elevation, radius, spacing, typography } from '../theme';

/**
 * The amber CTA is lit from above, like everything else in this app — a flat
 * fill reads as a sticker, where a top-down gradient reads as a surface with
 * light falling on it. Only the primary variant gets it; the rest are quiet
 * by design.
 */
const PRIMARY_GRADIENT = ['#FFC24A', '#F5A623', '#E8941A'] as const;

/** How far the CTA's halo spills past the pill, in dp. */
const GLOW_SPILL = 26;

export type ButtonVariant = 'primary' | 'secondary' | 'accentOutline' | 'danger' | 'google';

export interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Icon ahead of the label. The `google` variant supplies its own. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Icon after the label — reserve it for buttons that actually take you
   * somewhere ("Find Parking →"), so the arrow keeps meaning "forward"
   * rather than becoming decoration on every button in the app.
   */
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  /**
   * Arbitrary leading content, for marks that aren't Ionicons — another
   * product's logo, say. Takes precedence over `icon`.
   */
  leadingNode?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  trailingIcon,
  leadingNode,
  style,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const look = VARIANTS[variant];
  const contentColor = isDisabled ? colors.textMuted : (look.label.color as string);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        look.container,
        !isDisabled ? look.glow : elevation.none,
        pressed && !isDisabled && look.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' && !isDisabled ? (
        <>
          {/* The halo every primary CTA carries. It lives in here rather than
              at each call site so the lighting is automatic app-wide, and it
              uses `inset` so it tracks buttons whose height a caller has
              overridden. Rendered before the gradient so the spill shows
              outside the pill while the fill stays solid inside. */}
          <LampBloom inset={GLOW_SPILL} intensity={0.2} />
          <LinearGradient
            colors={PRIMARY_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradient}
          />
        </>
      ) : null}
      {loading ? (
        <ActivityIndicator color={look.spinner} />
      ) : (
        <View style={styles.content}>
          {variant === 'google' ? <GoogleIcon size={20} /> : null}
          {leadingNode ??
            (icon ? <Ionicons name={icon} size={20} color={contentColor} /> : null)}
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
        </View>
      )}
      {/* Pinned to the edge rather than sitting in the row, so the label
          stays optically centred in the pill — an arrow tucked up against
          the text reads as part of the label instead of as a direction. */}
      {trailingIcon && !loading ? (
        <Ionicons
          name={trailingIcon}
          size={20}
          color={contentColor}
          style={styles.trailingIcon}
        />
      ) : null}
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
  /**
   * Outlined in the brand amber — for a secondary action that still wants
   * to be found at a glance, like calling the host from a booking. Distinct
   * from `secondary`, which is deliberately quiet.
   */
  accentOutline: {
    container: {
      backgroundColor: colors.primaryMuted,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    pressed: { backgroundColor: 'rgba(245, 166, 35, 0.28)' },
    glow: elevation.none,
    label: { color: colors.primary },
    spinner: colors.primary,
  },
  danger: {
    container: { backgroundColor: colors.error },
    pressed: { backgroundColor: '#C93434' },
    glow: elevation.none,
    label: { color: colors.white },
    spinner: colors.white,
  },
  /**
   * White pill with near-black text — Google's own sign-in branding, which
   * isn't ours to restyle. It also happens to be the strongest contrast on
   * this background, which is right: on an auth screen, the one-tap route
   * should be the one that catches the eye first.
   */
  google: {
    container: { backgroundColor: colors.googleSurface },
    pressed: { backgroundColor: '#E8E8E8' },
    glow: elevation.card,
    label: { color: colors.googleInk },
    spinner: colors.googleInk,
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // Has to shrink rather than overflow the pill once an icon and a long
    // Hindi label are competing for the same row.
    flexShrink: 1,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.full,
  },
  trailingIcon: {
    position: 'absolute',
    right: spacing.lg,
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
