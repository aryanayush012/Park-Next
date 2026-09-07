import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../theme';

/**
 * ParkNext splash — a gentle reveal of the wordmark logo, and nothing else.
 *
 * The native splash (expo-splash-screen) paints a solid amber field with no image, so the
 * hand-off is seamless: the amber never changes, the wordmark simply fades and settles into
 * it, holds a beat, and then the whole thing cross-fades away to reveal the app.
 *
 * Both animated properties are opacity and transform only, so this runs entirely on the
 * native driver. The app mounts underneath while it plays, so it costs no startup time.
 * Tapping anywhere skips it.
 */

/** Wordmark width as a share of the screen width. */
const LOGO_WIDTH_RATIO = 0.72;
/** Intrinsic aspect ratio of assets/logo-wordmark.png (1400 × 271). */
const LOGO_ASPECT = 1400 / 271;

const T = {
  reveal: { duration: 640 },
  hold: 420,
  fadeOut: 340,
};

export type AnimatedSplashProps = {
  /** Called once the reveal (or a skip tap) has finished and the overlay is invisible. */
  onFinish: () => void;
};

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const { width } = useWindowDimensions();
  const reveal = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const dismiss = useCallback(
    (duration: number) => {
      if (finishedRef.current) {
        return;
      }
      finishedRef.current = true;
      Animated.timing(overlay, {
        toValue: 0,
        duration,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinishRef.current());
    },
    [overlay],
  );

  const skip = useCallback(() => dismiss(160), [dismiss]);

  useEffect(() => {
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: T.reveal.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) {
        setTimeout(() => dismiss(T.fadeOut), T.hold);
      }
    });

    return () => animation.stop();
  }, [reveal, dismiss]);

  const logoWidth = Math.round(width * LOGO_WIDTH_RATIO);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);

  /** Settles in from a touch under full size — a lift, not a zoom. */
  const logoScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: overlay }]}>
      <Pressable
        style={styles.press}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      >
        <Animated.View style={{ opacity: reveal, transform: [{ scale: logoScale }] }}>
          <Image
            source={require('../../assets/logo-wordmark.png')}
            style={{ width: logoWidth, height: logoHeight }}
            resizeMode="contain"
            accessibilityLabel="ParkNext"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Matches the native splash's backgroundColor exactly, so the hand-off is invisible.
    backgroundColor: colors.logoAmber,
    zIndex: 10,
    elevation: 10,
  },
  press: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
