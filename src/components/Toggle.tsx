import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 24;
const TRACK_PADDING = 2;

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** The switch carries no visible label of its own — give it one here. */
  accessibilityLabel?: string;
}

/**
 * Themed on/off switch.
 *
 * Custom rather than React Native's own `Switch`, which renders with platform
 * (Material / iOS) chrome that ignores this app's palette — the same reason
 * `Checkbox` is hand-rolled instead of pulling in a dependency for one control.
 */
export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      // `backgroundColor` can't be driven natively, and both halves of the
      // animation share one value — so neither can. It's a 30pt control.
      useNativeDriver: false,
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH - KNOB_SIZE - TRACK_PADDING * 2],
  });

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceElevated, colors.primary],
  });

  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceBorder, colors.primary],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { backgroundColor, borderColor }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    borderWidth: 1,
    padding: TRACK_PADDING,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: radius.full,
    backgroundColor: colors.textPrimary,
  },
});
