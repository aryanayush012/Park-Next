import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { BrandFooter } from '../../components/BrandFooter';
import { useTranslation } from '../../i18n';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

import type { TranslationKey } from '../../i18n';

interface Slide {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Looked up at render, so switching language re-reads them. */
  eyebrowKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}

const SLIDES: Slide[] = [
  {
    // Was 'pricetag' — that reads as pricing, not "find a spot near you",
    // which is what this slide is actually about.
    icon: 'search',
    eyebrowKey: 'onboarding.slide1Eyebrow',
    titleKey: 'onboarding.slide1Title',
    descriptionKey: 'onboarding.slide1Body',
  },
  {
    icon: 'time',
    eyebrowKey: 'onboarding.slide2Eyebrow',
    titleKey: 'onboarding.slide2Title',
    descriptionKey: 'onboarding.slide2Body',
  },
  {
    icon: 'navigate',
    eyebrowKey: 'onboarding.slide3Eyebrow',
    titleKey: 'onboarding.slide3Title',
    descriptionKey: 'onboarding.slide3Body',
  },
];

// How far the icon/text drift in from (and out toward) while crossfading —
// a hint of motion, not a slide-the-whole-screen carousel.
const SHIFT_DISTANCE = 18;
const FADE_OUT_MS = 140;
const FADE_IN_MS = 220;
/** Below this drag distance, a swipe release is treated as a tap/cancel. */
const SWIPE_THRESHOLD = 50;

// The illustration "porthole" — a soft glow, a slowly-rotating dashed ring
// (this app's own road-lane-dash motif, borrowed from the icon/splash), and
// the solid badge backdrop, all concentric. Sized here once so every layer's
// centering offset is computed from the same numbers instead of guessed.
const GLOW_SIZE = 280;
const RING_SIZE = 208;
const CIRCLE_SIZE = 180;
const BADGE_WRAP_SIZE = 132;

