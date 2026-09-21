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
 * The picture on an empty bookings list: a calendar with a car badge.
 *
 * A bespoke drawing rather than the icon-in-a-ring every other empty state
 * uses, because this is the one people hit most — the list they open
 * expecting something and find nothing in. Worth a real image.
 *
 * The dimensionality is all gradient work, since SVG has no lighting model:
 * a diagonal body gradient stands in for a light source up and to the left,
 * a bright hairline along the top and left edges reads as the lit corner, a
 * near-black plate offset behind gives the panel thickness, and a soft
 * ellipse underneath grounds it. Those four together are what stop it
 * looking like a flat sticker.
 */

const VIEW = 200;

/** Where the panel sits, so the rings and badge can be placed against it. */
const BODY_X = 40;
const BODY_Y = 42;
const BODY_W = 122;
const BODY_H = 100;
const RING_X1 = 76;
const RING_X2 = 124;

export interface CalendarCarArtProps {
  size?: number;
  style?: ViewStyle;
}

export function CalendarCarArt({ size = 168, style }: CalendarCarArtProps) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Defs>
          {/* Lamplight behind the whole object, same idea as everywhere else. */}
          <RadialGradient id="calGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>

          {/* The panel face: lit from the upper left, falling into shadow. */}
          <LinearGradient id="calFace" x1="0" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor="#333C4F" />
            <Stop offset="0.45" stopColor="#1D2331" />
            <Stop offset="1" stopColor="#0E121A" />
          </LinearGradient>

          {/* Each date cell is recessed, so it runs dark-to-light — the
              opposite of the panel it sits in. */}
          <LinearGradient id="calCell" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0D1118" />
            <Stop offset="1" stopColor="#222938" />
          </LinearGradient>

          {/* Rings are round bar stock: hot on the left, dull on the right. */}
          <LinearGradient id="calRing" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFD27A" />
            <Stop offset="0.45" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#9A6410" />
          </LinearGradient>

          <LinearGradient id="calBadge" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#FFD27A" />
            <Stop offset="0.55" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#B87710" />
          </LinearGradient>

          {/* Contact shadow — a radial, because SVG has no cheap blur. */}
          <RadialGradient id="calShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={100} cy={96} r={100} fill="url(#calGlow)" />
        <Ellipse cx={100} cy={158} rx={62} ry={11} fill="url(#calShadow)" />

        {/* Binding rings pass behind the panel's top edge. */}
        {[RING_X1, RING_X2].map((x) => (
          <Path
            key={`ring-${x}`}
            d={`M${x - 8},${BODY_Y + 8} L${x - 8},30 Q${x - 8},20 ${x},20 Q${x + 8},20 ${x + 8},30 L${x + 8},${BODY_Y + 8}`}
            stroke="url(#calRing)"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {/* Thickness: a near-black plate peeking out below and right. */}
        <Rect
          x={BODY_X + 4}
          y={BODY_Y + 5}
          width={BODY_W}
          height={BODY_H}
          rx={16}
          fill="#070A0F"
        />

        <Rect
          x={BODY_X}
          y={BODY_Y}
          width={BODY_W}
          height={BODY_H}
          rx={16}
          fill="url(#calFace)"
        />

        {/* The lit edge — top and left only, which is what sells the angle. */}
        <Path
          d={`M${BODY_X + 16},${BODY_Y + 0.75} L${BODY_X + BODY_W - 16},${BODY_Y + 0.75}
              M${BODY_X + 0.75},${BODY_Y + 16} L${BODY_X + 0.75},${BODY_Y + BODY_H - 16}`}
          stroke="#FFFFFF"
          strokeOpacity={0.16}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Where the rings enter the panel. */}
        {[RING_X1, RING_X2].map((x) => (
          <Rect
            key={`slot-${x}`}
            x={x - 10}
            y={BODY_Y + 4}
            width={20}
            height={7}
            rx={3.5}
            fill="#0A0E15"
            opacity={0.9}
          />
        ))}

        {/* Date grid. The last cell is left out so the badge doesn't land on
            a filled square. */}
        {[0, 1, 2].map((col) =>
          [0, 1].map((row) =>
            col === 2 && row === 1 ? null : (
              <Rect
                key={`${col}-${row}`}
                x={58 + col * 30}
                y={70 + row * 30}
                width={22}
                height={20}
                rx={5}
                fill="url(#calCell)"
              />
            )
          )
        )}

        {/* Car badge, punched out of the panel's lower-right corner. */}
        <Circle cx={142} cy={122} r={35} fill={colors.background} />
        <Circle
          cx={142}
          cy={122}
          r={30}
          fill="none"
          stroke="url(#calBadge)"
          strokeWidth={4}
        />
        {/* Specular tick on the ring's lit side. */}
        <Path
          d="M122,108 Q128,99 139,95"
          stroke="#FFE7B5"
          strokeOpacity={0.75}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />

        <G transform="translate(120, 108)">
          {/* Car, front on. */}
          <Path
            d="M4,21 L4,15 Q4,12 7,11 L11,5 Q12,3 15,3 L29,3 Q32,3 33,5 L37,11 Q40,12 40,15 L40,21
               Q40,23 38,23 L6,23 Q4,23 4,21 Z"
            fill={colors.primary}
          />
          <Path d="M13,11 L16,6 L28,6 L31,11 Z" fill={colors.background} opacity={0.6} />
          <Circle cx={12} cy={23} r={3.5} fill={colors.primary} />
          <Circle cx={32} cy={23} r={3.5} fill={colors.primary} />
        </G>

        {/* Sparks — the flick of energy that keeps it from reading as a form. */}
        <G stroke={colors.primary} strokeLinecap="round" fill="none">
          <Path d="M24,66 L33,57" strokeWidth={4} />
          <Path d="M23,84 L28,79" strokeWidth={3.5} opacity={0.7} />
          <Path d="M176,100 L184,92" strokeWidth={4} />
          <Path d="M179,120 L184,115" strokeWidth={3.5} opacity={0.7} />
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
