import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';

/**
 * The picture on an empty search: a magnifier held over a marked-out bay
 * that has no car in it.
 *
 * Sibling of `CalendarCarArt` and `InboxTrayArt`, built the same way — SVG
 * has no lighting model, so depth comes from a diagonal gradient, a lit
 * hairline on the upper-left only, a near-black plate offset behind, and a
 * soft contact shadow. The bay is drawn in perspective and left empty,
 * because "nothing here" is the whole message.
 */

const VIEW = 200;

/** Centre of the lens — the rest of the composition hangs off it. */
const LENS_CX = 104;
const LENS_CY = 88;
const LENS_R = 42;

export interface NoSpotsArtProps {
  size?: number;
  style?: ViewStyle;
}

export function NoSpotsArt({ size = 168, style }: NoSpotsArtProps) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Defs>
          <RadialGradient id="spotGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>

          {/* Glass: brightest at the top-left, where the light comes from. */}
          <LinearGradient id="spotGlass" x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#39435A" stopOpacity="0.85" />
            <Stop offset="0.5" stopColor="#1B2130" stopOpacity="0.75" />
            <Stop offset="1" stopColor="#0C1017" stopOpacity="0.9" />
          </LinearGradient>

          {/* The metal ring around it, lit on the same side. */}
          <LinearGradient id="spotRim" x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor="#FFD27A" />
            <Stop offset="0.5" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#9A6410" />
          </LinearGradient>

          <LinearGradient id="spotHandle" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#8A590E" />
          </LinearGradient>

          <RadialGradient id="spotShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={100} cy={96} r={100} fill="url(#spotGlow)" />
        <Ellipse cx={100} cy={160} rx={58} ry={10} fill="url(#spotShadow)" />

        {/* The empty bay, in perspective: wider at the front than the back. */}
        <G>
          <Path
            d="M46,150 L66,116 L142,116 L170,150 Z"
            fill="#0F131B"
            stroke={colors.primary}
            strokeOpacity={0.22}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Bay markings, converging with the perspective. */}
          <Path
            d="M78,150 L90,120 M116,150 L120,120"
            stroke={colors.primary}
            strokeOpacity={0.35}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {/* A P painted on the tarmac, foreshortened. */}
          <Path
            d="M100,144 L104,128 L112,128 Q117,128 116,133 Q115,138 109,138 L103,138"
            stroke={colors.primary}
            strokeOpacity={0.4}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>

        {/* Handle, behind the lens so it appears to run under the rim. */}
        <Path
          d={`M${LENS_CX + 30},${LENS_CY + 30} L${LENS_CX + 56},${LENS_CY + 58}`}
          stroke="#070A0F"
          strokeWidth={17}
          strokeLinecap="round"
        />
        <Path
          d={`M${LENS_CX + 28},${LENS_CY + 28} L${LENS_CX + 54},${LENS_CY + 56}`}
          stroke="url(#spotHandle)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        <Path
          d={`M${LENS_CX + 26},${LENS_CY + 30} L${LENS_CX + 48},${LENS_CY + 54}`}
          stroke="#FFE7B5"
          strokeOpacity={0.35}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Thickness under the rim. */}
        <Circle cx={LENS_CX + 3} cy={LENS_CY + 4} r={LENS_R} fill="#070A0F" />

        <Circle cx={LENS_CX} cy={LENS_CY} r={LENS_R} fill="url(#spotGlass)" />
        <Circle
          cx={LENS_CX}
          cy={LENS_CY}
          r={LENS_R}
          fill="none"
          stroke="url(#spotRim)"
          strokeWidth={6}
        />

        {/* Specular streak across the glass — the thing that makes it glass
            rather than a filled circle. */}
        <Path
          d={`M${LENS_CX - 26},${LENS_CY - 10} Q${LENS_CX - 18},${LENS_CY - 32} ${LENS_CX + 4},${LENS_CY - 36}`}
          stroke="#FFFFFF"
          strokeOpacity={0.3}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M${LENS_CX - 28},${LENS_CY + 6} Q${LENS_CX - 26},${LENS_CY - 4} ${LENS_CX - 22},${LENS_CY - 12}`}
          stroke="#FFFFFF"
          strokeOpacity={0.16}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />

        {/* Sparks, matching the other two. */}
        <G stroke={colors.primary} strokeLinecap="round" fill="none">
          <Path d="M24,62 L33,53" strokeWidth={4} />
          <Path d="M23,80 L28,75" strokeWidth={3.5} opacity={0.7} />
          <Path d="M172,58 L180,50" strokeWidth={4} />
          <Path d="M176,78 L181,73" strokeWidth={3.5} opacity={0.7} />
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
