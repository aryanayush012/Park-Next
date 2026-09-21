import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';

/**
 * The tick that lands when a booking is confirmed, with the flick of
 * confetti around it.
 *
 * Shaded the same way as the empty-state art: a diagonal gradient for the
 * light, a bright arc on the upper-left for the lit edge, and a soft halo
 * behind. The confetti is what makes it feel like a moment rather than a
 * status icon — four dashes, two in each brand colour, angled away from the
 * centre as though they were thrown.
 */

const VIEW = 200;
const DISC_R = 40;

/** Angled away from the middle, longer at the top, as thrown confetti sits. */
const CONFETTI: { d: string; color: string; width: number }[] = [
  { d: 'M62,44 L52,62', color: colors.secondary, width: 7 },
  { d: 'M138,44 L148,62', color: colors.secondary, width: 7 },
  { d: 'M36,74 L24,80', color: colors.primary, width: 6.5 },
  { d: 'M164,74 L176,80', color: colors.primary, width: 6.5 },
];

export interface SuccessBurstProps {
  size?: number;
  style?: ViewStyle;
}

export function SuccessBurst({ size = 132, style }: SuccessBurstProps) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Defs>
          <RadialGradient id="burstGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.secondary} stopOpacity="0.30" />
            <Stop offset="0.6" stopColor={colors.secondary} stopOpacity="0.08" />
            <Stop offset="1" stopColor={colors.secondary} stopOpacity="0" />
          </RadialGradient>
          {/* Lit from the upper left, like everything else in the app. */}
          <LinearGradient id="burstDisc" x1="0" y1="0" x2="0.75" y2="1">
            <Stop offset="0" stopColor="#5BF0D8" />
            <Stop offset="0.5" stopColor={colors.secondary} />
            <Stop offset="1" stopColor="#19A08F" />
          </LinearGradient>
        </Defs>

        <Circle cx={100} cy={92} r={92} fill="url(#burstGlow)" />

        {/* Thickness under the disc. */}
        <Circle cx={102} cy={95} r={DISC_R} fill="#06251F" />
        <Circle cx={100} cy={92} r={DISC_R} fill="url(#burstDisc)" />

        {/* Lit edge — upper-left arc only; ringing the whole disc would
            flatten it straight back out. */}
        <Path
          d={`M${100 - 30},${92 - 22} A${DISC_R} ${DISC_R} 0 0 1 ${100 + 6},${92 - DISC_R + 1}`}
          stroke="#FFFFFF"
          strokeOpacity={0.45}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />

        <Path
          d="M82,93 L95,106 L120,79"
          stroke={colors.textOnSecondary}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <G strokeLinecap="round" fill="none">
          {CONFETTI.map((piece) => (
            <Path
              key={piece.d}
              d={piece.d}
              stroke={piece.color}
              strokeWidth={piece.width}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
