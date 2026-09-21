/**
 * ParkNext animated splash: a night map of the city, a car arriving from off
 * frame, a route lighting up ahead of it to a parking spot -- then the
 * wordmark.
 *
 * WHY THIS IS AN IN-APP OVERLAY, NOT THE NATIVE SPLASH
 * `expo-splash-screen` can only ever show a static image -- SDK 57's
 * `setOptions` exposes a fade `duration` and an iOS-only `fade` flag, nothing
 * else. So `app.json` sets the splash plugin's `backgroundColor` to this same
 * field colour and gives it no image at all, and this component paints over
 * it. The hand-off is therefore invisible: the black field is already on
 * screen, and the animation simply starts happening in it. `App.tsx` renders
 * this ABOVE the navigator, so the whole app mounts and boots underneath while
 * it plays -- it costs no startup time.
 *
 * WHY IT STAYS AT FULL FRAME RATE
 * The JS thread is busy booting at exactly this moment, so anything needing it
 * per frame will stutter. Every animated property here is opacity or transform
 * and runs on the native driver; nothing animates an SVG prop, which would
 * silently fall back to the JS driver. That constraint decides the structure:
 *
 *   - The map is ONE static <Svg> (SplashCity) that renders once and is
 *     memoised, despite being by far the busiest thing on screen. It is
 *     scenery, and contributes nothing to the animation.
 *   - Everything that moves is its own small layer above it, and is only ever
 *     translated, scaled or faded.
 *
 * THE ORDER OF EVENTS IS THE POINT
 * Map, then car, then route, then the spot: you are here, here is the way,
 * here is the bay. Playing those together would just be a lot of things
 * appearing at once; in sequence they are a sentence about what the app does.
 *
 * Honours the OS "reduce motion" setting: it then shows the finished frame --
 * the composition in the brand artwork -- holds, and fades out.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../theme/colors';
import { CAR_ASPECT, SplashCar } from './SplashCar';
import { SplashCity } from './SplashCity';
import {
  CAR_REST_Y,
  CAR_START_Y,
  CAR_X,
  MINI_PINS,
  PIN_GROUND,
  ROUTE_PATH,
  SCENE_H,
  SCENE_W,
} from './splashScene';

/* ------------------------------------------------------------------ layout */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** The map fills the width; `U` converts scene units to dp. */
const U = SCREEN_W / SCENE_W;
const SCENE_PX_H = SCENE_H * U;

/** Sized from the artwork: the car is about a fifth of the map's height. */
const CAR_LEN = 72 * U;
const CAR_W = CAR_LEN / CAR_ASPECT;

/** The pin, in scene units. Its tip lands on PIN_GROUND. */
const PIN_W = 46;
const PIN_H = 80;
/** The pin artwork's own box, which PIN_PATH is drawn in. */
const PIN_VB_W = 76;
const PIN_VB_H = 112;
const PIN_PATH =
  'M38,0 C17,0 0,17 0,38 C0,66 28,90 38,112 C48,90 76,66 76,38 C76,17 59,0 38,0 Z';

/**
 * The branding is pinned to the bottom of the screen rather than hung off the
 * bottom of the map. The map's height follows the screen's WIDTH (it keeps its
 * aspect), so anything positioned below it would drift up the screen on a tall
 * narrow phone and run off the end on a short wide one.
 */
const BRAND_BOTTOM = SCREEN_H * 0.11;

/**
 * Inter ExtraBold sets "ParkNext" about 4.59x its font size wide, measured;
 * the artwork gives the wordmark just over half the screen.
 */
const WORD_SIZE = Math.round((SCREEN_W * 0.52) / 4.59);
const BAR_W = Math.round(SCREEN_W * 0.36);

/* ---------------------------------------------------------------- timeline */

