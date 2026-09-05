import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

const THUMB = 24;
const TRACK_HEIGHT = 4;

export interface SliderProps {
  min: number;
  max: number;
  /** Values snap to this. Defaults to 1. */
  step?: number;
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel?: string;
}

/**
 * Single-thumb horizontal slider.
 *
 * Hand-rolled on `PanResponder` rather than `@react-native-community/slider`,
 * which is a native module and so a rebuild — this app ships as a dev build
 * loading JS from Metro. `PanResponder` is already how the Home screen's
 * bottom sheet is dragged, so this is the same mechanism.
 *
 * Two things make the drag smooth, and both are easy to get wrong:
 *
 * 1. The `PanResponder` is built exactly once. Everything the handlers need
 *    lives in refs, so no prop change can rebuild it — rebuilding mid-gesture
 *    swaps the responder out from under the active touch, which reads as the
 *    thumb sticking and needing to be re-grabbed.
 * 2. While dragging, the thumb renders from local state rather than waiting
 *    for the parent to echo the new value back through `value`. The parent may
 *    be recomputing a filtered list and a set of map markers on each tick; the
 *    thumb should not be hostage to that.
 */
export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  accessibilityLabel,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  /** Non-null only during a drag, and then it wins over `value`. */
  const [dragValue, setDragValue] = useState<number | null>(null);

  const span = Math.max(max - min, step);
  const travel = Math.max(trackWidth - THUMB, 1);

  // Read by the handlers below, which are created once and so must never
  // close over a prop directly.
  const latest = useRef({ min, max, step, span, travel, value, onChange });
  latest.current = { min, max, step, span, travel, value, onChange };

  const dragStart = useRef(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Capture-phase handlers are what make this draggable at all: the
        // capture pass runs parent-to-child, so the slider claims the touch
        // before an enclosing ScrollView can start scrolling with it.
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Once the drag is ours, the ScrollView cannot take it back.
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          const { min: lo, max: hi, step: s, span: sp, travel: tr } = latest.current;
          const snap = (raw: number) =>
            Math.round(Math.min(Math.max(raw, lo), hi) / s) * s;
          // A press anywhere on the track jumps the thumb there. `locationX`
          // is relative to this view, so no absolute measurement is needed.
          const next = snap(lo + ((event.nativeEvent.locationX - THUMB / 2) / tr) * sp);
          dragStart.current = next;
          setDragValue(next);
          if (next !== latest.current.value) latest.current.onChange(next);
        },

        onPanResponderMove: (_event, gesture) => {
          const { min: lo, max: hi, step: s, span: sp, travel: tr } = latest.current;
          const snap = (raw: number) =>
            Math.round(Math.min(Math.max(raw, lo), hi) / s) * s;
          const next = snap(dragStart.current + (gesture.dx / tr) * sp);
          setDragValue((current) => (current === next ? current : next));
          if (next !== latest.current.value) latest.current.onChange(next);
        },

        onPanResponderRelease: () => setDragValue(null),
        onPanResponderTerminate: () => setDragValue(null),
      }),
    []
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const shown = dragValue ?? value;
  const progress = Math.min(Math.max((shown - min) / span, 0), 1);

  return (
    <View
      style={styles.container}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: shown }}
      {...panResponder.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: progress * travel + THUMB / 2 }]} />
      </View>
      <View style={[styles.thumb, { left: progress * travel }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: THUMB + 16,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceBorder,
    marginHorizontal: THUMB / 2,
  },
  fill: {
    position: 'absolute',
    left: -THUMB / 2,
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
