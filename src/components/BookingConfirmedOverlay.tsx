import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SuccessBurst } from './SuccessBurst';
import { colors, duration as motionDuration, easing as motionEasing, spacing, typography } from '../theme';

/**
 * The moment a booking is confirmed: a burst, a popper, and then it gets out
 * of the way.
 *
 * It plays once, over the Active Booking screen, and dismisses itself —
 * rather than being a screen of its own that has to be navigated past. A
 * booking has one home, and this is a beat in front of it, not a separate
 * place.
 *
 * Reduce Motion is honoured by skipping the flight and holding the still
 * frame for the same beat, so the message still lands.
 */

/** How long the celebration holds before it fades out of the way. */
const HOLD_MS = 1900;
const CONFETTI_COUNT = 14;

interface Piece {
  angle: number;
  distance: number;
  color: string;
  size: number;
  delay: number;
  spin: number;
}

/**
 * Fired outward in a fan, not a full circle: a popper throws its contents
 * up and sideways, and pieces raining from below reads as a glitch.
 */
function buildPieces(): Piece[] {
  const palette = [colors.primary, colors.secondary, '#FFD27A', '#5BF0D8'];
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const spread = -160 + (320 / (CONFETTI_COUNT - 1)) * i;
    return {
      angle: (spread * Math.PI) / 180,
      distance: 90 + ((i * 37) % 60),
      color: palette[i % palette.length],
      size: i % 3 === 0 ? 10 : 7,
      delay: (i % 5) * 40,
      spin: i % 2 === 0 ? 1 : -1,
    };
  });
}

export interface BookingConfirmedOverlayProps {
  title: string;
  subtitle: string;
  /** Called once the celebration has finished and faded out. */
  onDone: () => void;
}

export function BookingConfirmedOverlay({
  title,
  subtitle,
  onDone,
}: BookingConfirmedOverlayProps) {
  const pieces = useMemo(buildPieces, []);
  const enter = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
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

    // `onDone` unmounts this, so it must never fire from inside the driver's
    // callback after an early unmount — the cancelled flag guards that.
    let cancelled = false;
    const finish = () => {
      if (!cancelled) onDone();
    };

    if (reduceMotion) {
      enter.setValue(1);
      const timer = setTimeout(finish, HOLD_MS);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    const sequence = Animated.sequence([
      Animated.parallel([
        Animated.timing(enter, {
          toValue: 1,
          duration: motionDuration.celebrate,
          easing: motionEasing.spring,
          useNativeDriver: true,
        }),
        Animated.timing(fly, {
          toValue: 1,
          duration: 900,
          easing: motionEasing.out,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.timing(exit, {
        toValue: 0,
        duration: motionDuration.settle,
        easing: motionEasing.out,
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) finish();
    });
    return () => {
      cancelled = true;
      sequence.stop();
    };
  }, [reduceMotion, enter, fly, exit, onDone]);

  if (reduceMotion === null) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: exit }]}
      // Announced as one message; the confetti is decoration and shouldn't
      // be walked through by a screen reader.
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.stage}>
        {pieces.map((piece, index) => (
          <Animated.View
            key={index}
            pointerEvents="none"
            style={[
              styles.piece,
              {
                width: piece.size,
                height: piece.size * 0.6,
                backgroundColor: piece.color,
                opacity: fly.interpolate({
                  inputRange: [0, 0.15, 0.75, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: fly.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(piece.angle) * piece.distance],
                    }),
                  },
                  {
                    // Up and out, then gravity takes it — the arc is what
                    // makes it read as thrown rather than as a starburst.
                    translateY: fly.interpolate({
                      inputRange: [0, 0.55, 1],
                      outputRange: [
                        0,
                        -Math.cos(piece.angle) * piece.distance,
                        -Math.cos(piece.angle) * piece.distance + 46,
                      ],
                    }),
                  },
                  {
                    rotate: fly.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${piece.spin * 420}deg`],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}

        <Animated.View
          style={{
            opacity: enter,
            transform: [
              {
                scale: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 1],
                }),
              },
            ],
          }}
        >
          <SuccessBurst size={150} />
        </Animated.View>
      </View>

      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        }}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Opaque: the screen underneath is the destination, and letting it show
    // through turns the celebration into clutter over live content.
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
});
