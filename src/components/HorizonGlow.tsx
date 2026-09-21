import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, spacing, typography } from '../theme';

/**
 * The app's sign-off: a city skyline in amber line-art, running along the
 * bottom of a screen with the brand tagline sitting in the middle of it.
 *
 * Why this and not a generic gradient — ParkNext's whole subject is parking
 * after dark in an Indian city, and the brand amber is literally sodium
 * lamplight. It turns what would be dead space at the foot of a screen into
 * the one image the product is remembered by.
 *
 * Drawn rather than shipped as a PNG so it tints with the theme, scales to
 * any width without a second asset, and costs nothing in the bundle.
 */

const VIEW_W = 390;
const VIEW_H = 120;

/** Where the buildings stand. Nothing is drawn along it — the rooflines just
 *  stop here, so there's no bar across the foot of the artwork. */
const GROUND_Y = 104;

/**
 * Two clusters with a gap between them, because the tagline sits in the
 * middle. Buildings running edge to edge would put type over rooflines.
 */
interface Building {
  x: number;
  /** Roof height. Lower number = taller building. */
  top: number;
  w: number;
  /** Window grid, drawn only where it fits above the ground line. */
  cols?: number;
  rows?: number;
}

const BUILDINGS: Building[] = [
  // Left cluster.
  { x: -8, top: 72, w: 24, cols: 2, rows: 2 },
  { x: 18, top: 58, w: 20, cols: 2, rows: 3 },
  { x: 40, top: 78, w: 22, cols: 2, rows: 1 },
  { x: 64, top: 46, w: 22, cols: 2, rows: 4 },
  { x: 88, top: 66, w: 26, cols: 3, rows: 2 },
  { x: 116, top: 76, w: 18, cols: 2, rows: 1 },
  // Right cluster.
  { x: 272, top: 76, w: 20, cols: 2, rows: 1 },
  { x: 294, top: 62, w: 24, cols: 3, rows: 3 },
  { x: 320, top: 48, w: 20, cols: 2, rows: 4 },
  { x: 342, top: 70, w: 26, cols: 3, rows: 2 },
  { x: 370, top: 58, w: 20, cols: 2, rows: 3 },
  { x: 392, top: 74, w: 22, cols: 2, rows: 2 },
];

/** Street trees between the blocks, kept out of the middle so they never
 *  collide with the tagline. */
const TREES: { x: number; r: number }[] = [
  { x: 32, r: 8 },
  { x: 78, r: 9.5 },
  { x: 108, r: 7 },
  { x: 286, r: 7 },
  { x: 334, r: 9.5 },
  { x: 382, r: 8 },
];

/** Window box, and the rhythm of the grid. */
const WIN_W = 3;
const WIN_H = 4.5;
const WIN_ROW_STEP = 9;

export interface HorizonGlowProps {
  /** Rendered height in dp. The art crops from the top as this shrinks. */
  height?: number;
  /**
   * Two short lines sitting in the gap between the clusters. Pass already-
   * uppercased text. Omit where the art should stay silent.
   */
  tagline?: [string, string];
  style?: StyleProp<ViewStyle>;
}

export function HorizonGlow({ height = 120, tagline, style }: HorizonGlowProps) {
  return (
    <View
      style={[styles.wrap, { height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // One GPU layer for the whole scene — it never changes after layout,
      // so there's no reason for the compositor to keep re-reading it.
      renderToHardwareTextureAndroid
      collapsable={false}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <Defs>
          {/* Dissolves the artwork into the page at the sides instead of
              letting it stop against a hard edge. One gradient, not two
              stacked ones: shapes inside a mask composite over each other
              rather than multiplying, so a second rect would simply erase
              the first wherever it's opaque. White = keep, since it's the
              mask's luminance that becomes alpha. */}
          <LinearGradient id="fadeX" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="0.14" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.86" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <Mask id="edges" maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#fadeX)" />
          </Mask>
        </Defs>

        <G mask="url(#edges)">
          {BUILDINGS.map((b) => (
            <G key={`b-${b.x}`}>
              {/* Open polyline, not a rect: a closed shape would stroke its
                  own base and lay a bar along the ground. Up the left side,
                  across the roof, down the right. */}
              <Path
                d={`M${b.x},${GROUND_Y} L${b.x},${b.top} L${b.x + b.w},${b.top} L${b.x + b.w},${GROUND_Y}`}
                fill="none"
                stroke={colors.primary}
                strokeOpacity={0.38}
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
              {Array.from({ length: b.rows ?? 0 }).map((_, row) => {
                const y = b.top + 7 + row * WIN_ROW_STEP;
                if (y > GROUND_Y - 7) return null;
                const cols = b.cols ?? 0;
                // Even gutters either side, so the grid is centred in the
                // facade whatever the building's width.
                const gutter = (b.w - cols * WIN_W) / (cols + 1);
                return (
                  <G key={`w-${b.x}-${row}`}>
                    {Array.from({ length: cols }).map((__, col) => (
                      <Rect
                        key={`c-${col}`}
                        x={b.x + gutter + col * (WIN_W + gutter)}
                        y={y}
                        width={WIN_W}
                        height={WIN_H}
                        fill={colors.primary}
                        // The near column catches more light than the ones
                        // receding across the face.
                        opacity={col === 0 ? 0.45 : 0.3}
                      />
                    ))}
                  </G>
                );
              })}
            </G>
          ))}

          {TREES.map((tree) => (
            <G key={`t-${tree.x}`}>
              <Path
                d={`M${tree.x},${GROUND_Y} L${tree.x},${GROUND_Y - tree.r * 1.5}`}
                stroke={colors.primary}
                strokeOpacity={0.34}
                strokeWidth={1.1}
                strokeLinecap="round"
              />
              {/* Canopy as three overlapping circles, so it reads as foliage
                  rather than a lollipop. */}
              <Circle
                cx={tree.x}
                cy={GROUND_Y - tree.r * 2.2}
                r={tree.r}
                fill="none"
                stroke={colors.primary}
                strokeOpacity={0.34}
                strokeWidth={1.1}
              />
              <Circle
                cx={tree.x - tree.r * 0.6}
                cy={GROUND_Y - tree.r * 1.65}
                r={tree.r * 0.62}
                fill="none"
                stroke={colors.primary}
                strokeOpacity={0.26}
                strokeWidth={1}
              />
              <Circle
                cx={tree.x + tree.r * 0.6}
                cy={GROUND_Y - tree.r * 1.65}
                r={tree.r * 0.62}
                fill="none"
                stroke={colors.primary}
                strokeOpacity={0.26}
                strokeWidth={1}
              />
            </G>
          ))}
        </G>
      </Svg>

      {tagline ? (
        <View style={styles.tagline}>
          <Text style={styles.taglineText}>{tagline[0]}</Text>
          <Text style={styles.taglineText}>{tagline[1]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  /** Centred in the gap the two building clusters leave for it. */
  tagline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '38%',
    alignItems: 'center',
  },
  taglineText: {
    ...typography.eyebrow,
    color: colors.primary,
    opacity: 0.9,
    textAlign: 'center',
  },
});
