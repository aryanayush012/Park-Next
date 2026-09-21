import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';

/**
 * The picture on "waiting for host approval": a map pin hovering over
 * ripples, as though it has just been dropped and is still settling.
 *
 * The ripples are the point — a pin sitting still would read as "arrived",
 * and this screen is about a request that is out and unanswered. The pin
 * rises and falls while they tighten and fade beneath it, the same
 * float-and-shadow pairing the house markers use on the map: without the
 * ripples reacting, a bobbing pin reads as a glitch rather than as
 * something hovering.
 *
 * Drawn as three stacked layers sharing one viewBox — backdrop, ripples,
 * pin — because a single SVG cannot move its parts independently under the
 * native driver.
 */

const VIEW_W = 220;
const VIEW_H = 190;

/** Where the pin floats and where its ripples land. */
const PIN_CX = 110;
const GROUND_Y = 150;

/** One full rise and fall. */
const FLOAT_MS = 2400;
/** How far the pin lifts, in viewBox units scaled with the art. */
const LIFT_RATIO = 9 / VIEW_H;

export interface WaitingPinArtProps {
  size?: number;
  style?: ViewStyle;
}

export function WaitingPinArt({ size = 190, style }: WaitingPinArtProps) {
  const height = size * (VIEW_H / VIEW_W);
  const float = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return; // still asking the OS
    if (reduceMotion) return; // a still pin is the whole accommodation

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: FLOAT_MS / 2,
          // Eases at both ends, so the pin slows as it turns rather than
          // snapping direction at the top and bottom of the arc.
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: FLOAT_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, float]);

  const pinLift = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -height * LIFT_RATIO],
  });
  // Tighter and fainter as the pin pulls away, which is what sells the lift.
  const rippleScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] });
  const rippleFade = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] });

  const layer: ViewStyle = { position: 'absolute', width: size, height };

  return (
    <View
      style={[styles.wrap, { width: size, height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Backdrop: halo and cloud bank. Static — the light source and the
          sky do not move with the pin. */}
      <View style={layer}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <RadialGradient id="wpGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.primary} stopOpacity="0.30" />
              <Stop offset="0.55" stopColor={colors.primary} stopOpacity="0.08" />
              <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx={PIN_CX} cy={82} rx={104} ry={82} fill="url(#wpGlow)" />
          <G fill={colors.surfaceElevated} opacity={0.75}>
            <Ellipse cx={48} cy={104} rx={30} ry={13} />
            <Ellipse cx={72} cy={98} rx={20} ry={11} />
            <Ellipse cx={176} cy={100} rx={28} ry={12} />
            <Ellipse cx={152} cy={94} rx={18} ry={10} />
          </G>
        </Svg>
      </View>

      <Animated.View
        style={[layer, { opacity: rippleFade, transform: [{ scale: rippleScale }] }]}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {/* Widest and faintest outermost, as a spreading wave. */}
          <Ellipse
            cx={PIN_CX}
            cy={GROUND_Y}
            rx={68}
            ry={15}
            fill="none"
            stroke={colors.primary}
            strokeOpacity={0.22}
            strokeWidth={2.5}
          />
          <Ellipse
            cx={PIN_CX}
            cy={GROUND_Y}
            rx={46}
            ry={10}
            fill="none"
            stroke={colors.primary}
            strokeOpacity={0.45}
            strokeWidth={2.5}
          />
          <Ellipse
            cx={PIN_CX}
            cy={GROUND_Y}
            rx={24}
            ry={5.5}
            fill="none"
            stroke={colors.primary}
            strokeOpacity={0.75}
            strokeWidth={2.5}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[layer, { transform: [{ translateY: pinLift }] }]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          <Defs>
            <LinearGradient id="wpPin" x1="0" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor="#FFD873" />
              <Stop offset="0.45" stopColor={colors.primary} />
              <Stop offset="1" stopColor="#D9910F" />
            </LinearGradient>
          </Defs>
          <G transform={`translate(${PIN_CX - 38}, 16)`}>
            <Path
              d="M38,0 C17,0 0,17 0,38 C0,66 28,90 38,112 C48,90 76,66 76,38 C76,17 59,0 38,0 Z"
              fill="url(#wpPin)"
            />
            {/* Lit edge up the near side — the detail that makes it a solid. */}
            <Path
              d="M9,54 C3,45 3,28 13,16 C18,10 25,6 32,4"
              stroke="#FFF0C2"
              strokeOpacity={0.7}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
            <Ellipse cx={38} cy={36} rx={15} ry={15} fill={colors.background} />
          </G>
          {/* Sparks ride with the pin, matching the empty-state art. */}
          <G stroke={colors.primary} strokeLinecap="round" fill="none" strokeWidth={4}>
            <Path d="M36,58 L48,44" />
            <Path d="M184,58 L172,44" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
