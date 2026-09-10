/**
 * ParkNext animated splash: a car drives in, lays the road as it goes, the road
 * closes into the ParkNext "P", and the car noses into the bay and becomes the
 * location pin.
 *
 * WHY THIS IS AN IN-APP OVERLAY, NOT THE NATIVE SPLASH
 * `expo-splash-screen` can only ever show a static image -- SDK 57's
 * `setOptions` exposes a fade `duration` and an iOS-only `fade` flag, nothing
 * else. So `app.json` sets the splash plugin's `backgroundColor` to the logo
 * amber and gives it no image at all, and this component paints the same amber
 * and animates on top of it. The hand-off is therefore invisible: the amber
 * field is already on screen, and the animation simply starts happening in it.
 * `App.tsx` renders this ABOVE the navigator, so the whole app mounts and boots
 * underneath while it plays -- it costs no startup time.
 *
 * WHY IT STAYS AT FULL FRAME RATE
 * Every animated property is opacity or transform, so all of it runs on the
 * native driver -- which matters more here than anywhere else in the app, since
 * the JS thread is busy booting at exactly this moment. Nothing animates an SVG
 * prop (that would silently fall back to the JS driver), which is why each
 * moving piece is its own <Animated.View> wrapping its own small <Svg> rather
 * than one big SVG with animated children.
 *
 * The road is revealed as a sequence of ribbon slices, each with its own
 * bounding box so its layer is a small view -- 30-odd full-tile layers stacked
 * on top of each other would be a lot of overdraw for the first thing a user
 * sees. Geometry, including the reveal order, lives in `splashGeometry.ts`
 * (traced from the icon artwork; see that file's header).
 *
 * Honours the OS "reduce motion" setting: it then goes straight to the finished
 * logo, holds, and fades out.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../theme/colors';
import { SPLASH } from './splashGeometry';
import { CAR_ASPECT, SplashCar } from './SplashCar';

/* ------------------------------------------------------------------ layout */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const TILE_PX = Math.round(SCREEN_W * 0.8);
/** One tile unit in dp. Every number in `splashGeometry` is in tile units. */
const U = TILE_PX / SPLASH.tile;
const TILE_TOP = Math.round(SCREEN_H * 0.29);
const TILE_LEFT = Math.round((SCREEN_W - TILE_PX) / 2);

const WORDMARK = require('../../assets/logo-wordmark.png');
/** Intrinsic size of assets/logo-wordmark.png. `Image.resolveAssetSource` can
 * do this at runtime, but it crashes when called at module scope before the
 * image is registered — not worth it for a value that only changes if the
 * asset file itself does. */
const WORDMARK_ASPECT = 1400 / 285;
const WORDMARK_W = Math.round(TILE_PX * 0.8);
const WORDMARK_H = Math.round(WORDMARK_W / WORDMARK_ASPECT);

const CAR_L = SPLASH.carLen;
const CAR_W = CAR_L / CAR_ASPECT;

/* ---------------------------------------------------------------- timeline */

const T = {
  drive: 1500, // car enters and drives the road
  park: 480, // turns off the road and noses into the bay
  resolve: 420, // car -> pin
  paint: 1900, // lane markings, laid down just behind the car
  fill: 380, // the P's counter floods in as the loop closes
  word: 320,
  hold: 420,
  out: 320,
};
const AT_FILL = 1140;
const AT_RESOLVE = T.drive + T.park - 40; // overlaps the end of the turn
const AT_WORD = T.drive + T.park + 120;
const TOTAL = AT_RESOLVE + T.resolve + T.hold + T.out;

/**
 * Cruise, then brake -- one continuous curve rather than an ease-out chained
 * into an ease-in, which would decelerate to a dead stop mid-move and then
 * lurch. `V0` is chosen so f(1) = 1 exactly and the derivative is continuous at
 * the seam, so there is no velocity discontinuity anywhere.
 */
const BRAKE_AT = 0.45;
const V0 = 2 / (1 + BRAKE_AT);
const cruiseThenBrake = (t: number) =>
  t <= BRAKE_AT
    ? V0 * t
    : V0 * BRAKE_AT + V0 * (t - BRAKE_AT) - (V0 / (2 * (1 - BRAKE_AT))) * (t - BRAKE_AT) ** 2;

