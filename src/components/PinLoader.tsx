import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors, spacing, typography } from '../theme';

/**
 * The app's loading state: its own map pin, turning.
 *
 * Replaces the stock spinner, which said nothing about the product and
 * looked like every other app's wait. The pin rotates about its vertical
 * axis with a real perspective transform, so it reads as a solid object
 * turning rather than a flat image spinning — and the shading is built the
 * same way as the rest of the app's art (diagonal gradient for the light, a
 * lit edge up the left, a contact shadow to sit it on the ground).
 *
 * The shadow squashes as the pin turns edge-on, which is the cue that makes
 * the rotation read as three-dimensional rather than as a wobble.
 */

const VIEW = 100;
const SPIN_MS = 2200;

export interface PinLoaderProps {
  /** Pin height in dp. */
  size?: number;
  /** Optional line underneath — "Loading booking…" and the like. */
  label?: string;
  style?: ViewStyle;
}

export function PinLoader({ size = 64, label, style }: PinLoaderProps) {
  const spin = useRef(new Animated.Value(0)).current;
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
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        // Linear: any easing makes a continuous rotation visibly stutter
        // each time the loop restarts.
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, spin]);

  const rotateY = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Widest face-on, thinnest edge-on — twice per turn.
  const shadowScale = spin.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 0.55, 1, 0.55, 1],
  });

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <View style={{ width: size, height: size * 1.18 }}>
        <Animated.View
          style={[
            styles.pin,
            {
              transform: [
                // Without a perspective the rotation flattens into a
                // horizontal squeeze and stops reading as an object.
                { perspective: 600 },
                { rotateY },
              ],
            },
          ]}
        >
          <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW * 1.18}`}>
            <Defs>
              <LinearGradient id="pinBody" x1="0" y1="0" x2="0.85" y2="1">
                <Stop offset="0" stopColor="#FFD27A" />
                <Stop offset="0.45" stopColor={colors.primary} />
                <Stop offset="1" stopColor="#9A6410" />
              </LinearGradient>
              <RadialGradient id="pinHole" cx="50%" cy="45%" r="55%">
                <Stop offset="0" stopColor="#0A0D13" />
                <Stop offset="1" stopColor="#1A2029" />
              </RadialGradient>
            </Defs>

            {/* Teardrop: round head, tapering to a point. */}
            <Path
              d={`M50,8 C28,8 12,24 12,45 C12,70 38,92 50,110 C62,92 88,70 88,45 C88,24 72,8 50,8 Z`}
              fill="url(#pinBody)"
            />
            {/* Lit edge up the left, which is what gives it a near side. */}
            <Path
              d="M20,60 C13,52 13,36 22,25 C27,19 34,15 41,13"
              stroke="#FFE7B5"
              strokeOpacity={0.65}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={50} cy={44} r={17} fill="url(#pinHole)" />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[styles.shadowWrap, { transform: [{ scaleX: shadowScale }] }]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 20">
            <Defs>
              <RadialGradient id="pinShadow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={50} cy={10} rx={34} ry={7} fill="url(#pinShadow)" />
          </Svg>
        </Animated.View>
      </View>

      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    flex: 1,
  },
  shadowWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -6,
    height: 14,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
