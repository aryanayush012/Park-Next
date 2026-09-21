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
 * The picture on an empty requests list: an inbox tray with nothing in it.
 *
 * Sibling of `CalendarCarArt` and built the same way — SVG has no lighting
 * model, so the depth comes from a diagonal body gradient, a hairline lit
 * edge on the top and left only, a near-black plate offset behind, and a
 * soft contact shadow underneath. An empty tray is the whole message here,
 * so there is deliberately nothing sitting in it.
 */

const VIEW = 200;

/** The tray's mouth — everything else is positioned off this. */
const RIM_CY = 92;
const RIM_RX = 58;
const RIM_RY = 12;

export interface InboxTrayArtProps {
  size?: number;
  style?: ViewStyle;
}

export function InboxTrayArt({ size = 168, style }: InboxTrayArtProps) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <Defs>
          <RadialGradient id="trayGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.22" />
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>

          {/* Outside of the tray: lit from the upper left, falling away. */}
          <LinearGradient id="trayBody" x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#333C4F" />
            <Stop offset="0.5" stopColor="#1C2230" />
            <Stop offset="1" stopColor="#0D1119" />
          </LinearGradient>

          {/* The rim's top face catches the most light. */}
          <LinearGradient id="trayRim" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#3C4659" />
            <Stop offset="1" stopColor="#1A202C" />
          </LinearGradient>

          {/* Inside is in shadow, and darkest at the back. */}
          <LinearGradient id="trayCavity" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05070B" />
            <Stop offset="1" stopColor="#161C27" />
          </LinearGradient>

          <LinearGradient id="trayBadge" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#FFD27A" />
            <Stop offset="0.55" stopColor={colors.primary} />
            <Stop offset="1" stopColor="#B87710" />
          </LinearGradient>

          <RadialGradient id="trayShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={100} cy={96} r={100} fill="url(#trayGlow)" />
        <Ellipse cx={100} cy={152} rx={60} ry={10} fill="url(#trayShadow)" />

        {/* Thickness, peeking out below and to the right. */}
        <Path
          d={`M${100 - RIM_RX + 4},${RIM_CY + 5} Q${100 - RIM_RX + 4},${RIM_CY + 34} ${100 - RIM_RX + 16},${RIM_CY + 46}
              Q${100 - RIM_RX + 20},${RIM_CY + 51} ${100 - RIM_RX + 28},${RIM_CY + 51}
              L${100 + RIM_RX - 20},${RIM_CY + 51} Q${100 + RIM_RX - 12},${RIM_CY + 51} ${100 + RIM_RX - 8},${RIM_CY + 46}
              Q${100 + RIM_RX + 4},${RIM_CY + 34} ${100 + RIM_RX + 4},${RIM_CY + 5} Z`}
          fill="#070A0F"
        />

        {/* Tray body, tapering in towards the base. */}
        <Path
          d={`M${100 - RIM_RX},${RIM_CY} Q${100 - RIM_RX},${RIM_CY + 30} ${100 - RIM_RX + 12},${RIM_CY + 42}
              Q${100 - RIM_RX + 16},${RIM_CY + 47} ${100 - RIM_RX + 24},${RIM_CY + 47}
              L${100 + RIM_RX - 24},${RIM_CY + 47} Q${100 + RIM_RX - 16},${RIM_CY + 47} ${100 + RIM_RX - 12},${RIM_CY + 42}
              Q${100 + RIM_RX},${RIM_CY + 30} ${100 + RIM_RX},${RIM_CY} Z`}
          fill="url(#trayBody)"
        />

        {/* Rim, then the hollow it surrounds. */}
        <Ellipse cx={100} cy={RIM_CY} rx={RIM_RX} ry={RIM_RY} fill="url(#trayRim)" />
        <Ellipse cx={100} cy={RIM_CY + 1} rx={RIM_RX - 9} ry={RIM_RY - 3.5} fill="url(#trayCavity)" />

        {/* The lit edge — upper left of the rim only, which is what sells
            the angle. Lighting the whole ellipse would flatten it again. */}
        <Path
          d={`M${100 - RIM_RX + 4},${RIM_CY - 4} A${RIM_RX} ${RIM_RY} 0 0 1 ${100 + 10},${RIM_CY - RIM_RY + 0.5}`}
          stroke="#FFFFFF"
          strokeOpacity={0.2}
          strokeWidth={1.75}
          fill="none"
          strokeLinecap="round"
        />

        {/* Slots down the tray's front, the way a real wire tray is ribbed. */}
        <G stroke="#000000" strokeOpacity={0.25} strokeWidth={2} strokeLinecap="round">
          <Path d={`M78,${RIM_CY + 16} L79,${RIM_CY + 38}`} />
          <Path d={`M100,${RIM_CY + 17} L100,${RIM_CY + 40}`} />
          <Path d={`M122,${RIM_CY + 16} L121,${RIM_CY + 38}`} />
        </G>

        {/* Request badge, punched out of the tray's lower-right. */}
        <Circle cx={146} cy={126} r={33} fill={colors.background} />
        <Circle cx={146} cy={126} r={28} fill="none" stroke="url(#trayBadge)" strokeWidth={4} />
        <Path
          d="M128,114 Q133,105 143,101"
          stroke="#FFE7B5"
          strokeOpacity={0.75}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />

        {/* An envelope — a request arriving is the thing that isn't happening. */}
        <G transform="translate(129, 114)">
          <Rect x={0} y={0} width={34} height={24} rx={4} fill={colors.primary} />
          <Path
            d="M2,4 L17,15 L32,4"
            stroke={colors.background}
            strokeOpacity={0.65}
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
          />
        </G>

        {/* Sparks, matching the calendar's. */}
        <G stroke={colors.primary} strokeLinecap="round" fill="none">
          <Path d="M26,70 L35,61" strokeWidth={4} />
          <Path d="M25,88 L30,83" strokeWidth={3.5} opacity={0.7} />
          <Path d="M172,72 L180,64" strokeWidth={4} />
          <Path d="M176,92 L181,87" strokeWidth={3.5} opacity={0.7} />
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