const AT = {
  city: 0,
  pins: 200,
  drive: 380,
  route: 1050,
  drop: 1300,
  brand: 1500,
  bar: 1650,
  steps: 1850,
};
const DUR = {
  city: 560,
  pins: 680, // covers the whole stagger; the offsets live in the interpolations
  drive: 850,
  route: 360,
  drop: 480,
  brand: 480,
  bar: 850,
  steps: 420,
  out: 320,
};
/** One full ripple, from the pin out to nothing. */
const RIPPLE_MS = 2100;
const RING_COUNT = 3;
const TOTAL = 2820;

/**
 * The car is already at speed when it enters the frame, so it only ever
 * decelerates -- it brakes into the bay rather than starting from rest in
 * mid-shot.
 */
const ARRIVE = Easing.out(Easing.cubic);

/* ---------------------------------------------------------------- component */

type Props = { onFinish: () => void };

export const AnimatedSplash: React.FC<Props> = ({ onFinish }) => {
  const city = useRef(new Animated.Value(0)).current;
  const pins = useRef(new Animated.Value(0)).current;
  const drive = useRef(new Animated.Value(0)).current;
  const route = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const brand = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const steps = useRef(new Animated.Value(0)).current;
  const veil = useRef(new Animated.Value(1)).current;
  /**
   * One value per ring rather than one value read at three phase offsets: the
   * offsets would have to wrap, and a plain staggered loop per ring says the
   * same thing without leaning on modulo arithmetic in the native driver.
   */
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0))
  ).current;

  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish();
  }, [onFinish]);

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

    if (reduceMotion) {
      // The finished frame, held: everything arrived, nothing travelling.
      for (const v of [city, pins, drive, route, drop, brand, bar, steps]) v.setValue(1);
      // One ring, parked mid-spread, so the spot still reads as marked.
      rings[0].setValue(0.4);
      const still = Animated.sequence([
        Animated.delay(1000),
        Animated.timing(veil, {
          toValue: 0,
          duration: DUR.out,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
      still.start(({ finished }) => finished && finish());
      return () => still.stop();
    }

    const step = (
      delay: number,
      value: Animated.Value,
      duration: number,
      easing: (t: number) => number
    ) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
      ]);

    // Each ring runs the same loop, started a third of a cycle apart, which is
    // what makes them read as one wave spreading rather than three rings
    // pulsing together.
    const ripples = rings.map((v, i) =>
      Animated.sequence([
        Animated.delay(AT.drop + (i * RIPPLE_MS) / RING_COUNT),
        Animated.loop(
          Animated.timing(v, {
            toValue: 1,
            duration: RIPPLE_MS,
            // Linear: a spreading wave travels at a constant rate, and easing
            // it would make every cycle visibly restart.
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
      ])
    );
    ripples.forEach((r) => r.start());

    const anim = Animated.parallel([
      step(AT.city, city, DUR.city, Easing.out(Easing.cubic)),
      step(AT.pins, pins, DUR.pins, Easing.linear),
      step(AT.drive, drive, DUR.drive, ARRIVE),
      step(AT.route, route, DUR.route, Easing.out(Easing.quad)),
      step(AT.drop, drop, DUR.drop, Easing.out(Easing.back(1.6))),
      step(AT.brand, brand, DUR.brand, Easing.out(Easing.cubic)),
      step(AT.bar, bar, DUR.bar, Easing.inOut(Easing.quad)),
      step(AT.steps, steps, DUR.steps, Easing.out(Easing.cubic)),
      Animated.sequence([
        Animated.delay(TOTAL - DUR.out),
        Animated.timing(veil, {
          toValue: 0,
          duration: DUR.out,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    anim.start(({ finished }) => finished && finish());
    return () => {
      anim.stop();
      ripples.forEach((r) => r.stop());
    };
  }, [reduceMotion, city, pins, drive, route, drop, rings, brand, bar, steps, veil, finish]);

  /** Tapping anywhere gets you past it -- this matters by the hundredth launch. */
  const skip = useCallback(() => {
    Animated.timing(veil, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(finish);
  }, [veil, finish]);

  const anims = useMemo(
    () => ({
      cityScale: city.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }),
      // Straight up the road it is already on. The route's own bend starts
      // ahead of where the car stops, so there is nothing here to steer around
      // and no rotation to interpolate.
      carY: drive.interpolate({
        inputRange: [0, 1],
        outputRange: [(CAR_START_Y - CAR_REST_Y) * U, 0],
      }),
      dropRise: drop.interpolate({ inputRange: [0, 1], outputRange: [-34 * U, 0] }),
      dropScale: drop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
      ringStyles: rings.map((v) => ({
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1.35] }) }],
        opacity: v.interpolate({
          inputRange: [0, 0.14, 0.7, 1],
          outputRange: [0, 0.9, 0.18, 0],
        }),
      })),
      brandRise: brand.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
    }),
    [city, drive, drop, rings, brand]
  );

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.field]}
      onPress={skip}
      accessibilityRole="none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.field, { opacity: veil }]}>
        {/* The map settles in rather than switching on. */}
        <Animated.View
          style={[styles.scene, { opacity: city, transform: [{ scale: anims.cityScale }] }]}
        >
          <SplashCity width={SCREEN_W} height={SCENE_PX_H} />
        </Animated.View>

        {/* Ripples on the ground, under everything else so the pin and the
            route sit on top of them. */}
        <Animated.View style={[styles.scene, { opacity: drop }]} pointerEvents="none">
          {anims.ringStyles.map((s, i) => (
            <Animated.View key={i} style={[StyleSheet.absoluteFill, s]}>
              <Svg width={SCREEN_W} height={SCENE_PX_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>
                <Ellipse
                  cx={PIN_GROUND[0]}
                  cy={PIN_GROUND[1]}
                  rx={68}
                  ry={20}
                  fill="none"
                  stroke={colors.logoAmber}
                  strokeWidth={2.6}
                />
              </Svg>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Route. One static Svg: three strokes of the same path, so the spill,
            the line and its hot core can never drift apart. */}
        <Animated.View style={[styles.scene, { opacity: route }]} pointerEvents="none">
          <Svg width={SCREEN_W} height={SCENE_PX_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>
            <Path
              d={ROUTE_PATH}
              stroke={colors.logoAmber}
              strokeOpacity={0.16}
              strokeWidth={15}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={ROUTE_PATH}
              stroke={colors.logoAmber}
              strokeOpacity={0.55}
              strokeWidth={6.5}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={ROUTE_PATH}
              stroke="#FFE7A6"
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </Animated.View>

        {/* The other spots on the map, arriving one after another. */}
        {MINI_PINS.map((p, i) => {
          // Staggered by slicing one value rather than running four animations.
          const from = i * 0.18;
          const pop = pins.interpolate({
            inputRange: [from, Math.min(0.999, from + 0.5)],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          });
          const w = PIN_W * p.scale * U;
          const h = PIN_H * p.scale * U;
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: p.x * U - w / 2,
                top: p.y * U - h,
                width: w,
                height: h,
                opacity: pop,
                // Grows out of its own tip, where it meets the ground.
                transform: [
                  { translateY: h / 2 },
                  { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                  { translateY: -h / 2 },
                ],
              }}
            >
              <PinArt />
            </Animated.View>
          );
        })}

        {/* The destination pin, dropping onto the spot. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: PIN_GROUND[0] * U - (PIN_W * U) / 2,
            top: (PIN_GROUND[1] - PIN_H) * U,
            width: PIN_W * U,
            height: PIN_H * U,
            opacity: drop,
            transform: [
              { translateY: anims.dropRise },
              { translateY: (PIN_H * U) / 2 },
              { scale: anims.dropScale },
              { translateY: -(PIN_H * U) / 2 },
            ],
          }}
        >
          <PinArt />
        </Animated.View>

        {/* Clipped to the map. The car starts below SCENE_H so it can drive
            IN rather than fade up -- but the scene is only as tall as the map,
            and the branding sits further down still, so without this the first
            frame is a car parked in the black gap between the two. */}
        <View style={styles.sceneClip} pointerEvents="none">
          <Animated.View style={[styles.car, { transform: [{ translateY: anims.carY }] }]}>
            <SplashCar width={CAR_W} height={CAR_LEN} />
          </Animated.View>
        </View>

        <View style={styles.brand} pointerEvents="none">
          <Animated.Text
            allowFontScaling={false}
            style={[
              styles.wordmark,
              { opacity: brand, transform: [{ translateY: anims.brandRise }] },
            ]}
          >
            Park<Text style={styles.wordmarkAccent}>Next</Text>
          </Animated.Text>

          <Animated.Text
            allowFontScaling={false}
            style={[
              styles.tagline,
              { opacity: brand, transform: [{ translateY: anims.brandRise }] },
            ]}
          >
            PARK SMART   LIVE BETTER
          </Animated.Text>

          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  // Fills from the left edge instead of growing out of the
                  // middle. RN has no transform-origin; this is the stand-in.
                  transform: [
                    { translateX: -BAR_W / 2 },
                    { scaleX: bar },
                    { translateX: BAR_W / 2 },
                  ],
                },
              ]}
            />
          </View>

          <Animated.Text allowFontScaling={false} style={[styles.steps, { opacity: steps }]}>
            FIND <Text style={styles.stepDot}>•</Text> BOOK <Text style={styles.stepDot}>•</Text>{' '}
            PARK
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

