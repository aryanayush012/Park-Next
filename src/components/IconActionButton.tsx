import React from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius } from '../theme';

/**
 * A round icon action — Call, Navigate — as a raised puck rather than a flat
 * tinted circle.
 *
 * Three things do the lifting, since React Native has no inset shadows:
 * a top-to-bottom gradient for the lit face, a sheen clipped to the top half
 * that reads as a specular highlight on something convex, and a real drop
 * shadow underneath. Pressing scales it down and drops the shadow, so it
 * physically sinks instead of just changing colour.
 *
 * Deliberately amber-tinted rather than solid amber: a card can carry two of
 * these, and solid fills at that size would outshout the screen's actual CTA.
 */

/** Amber tints rather than a solid fill — see the note above. */
const FACE = ['rgba(255, 199, 92, 0.30)', 'rgba(245, 166, 35, 0.16)', 'rgba(245, 166, 35, 0.07)'] as const;

export interface IconActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel: string;
  size?: number;
  style?: ViewStyle;
}

export function IconActionButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 50,
  style,
}: IconActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size },
        elevation.card,
        pressed && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={FACE}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.face}
      />
      {/* Clipped to the upper half, so it reads as light catching a curved
          surface rather than as a second ring. */}
      <View style={styles.sheen} pointerEvents="none" />
      <Ionicons name={icon} size={Math.round(size * 0.38)} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.45)',
    // Keeps the gradient and the sheen inside the circle.
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheen: {
    position: 'absolute',
    top: -2,
    left: '14%',
    right: '14%',
    height: '42%',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  pressed: {
    transform: [{ scale: 0.93 }],
    // Sinking means losing the lift, not just dimming.
    ...elevation.none,
    borderColor: colors.primary,
  },
});