export function OnboardingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  // Only the icon + text crossfade; the illustration circle, ring, dots and
  // footer never move — one shared value drives both since they transition
  // together.
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentShift = useRef(new Animated.Value(0)).current;
  // The icon gets its own bouncier pop on top of the shared fade+shift above
  // — a plain cubic ease reads as "fading", a back-eased scale reads as
  // "arriving", which is the bit of extra life the text doesn't need.
  const iconScale = useRef(new Animated.Value(1)).current;
  // Guards against a second swipe/tap landing mid-transition and stacking
  // animations — the same "don't re-enter while one's in flight" guard used
  // for the location hook's AppState listener elsewhere in this app.
  const isAnimating = useRef(false);

  // The one continuous, ambient motion on this screen — everything else
  // only moves in response to an actual interaction. Respects the OS's
  // reduce-motion setting, same as the animated splash does.
  const ringRotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!alive || reduced) return;
        loop = Animated.loop(
          Animated.timing(ringRotation, {
            toValue: 1,
            duration: 24000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        loop.start();
      })
      .catch(() => {});
    return () => {
      alive = false;
      loop?.stop();
    };
  }, [ringRotation]);
  const ringSpin = ringRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const goToSignIn = () => navigation.replace('SignIn');

  const goToIndex = useCallback(
    (nextIndex: number, direction: 1 | -1) => {
      if (isAnimating.current || nextIndex < 0 || nextIndex >= SLIDES.length) return;
      isAnimating.current = true;

      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentShift, {
          toValue: -direction * SHIFT_DISTANCE,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 0.55,
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Content is fully invisible here — safe to swap the icon/text
        // underneath without the old and new ever being visible together.
        setActiveIndex(nextIndex);
        contentShift.setValue(direction * SHIFT_DISTANCE);
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(contentShift, {
            toValue: 0,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // A gentle overshoot past 1 before settling — the "pop".
          Animated.timing(iconScale, {
            toValue: 1,
            duration: FADE_IN_MS + 80,
            easing: Easing.out(Easing.back(1.8)),
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimating.current = false;
        });
      });
    },
    [contentOpacity, contentShift, iconScale]
  );

  const handleNext = () => {
    if (isLastSlide) {
      goToSignIn();
      return;
    }
    goToIndex(activeIndex + 1, 1);
  };

  const handlePrev = () => goToIndex(activeIndex - 1, -1);

  // One progress value per dot (0 = inactive, 1 = active), animated in
  // parallel whenever the active slide changes — same width/colour ->
  // useNativeDriver:false trade-off components/Toggle.tsx already makes,
  // since neither width nor backgroundColor can run on the native driver.
  const dotProgress = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  useEffect(() => {
    Animated.parallel(
      dotProgress.map((value, i) =>
        Animated.timing(value, {
          toValue: i === activeIndex ? 1 : 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [activeIndex, dotProgress]);

  // Read inside the gesture handlers below, which are created once and so
  // must never close over `activeIndex`/`isLastSlide` directly — same
  // reasoning as the `latest` ref in components/Slider.tsx.
  const latest = useRef({ activeIndex, isLastSlide });
  latest.current = { activeIndex, isLastSlide };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx <= -SWIPE_THRESHOLD) {
          const { activeIndex: current, isLastSlide: last } = latest.current;
          if (last) goToSignIn();
          else goToIndex(current + 1, 1);
        } else if (gesture.dx >= SWIPE_THRESHOLD) {
          goToIndex(latest.current.activeIndex - 1, -1);
        }
      },
    })
  ).current;

  const slide = SLIDES[activeIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.pager} {...panResponder.panHandlers}>
        <View style={styles.slide}>
          <View style={styles.illustration}>
            <View style={styles.portholeStage}>
              {/* Ambient depth behind the ring — constant, never crossfades. */}
              <View style={styles.glow} pointerEvents="none">
                <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
                  <Defs>
                    <RadialGradient id="onboardGlow" cx="50%" cy="50%" r="50%">
                      <Stop offset={0} stopColor={colors.logoAmber} stopOpacity={0.22} />
                      <Stop offset={1} stopColor={colors.logoAmber} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#onboardGlow)" />
                </Svg>
              </View>

              {/* The signature: this app's dashed lane markings, slowly
                  circling the illustration rather than laid on a road. */}
              <Animated.View
                style={[styles.dashRing, { transform: [{ rotate: ringSpin }] }]}
                pointerEvents="none"
              >
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_SIZE / 2 - 1.5}
                    stroke={colors.logoAmber}
                    strokeOpacity={0.45}
                    strokeWidth={2}
                    strokeDasharray="7 10"
                    fill="none"
                  />
                </Svg>
              </Animated.View>

              <View style={styles.illustrationCircle}>
                <View style={styles.badgeWrap}>
                  {/* Per-slide flourish — composition changes, not just the
                      glyph, so each step reads as its own moment. */}
                  <Animated.View style={{ opacity: contentOpacity }} pointerEvents="none">
                    {activeIndex === 0 ? (
                      <>
                        <View style={styles.searchRingOuter} />
                        <View style={styles.searchRingInner} />
                      </>
                    ) : null}
                    {activeIndex === 2 ? (
                      <View style={styles.trailDash}>
                        <Svg width={70} height={44} viewBox="0 0 70 44">
                          <Path
                            d="M4,40 C20,40 30,10 66,6"
                            stroke={colors.logoAmber}
                            strokeOpacity={0.55}
                            strokeWidth={2}
                            strokeDasharray="6 8"
                            strokeLinecap="round"
                            fill="none"
                          />
                        </Svg>
                      </View>
                    ) : null}
                  </Animated.View>

                  <Animated.View
                    style={[
                      styles.bubble,
                      {
                        opacity: contentOpacity,
                        transform: [{ translateX: contentShift }, { scale: iconScale }],
                      },
                    ]}
                  >
                    <Ionicons name={slide.icon} size={32} color={colors.textOnPrimary} />
                    {activeIndex === 1 ? (
                      <View style={styles.clockChip}>
                        <Ionicons name="time" size={12} color={colors.textOnPrimary} />
                      </View>
                    ) : null}
                  </Animated.View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.dots}>
            {SLIDES.map((_, dotIndex) => (
              <Animated.View
                key={dotIndex}
                style={[
                  styles.dot,
                  {
                    width: dotProgress[dotIndex].interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 24],
                    }),
                    backgroundColor: dotProgress[dotIndex].interpolate({
                      inputRange: [0, 1],
                      outputRange: [colors.surfaceBorder, colors.primary],
                    }),
                  },
                ]}
              />
            ))}
          </View>

          <Animated.View
            style={{ opacity: contentOpacity, transform: [{ translateX: contentShift }] }}
          >
            <Text style={styles.eyebrow}>{t(slide.eyebrowKey)}</Text>
            <Text style={styles.title}>{t(slide.titleKey)}</Text>
            <Text style={styles.description}>{t(slide.descriptionKey)}</Text>
          </Animated.View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label={isLastSlide ? t('onboarding.getStarted') : t('onboarding.next')} onPress={handleNext} />
        {!isLastSlide ? (
          <Text style={styles.skip} onPress={goToSignIn}>
            Skip
          </Text>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>
      <BrandFooter height={96} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pager: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  portholeStage: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  dashRing: {
    position: 'absolute',
    top: (GLOW_SIZE - RING_SIZE) / 2,
    left: (GLOW_SIZE - RING_SIZE) / 2,
  },
  illustrationCircle: {
    position: 'absolute',
    top: (GLOW_SIZE - CIRCLE_SIZE) / 2,
    left: (GLOW_SIZE - CIRCLE_SIZE) / 2,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: {
    width: BADGE_WRAP_SIZE,
    height: BADGE_WRAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRingOuter: {
    position: 'absolute',
    top: (BADGE_WRAP_SIZE - 120) / 2,
    left: (BADGE_WRAP_SIZE - 120) / 2,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    opacity: 0.25,
  },
  searchRingInner: {
    position: 'absolute',
    top: (BADGE_WRAP_SIZE - 88) / 2,
    left: (BADGE_WRAP_SIZE - 88) / 2,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: colors.secondary,
    opacity: 0.4,
  },
  trailDash: {
    position: 'absolute',
    left: -6,
    bottom: 10,
  },
  bubble: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  clockChip: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.logoAmber,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.xxs,
  },
  dot: {
    height: 8,
    borderRadius: radius.full,
  },
  eyebrow: {
    ...typography.caption,
    fontFamily: fontFamily.bold,
    color: colors.logoAmber,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  skip: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  skipSpacer: {
    height: 20,
    marginTop: spacing.md,
  },
});