/** The map pin, at whatever size its container gives it. */
function PinArt() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${PIN_VB_W} ${PIN_VB_H}`}>
      <Defs>
        <LinearGradient id="pnPin" x1="0" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor="#FFE08A" />
          <Stop offset="0.45" stopColor={colors.logoAmber} />
          <Stop offset="1" stopColor="#D4890B" />
        </LinearGradient>
        <RadialGradient id="pnPinGlow" cx="50%" cy="34%" r="52%">
          <Stop offset="0" stopColor={colors.logoAmber} stopOpacity="0.45" />
          <Stop offset="1" stopColor={colors.logoAmber} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={38} cy={38} rx={38} ry={38} fill="url(#pnPinGlow)" />
      <Path d={PIN_PATH} fill="url(#pnPin)" />
      {/* Lit edge up the near side -- what makes it read as a solid. */}
      <Path
        d="M9,54 C3,45 3,28 13,16 C18,10 25,6 32,4"
        stroke="#FFF3CE"
        strokeOpacity={0.6}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <Ellipse cx={38} cy={36} rx={14} ry={14} fill="#0A0B0F" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  field: { backgroundColor: colors.background },
  scene: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_W,
    height: SCENE_PX_H,
  },
  sceneClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SCREEN_W,
    height: SCENE_PX_H,
    overflow: 'hidden',
  },
  car: {
    position: 'absolute',
    left: CAR_X * U - CAR_W / 2,
    top: CAR_REST_Y * U - CAR_LEN / 2,
    width: CAR_W,
    height: CAR_LEN,
  },
  brand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BRAND_BOTTOM,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: WORD_SIZE,
    color: colors.textPrimary,
    textShadowColor: 'rgba(251, 177, 18, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  wordmarkAccent: { color: colors.logoAmber },
  tagline: {
    marginTop: Math.round(WORD_SIZE * 0.3),
    fontFamily: 'Inter_500Medium',
    fontSize: Math.round(WORD_SIZE * 0.3),
    letterSpacing: Math.round(WORD_SIZE * 0.3) / 2.6,
    color: 'rgba(245, 246, 248, 0.86)',
  },
  barTrack: {
    marginTop: Math.round(WORD_SIZE * 0.95),
    width: BAR_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(245, 246, 248, 0.14)',
    overflow: 'hidden',
  },
  barFill: {
    width: BAR_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.logoAmber,
  },
  steps: {
    marginTop: Math.round(WORD_SIZE * 0.62),
    fontFamily: 'Inter_600SemiBold',
    fontSize: Math.round(WORD_SIZE * 0.25),
    letterSpacing: Math.round(WORD_SIZE * 0.25) / 2.2,
    color: 'rgba(245, 246, 248, 0.5)',
  },
  stepDot: { color: colors.logoAmber },
});
