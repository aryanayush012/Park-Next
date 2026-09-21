import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CITY, CITY_ROTATION, FADE_FROM, SCENE_H, SCENE_W } from './splashScene';

/**
 * The night map the splash plays over: an aerial block of city, lights on in
 * a few windows.
 *
 * Deliberately one flat, static <Svg> that renders once and never updates. It
 * is the single busiest thing on screen, and the splash plays while the JS
 * thread is still booting -- so it contributes nothing to the animation and
 * is not allowed to. Everything that moves lives in its own small layer above
 * this one.
 *
 * `React.memo` with no props means React never even diffs it on a re-render of
 * the splash.
 *
 * The palette is local rather than from `theme/colors`: this is scenery, not
 * app chrome, and it wants to sit further back than any real surface does.
 */
const GROUND = '#090A0E';
const ROAD = '#191B22';
const BUILDING = '#0F1218';
const BUILDING_EDGE = '#171A22';
const TREE = '#0C1411';
const WINDOW = '#FBB112';
/** Must be the app background, or the seam below the map shows as a band. */
const FADE_TO = '#0B0D12';

export const SplashCity = React.memo(function SplashCity({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>
      <Defs>
        {/* The map has to stop somewhere, and a hard edge across the screen
            would look like a cropped photo. This dissolves its lower third
            into the app background the branding sits on, so the two are one
            surface. */}
        <LinearGradient id="pnCityFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={FADE_TO} stopOpacity="0" />
          <Stop offset="0.55" stopColor={FADE_TO} stopOpacity="0.72" />
          <Stop offset="1" stopColor={FADE_TO} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={SCENE_W} height={SCENE_H} fill={GROUND} />
      <G transform={`rotate(${CITY_ROTATION} ${SCENE_W / 2} ${SCENE_H / 2})`}>
        {CITY.roads.map((r, i) => (
          <Rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={ROAD} />
        ))}
        {CITY.blocks.map((b, i) => (
          <Rect
            key={`b${i}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={1.5}
            fill={BUILDING}
            stroke={BUILDING_EDGE}
            strokeWidth={0.8}
          />
        ))}
        {/* Windows after every building, so one block never paints over
            another block's lights. */}
        {CITY.blocks.map((b, i) =>
          b.lights.map((l, k) => (
            <Rect
              key={`w${i}-${k}`}
              x={b.x + l.x}
              y={b.y + l.y}
              width={1.9}
              height={1.9}
              fill={WINDOW}
              opacity={0.42}
            />
          ))
        )}
        {CITY.trees.map((t, i) => (
          <Circle key={`t${i}`} cx={t.x} cy={t.y} r={t.r} fill={TREE} />
        ))}
      </G>
      <Rect
        x={0}
        y={SCENE_H * FADE_FROM}
        width={SCENE_W}
        height={SCENE_H * (1 - FADE_FROM)}
        fill="url(#pnCityFade)"
      />
    </Svg>
  );
});