/* ------------------------------------------------------------------ helpers */

/** 0 -> 1 across [from, to] of `value`, flat outside it. */
const ramp = (value: Animated.Value, from: number, to: number) =>
  value.interpolate({
    inputRange: [Math.max(0, from), Math.max(0, from) + Math.max(0.001, to - from)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

/** Scale a layer about an arbitrary tile-space point: T(d) . S(s) . T(-d). */
const scaleAbout = (point: [number, number], scale: Animated.AnimatedInterpolation<number>) => {
  const dx = (point[0] - SPLASH.tile / 2) * U;
  const dy = (point[1] - SPLASH.tile / 2) * U;
  return [
    { translateX: dx },
    { translateY: dy },
    { scale },
    { translateX: -dx },
    { translateY: -dy },
  ];
};

/**
 * Road chunks are laid out as separate absolutely-positioned views that
 * overlap slightly by design (see splashGeometry.ts) so the ribbon tiles
 * without seams. But React Native snaps each view's left/top/width/height to
 * whole device pixels independently -- rounding one chunk's edge down and its
 * neighbour's up shrinks that overlap, and on some pixel densities eats it
 * entirely, leaving a hairline gap of the amber background showing through.
 * Rounding the box outward (floor the start, ceil the end) means rounding can
 * only ever grow a box, never shrink it, so an overlap that exists in the
 * source geometry can't be rounded away.
 */
const boxStyle = (s: { x: number; y: number; w: number; h: number }) => {
  const left = Math.floor(s.x * U);
  const top = Math.floor(s.y * U);
  return {
    position: 'absolute' as const,
    left,
    top,
    width: Math.ceil((s.x + s.w) * U) - left,
    height: Math.ceil((s.y + s.h) * U) - top,
  };
};

/* ---------------------------------------------------------------- component */

type Props = { onFinish: () => void };

export const AnimatedSplash: React.FC<Props> = ({ onFinish }) => {
  const journey = useRef(new Animated.Value(0)).current; // drive + turn, one arc
  const paint = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const resolve = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const veil = useRef(new Animated.Value(1)).current;

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
      // No journey at all: show the finished mark, hold, leave.
      journey.setValue(1);
      paint.setValue(1);
      fill.setValue(1);
      resolve.setValue(1);
      const still = Animated.sequence([
        Animated.timing(word, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(veil, { toValue: 0, duration: T.out, useNativeDriver: true }),
      ]);
      still.start(({ finished }) => finished && finish());
      return () => still.stop();
    }

    const anim = Animated.parallel([
      Animated.sequence([
        Animated.timing(journey, {
          toValue: SPLASH.driveShare,
          duration: T.drive,
          easing: cruiseThenBrake,
          useNativeDriver: true,
        }),
        Animated.timing(journey, {
          toValue: 1,
          duration: T.park,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(paint, {
        toValue: 1,
        duration: T.paint,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(AT_FILL),
        Animated.timing(fill, {
          toValue: 1,
          duration: T.fill,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(AT_RESOLVE),
        Animated.timing(resolve, {
          toValue: 1,
          duration: T.resolve,
          easing: Easing.out(Easing.back(1.45)),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(AT_WORD),
        Animated.timing(word, {
          toValue: 1,
          duration: T.word,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(TOTAL - T.out),
        Animated.timing(veil, { toValue: 0, duration: T.out, useNativeDriver: true }),
      ]),
    ]);

    anim.start(({ finished }) => finished && finish());
    return () => anim.stop();
  }, [reduceMotion, journey, paint, fill, resolve, word, veil, finish]);

  /** Tapping anywhere gets you past it -- this matters by the hundredth launch. */
  const skip = useCallback(() => {
    journey.stopAnimation();
    Animated.timing(veil, { toValue: 0, duration: 160, useNativeDriver: true }).start(finish);
  }, [journey, veil, finish]);

  const anims = useMemo(() => {
    const carX = journey.interpolate({
      inputRange: SPLASH.car.in,
      outputRange: SPLASH.car.x.map((v) => (v - SPLASH.tile / 2) * U),
      extrapolate: 'clamp',
    });
    const carY = journey.interpolate({
      inputRange: SPLASH.car.in,
      outputRange: SPLASH.car.y.map((v) => (v - SPLASH.tile / 2) * U),
      extrapolate: 'clamp',
    });
    const carRot = journey.interpolate({
      inputRange: SPLASH.car.in,
      outputRange: SPLASH.car.rot,
      extrapolate: 'clamp',
    });
    return {
      carX,
      carY,
      carRot,
      carScale: resolve.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }),
      // fades in as it arrives on screen, out as the pin takes over -- two
      // different drivers, so it is composed rather than one ramp
      carOpacity: Animated.multiply(
        journey.interpolate({ inputRange: [0, 0.09], outputRange: [0, 1], extrapolate: 'clamp' }),
        resolve.interpolate({ inputRange: [0.12, 0.72], outputRange: [1, 0], extrapolate: 'clamp' }),
      ),
      chunk: SPLASH.chunkTrig.map((trig) => ramp(journey, trig, trig + 0.014)),
      dash: SPLASH.dashes.map((d) => ramp(paint, Math.max(0, d.t - 0.02), Math.max(0, d.t - 0.02) + 0.032)),
      counterOpacity: ramp(fill, 0, 0.18),
      counterScale: fill.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
      houseOpacity: ramp(resolve, 0, 0.5),
      pinOpacity: ramp(resolve, 0, 0.28),
      pinScale: resolve.interpolate({ inputRange: [0, 1], outputRange: [0.32, 1] }),
      glowOpacity: resolve.interpolate({
        inputRange: [0, 0.18, 0.55, 1],
        outputRange: [0, 0.4, 0.28, 0],
        extrapolate: 'clamp',
      }),
      glowScale: resolve.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.4] }),
      wordOpacity: word,
      wordShift: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
    };
  }, [journey, paint, fill, resolve, word]);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={skip} accessibilityRole="button" accessibilityLabel="Skip intro">
      <Animated.View style={[StyleSheet.absoluteFill, styles.field, { opacity: veil }]}>
        <View style={styles.tile} pointerEvents="none">
          {/* the road, laid slice by slice just under the car's nose */}
          {SPLASH.chunks.map((c, i) => (
            <Animated.View key={`road-${i}`} style={[boxStyle(c), { opacity: anims.chunk[i] }]}>
              {/* 100%/"none" rather than the exact `c.w * U` px size: boxStyle
                  can round this chunk's box a hair larger than that to close
                  the seam with its neighbour, and the artwork must fill
                  whatever size its box actually ends up, not stop short of it. */}
              <Svg width="100%" height="100%" viewBox={`0 0 ${c.w} ${c.h}`} preserveAspectRatio="none">
                <Path d={c.d} fill={colors.roadInk} />
              </Svg>
            </Animated.View>
          ))}

          {/* the area the loop encloses -- floods in as the P closes */}
          <Animated.View
            style={[
              styles.tileLayer,
              {
                opacity: anims.counterOpacity,
                transform: scaleAbout(SPLASH.counterCentre, anims.counterScale),
              },
            ]}
          >
            <Svg width={TILE_PX} height={TILE_PX} viewBox={`0 0 ${SPLASH.tile} ${SPLASH.tile}`}>
              <Path d={SPLASH.counter} fill={colors.roadInk} />
            </Svg>
          </Animated.View>

          {/* lane markings */}
          {SPLASH.dashes.map((d, i) => (
            <Animated.View key={`dash-${i}`} style={[boxStyle(d), { opacity: anims.dash[i] }]}>
              <Svg width={d.w * U} height={d.h * U} viewBox={`0 0 ${d.w} ${d.h}`}>
                <Path d={d.d} fill={colors.logoAmber} />
              </Svg>
            </Animated.View>
          ))}

          {/* the house glyph tucked behind the pin */}
          <Animated.View style={[boxStyle(SPLASH.house), { opacity: anims.houseOpacity }]}>
            <Svg
              width={SPLASH.house.w * U}
              height={SPLASH.house.h * U}
              viewBox={`0 0 ${SPLASH.house.w} ${SPLASH.house.h}`}
            >
              <Path d={SPLASH.house.d} fill={colors.logoAmber} />
            </Svg>
          </Animated.View>

          {/* the car */}
          <Animated.View
            style={[
              styles.car,
              {
                opacity: anims.carOpacity,
                transform: [
                  { translateX: anims.carX },
                  { translateY: anims.carY },
                  { rotate: anims.carRot },
                  { scale: anims.carScale },
                ],
              },
            ]}
          >
            <SplashCar width={CAR_W * U} height={CAR_L * U} />
          </Animated.View>

          {/* a beat of light where the car becomes the pin */}
          <Animated.View
            style={[
              styles.tileLayer,
              { opacity: anims.glowOpacity, transform: scaleAbout(SPLASH.tip, anims.glowScale) },
            ]}
          >
            <Svg width={TILE_PX} height={TILE_PX} viewBox={`0 0 ${SPLASH.tile} ${SPLASH.tile}`}>
              <Defs>
                <RadialGradient
                  id="pnHalo"
                  cx={SPLASH.disc.cx}
                  cy={SPLASH.disc.cy}
                  rx={SPLASH.disc.r * 2.4}
                  ry={SPLASH.disc.r * 2.4}
                  fx={SPLASH.disc.cx}
                  fy={SPLASH.disc.cy}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset={0} stopColor={SPLASH.disc.stops[0].color} stopOpacity={0.75} />
                  <Stop offset={1} stopColor={SPLASH.disc.stops[0].color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle
                cx={SPLASH.disc.cx}
                cy={SPLASH.disc.cy}
                r={SPLASH.disc.r * 2.4}
                fill="url(#pnHalo)"
              />
            </Svg>
          </Animated.View>

          {/* the pin, growing out of its own tip */}
          <Animated.View
            style={[
              styles.tileLayer,
              { opacity: anims.pinOpacity, transform: scaleAbout(SPLASH.tip, anims.pinScale) },
            ]}
          >
            <Svg width={TILE_PX} height={TILE_PX} viewBox={`0 0 ${SPLASH.tile} ${SPLASH.tile}`}>
              <Defs>
                <RadialGradient
                  id="pnCore"
                  cx={SPLASH.disc.cx}
                  cy={SPLASH.disc.cy}
                  rx={SPLASH.disc.r}
                  ry={SPLASH.disc.r}
                  fx={SPLASH.disc.cx}
                  fy={SPLASH.disc.cy}
                  gradientUnits="userSpaceOnUse"
                >
                  {SPLASH.disc.stops.map((s) => (
                    <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
                  ))}
                </RadialGradient>
              </Defs>
              <Path d={SPLASH.pin} fill={colors.logoAmber} />
              <Circle cx={SPLASH.disc.cx} cy={SPLASH.disc.cy} r={SPLASH.disc.r} fill="url(#pnCore)" />
            </Svg>
          </Animated.View>
        </View>

        <Animated.Image
          source={WORDMARK}
          resizeMode="contain"
          style={[
            styles.wordmark,
            { opacity: anims.wordOpacity, transform: [{ translateY: anims.wordShift }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  field: { backgroundColor: colors.logoAmber },
  tile: {
    position: 'absolute',
    left: TILE_LEFT,
    top: TILE_TOP,
    width: TILE_PX,
    height: TILE_PX,
  },
  tileLayer: { position: 'absolute', left: 0, top: 0, width: TILE_PX, height: TILE_PX },
  car: {
    position: 'absolute',
    left: (TILE_PX - CAR_W * U) / 2,
    top: (TILE_PX - CAR_L * U) / 2,
    width: CAR_W * U,
    height: CAR_L * U,
  },
  wordmark: {
    position: 'absolute',
    left: (SCREEN_W - WORDMARK_W) / 2,
    top: TILE_TOP + TILE_PX + Math.round(TILE_PX * 0.05),
    width: WORDMARK_W,
    height: WORDMARK_H,
  },
});
