import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

/**
 * A soft circle of warm light behind whatever a screen wants you to look at
 * first. Pair it with exactly one element per screen — the moment there are
 * two light sources the room reads flat, which is the opposite of the point.
 *
 * `expo-linear-gradient` can't do radial, and the blur route is closed (the
 * project pulled `expo-blur` after a native crash), so this is an SVG
 * radial gradient — cheap, static, no native module.
 */
export interface LampBloomProps {
  /**
   * Diameter in dp, for a bloom behind a specific element. Ignored when
   * `inset` is given.
   */
  size?: number;
  /**
   * Stretch to the parent's box and spill this many dp past every edge,
   * instead of being a fixed circle. Use this when the thing being lit can
   * change size — a button whose height a caller overrides, say — so the
   * halo tracks it rather than needing its own hardcoded offset.
   */
  inset?: number;
  /** Peak opacity at the centre. Keep it low — this is air, not a shape. */
  intensity?: number;
  style?: ViewStyle;
}

export function LampBloom({ size, inset, intensity = 0.22, style }: LampBloomProps) {
  const box: ViewStyle =
    inset === undefined
      ? { width: size, height: size }
      : { top: -inset, left: -inset, right: -inset, bottom: -inset };

  return (
    <View
      style={[styles.bloom, box, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={intensity} />
            <Stop offset="0.55" stopColor={colors.primary} stopOpacity={intensity * 0.35} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#bloom)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  bloom: {
    position: 'absolute',
  },
});
