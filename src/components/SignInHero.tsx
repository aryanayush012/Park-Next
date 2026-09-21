import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, typography } from '../theme';

/**
 * The scene in the corner of the auth screens: a car pulling in under a
 * street lamp, with the bay's P sign lit beside it.
 *
 * Same lamplight idea as `HorizonGlow`, but as an establishing shot rather
 * than a horizon — it sits at the top-right of sign-in so the eye meets the
 * product's world before it meets the form. Drawn rather than photographed
 * so it tints with the theme and costs nothing in the bundle.
 */

const VIEW_W = 220;
const VIEW_H = 240;

/** Where the lamp stands and where its light lands. */
const LAMP_X = 150;
const GROUND_Y = 212;

export interface SignInHeroProps {
  width?: number;
  height?: number;
  style?: ViewStyle;
}

export function SignInHero({ width = 200, height = 218, style }: SignInHeroProps) {
  return (
    <View
      style={[styles.wrap, { width, height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      renderToHardwareTextureAndroid
      collapsable={false}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Defs>
          {/* The glow around the lamp head itself. */}
          <RadialGradient id="heroHead" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.55" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
          {/* Its throw down onto the bay. */}
          <LinearGradient id="heroCone" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id="heroPool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.30" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
          {/* Tail lights. */}
          <RadialGradient id="tail" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FF5A3C" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#FF5A3C" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Lamp: pole, curved arm, head — then the light it throws. */}
        <Path
          d={`M${LAMP_X},${GROUND_Y} L${LAMP_X},58 Q${LAMP_X},40 ${LAMP_X - 18},40`}
          stroke={colors.primary}
          strokeOpacity={0.5}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M${LAMP_X - 30},34 L${LAMP_X - 6},34 L${LAMP_X - 11},46 L${LAMP_X - 25},46 Z`}
          fill={colors.primary}
          opacity={0.9}
        />
        <Ellipse cx={LAMP_X - 18} cy={44} rx={44} ry={34} fill="url(#heroHead)" />
        <Path
          d={`M${LAMP_X - 18},48 L${LAMP_X - 76},${GROUND_Y} L${LAMP_X + 40},${GROUND_Y} Z`}
          fill="url(#heroCone)"
        />
        <Ellipse cx={LAMP_X - 18} cy={GROUND_Y} rx={74} ry={13} fill="url(#heroPool)" />

        {/* The P sign on its post, beside the bay. */}
        <Path
          d={`M198,${GROUND_Y} L198,120`}
          stroke={colors.primary}
          strokeOpacity={0.4}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Rect
          x={180}
          y={86}
          width={36}
          height={36}
          rx={7}
          fill={colors.background}
          stroke={colors.primary}
          strokeWidth={2}
          opacity={0.95}
        />

        {/* Car, seen from behind, nosing into the lit bay. */}
        <Path
          d="M44,206 L44,170 Q44,160 54,158 L66,132 Q70,124 80,124 L128,124 Q138,124 142,132 L154,158
             Q164,160 164,170 L164,206 Q164,210 159,210 L49,210 Q44,210 44,206 Z"
          fill="#12151C"
          stroke={colors.primary}
          strokeOpacity={0.65}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Rear window. */}
        <Path
          d="M74,132 L134,132 L146,157 L62,157 Z"
          fill={colors.primary}
          opacity={0.1}
          stroke={colors.primary}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* Tail lights, and their spill onto the tarmac. */}
        <Ellipse cx={60} cy={178} rx={22} ry={16} fill="url(#tail)" />
        <Ellipse cx={148} cy={178} rx={22} ry={16} fill="url(#tail)" />
        <Rect x={50} y={172} width={22} height={9} rx={4.5} fill="#FF6A4D" />
        <Rect x={136} y={172} width={22} height={9} rx={4.5} fill="#FF6A4D" />
        {/* Plate. */}
        <Rect x={88} y={186} width={32} height={11} rx={2.5} fill={colors.primary} opacity={0.45} />
      </Svg>

      {/* The sign's letter as real text — SVG text on RN can't be relied on
          to pick up the app's loaded font, and this one needs to match. */}
      <View style={styles.signLetter}>
        <Text style={styles.signLetterText}>P</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Positioned by the caller; the art bleeds off whichever edge it's put on.
  },
  signLetter: {
    position: 'absolute',
    // Matches the 36x36 rect at (180, 86) in a 220x240 viewBox.
    left: `${(180 / VIEW_W) * 100}%`,
    top: `${(86 / VIEW_H) * 100}%`,
    width: `${(36 / VIEW_W) * 100}%`,
    height: `${(36 / VIEW_H) * 100}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signLetterText: {
    ...typography.h3,
    color: colors.primary,
  },
});
