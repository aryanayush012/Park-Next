/**
 * Geometry for the animated splash, traced from the app's own icon master.
 *
 * Every path in here came out of `assets/icon.png`'s source artwork by contour
 * tracing -- the road-P silhouette, its lane dashes, the house glyph, the
 * location pin and the sampled radial profile of the pin's glowing core. The
 * only synthesised pieces are the centre-line (fitted through the artwork's own
 * dash centroids, which sit on it by construction) and the car's final turn.
 *
 * All coordinates are in TILE units: a square `tile` x `tile` box that
 * `AnimatedSplash` maps 1:1 onto however many dp the logo tile is rendered at.
 *
 * ROAD PIECES ARE GROUPED, NOT ONE-PER-PIECE
 * The original trace produced 32 road slices and 19 lane dashes, each its own
 * native `<Svg>` -- 51 separate rendering surfaces animating at once, on top
 * of the pin/house/glow/counter, was enough overlapping native views to make
 * the reveal visibly janky on a mid-range Android device (confirmed: real
 * report of "jittery" splash). `chunkGroups`/`dashGroups` below bundle every 4
 * consecutive pieces into one shared `<Svg>` -- each original piece keeps its
 * own untouched `d` path data, just offset via `pieces[].dx/dy` (an SVG `<G
 * transform="translate(dx,dy)">` in the renderer) rather than positioned by
 * its own top-level x/y -- cutting 51 native Svg instances down to 13. A group
 * fades in as one animated unit, spanning from its earliest piece's original
 * reveal point to its latest piece's, so the sequence still reads as the road
 * painting itself in order, just in slightly coarser, cheaper steps.
 *
 * GENERATED FILE -- do not hand-edit. Regenerate if the icon artwork changes.
 */

export type SplashShape = { x: number; y: number; w: number; h: number; d: string };
export type SplashDash = SplashShape & { t: number };
export type SplashStop = { offset: number; color: string };

/** One original piece's own path, positioned within its group's shared Svg. */
export type SplashPiece = { dx: number; dy: number; d: string };
/** A cluster of consecutive pieces sharing one native Svg and one fade-in. */
export type SplashGroup = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Journey/paint value at which the group should start revealing. */
  trig: number;
  /** How wide a window the reveal ramps over. */
  width: number;
  pieces: SplashPiece[];
};

type SplashGeometry = {
  tile: number;
  ink: string;
  amber: string;
  carLen: number;
  driveShare: number;
  chunkGroups: SplashGroup[];
  dashGroups: SplashGroup[];
  counter: string;
  counterCentre: [number, number];
  house: SplashShape;
  pin: string;
  tip: [number, number];
  disc: { cx: number; cy: number; r: number; stops: SplashStop[] };
  car: { in: number[]; x: number[]; y: number[]; rot: string[] };
};

export const SPLASH: SplashGeometry = {
  /** Side of the square logo tile, in its own units. */
  tile: 300.0,
  /** Sampled straight from the artwork; see `colors.roadInk` / `colors.logoAmber`. */
  ink: '#101115',
  amber: '#e5971b',
  /** Car length in tile units (its width follows the source SVG's aspect). */
  carLen: 46.0,
  /** Fraction of the journey value spent driving; the rest is the turn into the bay. */
  driveShare: 0.75,

  /**
   * The road ribbon, in groups of (up to) 4 consecutive slices along the
   * centre-line. Each group carries its own bounding box so its layer can be
   * a small view rather than a full-tile one -- that, plus the grouping
   * itself, is what keeps splash-time overdraw and view count down.
   */
  chunkGroups: [
  { x: 37.1, y: 206.73, w: 69.47, h: 73.27, trig: 0.025, width: 0.089, pieces: [
      { dx: 0, dy: 56.54, d: 'M1.00,1.00 L1.00,15.73 L52.31,15.73 L52.31,1.48 L28.56,1.00 L28.56,13.35 L27.13,14.78 L26.18,14.78 L24.76,13.35 L24.76,1.00 Z' },
      { dx: 0, dy: 34.68, d: 'M1.95,1.00 L1.00,6.70 L1.00,23.33 L24.76,23.33 L24.76,21.43 L25.71,20.48 L27.13,20.48 L28.56,21.91 L28.56,23.33 L52.31,23.81 L52.31,11.93 L53.27,8.60 Z' },
      { dx: 0.96, dy: 2.85, d: 'M13.83,1.00 L10.03,6.23 L5.75,14.78 L5.75,16.20 L3.38,20.96 L1.00,33.31 L52.31,40.91 L52.79,38.06 L14.78,1.00 Z' },
      { dx: 13.78, dy: 0, d: 'M1.00,3.38 L1.00,4.33 L39.01,41.39 L40.44,40.91 L42.34,36.64 L47.09,31.41 L54.69,27.61 L48.51,12.88 L6.23,2.43 L3.85,1.00 L2.90,1.00 Z' },
    ] },
  { x: 53.26, y: 142.59, w: 60.92, h: 78.49, trig: 0.125, width: 0.089, pieces: [
      { dx: 0, dy: 52.26, d: 'M1.00,11.93 L1.00,13.83 L2.90,14.78 L46.14,25.23 L43.76,16.20 L43.76,10.03 L45.19,3.85 L44.24,3.38 L6.70,1.00 L6.23,6.23 Z' },
      { dx: 5.7, dy: 35.16, d: 'M1.00,18.58 L39.49,21.43 L44.24,12.40 L52.79,3.38 L52.79,2.43 L1.00,1.00 Z' },
      { dx: 5.7, dy: 17.58, d: 'M1.00,1.00 L1.00,19.06 L39.49,20.48 L53.74,20.01 L54.22,1.95 Z' },
      { dx: 5.23, dy: 0, d: 'M54.22,1.00 L1.00,2.43 L1.48,19.06 L54.69,20.01 Z' },
    ] },
  { x: 58.49, y: 58.49, w: 65.19, h: 88, trig: 0.226, width: 0.089, pieces: [
      { dx: 0, dy: 66.52, d: 'M1.48,1.00 L1.00,20.48 L54.22,19.06 L54.22,1.00 Z' },
      { dx: 0.47, dy: 43.23, d: 'M2.43,1.00 L1.00,11.93 L1.00,24.76 L53.74,24.76 L54.22,11.45 Z' },
      { dx: 2.37, dy: 21.38, d: 'M7.18,1.00 L2.43,14.30 L1.95,18.58 L1.00,20.48 L1.48,23.81 L52.79,34.26 L53.27,30.46 L56.12,22.86 L55.64,20.96 L9.55,1.00 Z' },
      { dx: 9.02, dy: 0, d: 'M13.35,1.00 L5.28,12.88 L2.43,18.10 L1.00,22.86 L46.14,42.34 L49.94,43.29 L52.31,38.06 L54.69,35.21 L55.17,32.83 L14.78,1.00 Z' },
    ] },
  { x: 80.34, y: 19.52, w: 87.06, h: 73.75, trig: 0.326, width: 0.089, pieces: [
      { dx: 0, dy: 21.86, d: 'M17.15,1.00 L5.28,11.93 L1.00,17.15 L1.00,18.58 L40.44,49.94 L42.81,50.89 L50.89,42.81 L50.41,40.91 L18.58,1.00 Z' },
      { dx: 16.63, dy: 9.03, d: 'M21.43,1.00 L8.13,8.13 L1.00,13.35 L1.00,14.30 L33.31,55.17 L34.73,55.17 L38.54,52.31 L43.76,49.94 L43.76,48.04 L24.28,3.38 L22.86,1.00 Z' },
      { dx: 38.01, dy: 1.43, d: 'M24.76,1.00 L13.35,3.38 L1.00,8.13 L1.00,9.55 L21.91,57.07 L33.78,53.74 Z' },
      { dx: 61.3, dy: 0, d: 'M1.00,2.43 L1.00,5.28 L10.03,55.17 L17.63,54.22 L21.43,54.69 L24.76,1.00 L11.45,1.00 Z' },
    ] },
  { x: 161.59, y: 19.52, w: 86.1, h: 78.5, trig: 0.426, width: 0.089, pieces: [
      { dx: 0, dy: 0, d: 'M4.33,1.00 L1.00,54.69 L4.80,54.69 L12.88,56.59 L28.08,9.08 L28.56,5.28 L18.10,2.43 Z' },
      { dx: 11.4, dy: 4.28, d: 'M16.68,1.00 L1.00,51.36 L1.00,52.31 L11.45,57.07 L12.40,57.07 L39.49,11.93 L39.49,10.98 L37.59,9.55 L28.08,4.80 Z' },
      { dx: 22.33, dy: 14.73, d: 'M29.51,1.00 L27.61,1.00 L1.00,45.66 L1.95,47.56 L6.23,50.41 L9.55,53.74 L10.98,53.74 L47.56,16.68 L47.56,15.25 L36.16,5.28 Z' },
      { dx: 31.36, dy: 29.46, d: 'M39.01,1.00 L38.06,1.00 L1.00,38.54 L1.00,39.49 L8.13,48.04 L9.08,48.04 L53.74,21.43 L52.79,18.10 L48.51,11.93 Z' },
    ] },
  { x: 200.08, y: 68.94, w: 62.34, h: 93.23, trig: 0.527, width: 0.089, pieces: [
      { dx: 0, dy: 0, d: 'M47.56,1.48 L45.19,1.00 L1.95,26.66 L1.00,28.56 L3.85,33.78 L5.28,38.54 L7.65,38.54 L56.12,23.81 L56.59,21.91 L54.69,16.20 Z' },
      { dx: 4.75, dy: 21.86, d: 'M51.84,1.00 L1.00,16.20 L2.90,25.71 L2.90,29.03 L56.12,25.23 L55.64,16.68 Z' },
      { dx: 6.65, dy: 45.61, d: 'M54.69,1.00 L47.09,1.00 L1.00,4.80 L1.00,17.63 L53.74,24.76 L54.69,19.06 Z' },
      { dx: 3.8, dy: 61.77, d: 'M3.85,1.00 L1.00,13.35 L39.01,26.66 L51.84,30.46 L54.22,20.96 L55.17,19.53 L56.59,8.13 Z' },
    ] },
  { x: 172.52, y: 142.59, w: 83.25, h: 86.57, trig: 0.627, width: 0.089, pieces: [
      { dx: 26.13, dy: 0, d: 'M5.75,1.48 L4.80,4.80 L1.00,11.45 L1.95,13.35 L45.19,39.96 L47.09,39.96 L56.12,21.91 L56.12,17.63 L7.65,1.00 Z' },
      { dx: 18.53, dy: 10.92, d: 'M8.60,1.00 L1.00,10.50 L1.00,11.45 L38.54,48.04 L39.96,48.04 L49.46,37.11 L54.22,29.98 L54.22,28.56 L14.30,3.85 Z' },
      { dx: 9.03, dy: 20.9, d: 'M10.03,1.00 L4.80,5.75 L1.00,8.13 L1.00,9.08 L29.98,53.27 L31.41,53.27 L42.34,45.19 L48.99,39.01 L48.99,37.59 L11.45,1.00 Z' },
      { dx: 0, dy: 28.5, d: 'M9.55,1.00 L3.85,4.33 L1.48,4.80 L1.00,7.65 L15.73,56.59 L17.15,57.07 L31.88,50.89 L39.01,46.61 L39.49,44.24 L10.98,1.00 Z' },
    ] },
  { x: 95.55, y: 175.37, w: 94.65, h: 59.5, trig: 0.683, width: 0.067, pieces: [
      { dx: 64.14, dy: 0, d: 'M14.30,1.00 L1.00,2.90 L5.75,57.54 L18.10,56.12 L29.51,52.79 Z' },
      { dx: 47.51, dy: 1.9, d: 'M18.10,1.00 L1.00,1.95 L2.90,56.12 L22.86,55.64 Z' },
      { dx: 30.41, dy: 2.85, d: 'M18.58,1.00 L1.00,1.48 L1.00,55.17 L20.48,55.17 Z' },
      { dx: 0, dy: 3.33, d: 'M16.20,1.00 L8.60,8.60 L2.90,18.10 L1.00,25.23 L1.00,33.31 L1.95,38.06 L9.08,55.17 L31.88,54.69 L31.88,1.00 Z' },
    ] },
  ],

  /** The counter of the P -- the area the loop encloses. Floods in as the loop closes. */
  counter: 'M191.10,84.19 L185.87,80.39 L176.85,76.12 L167.34,73.74 L158.31,73.27 L150.24,74.22 L141.21,77.07 L131.71,82.29 L123.15,90.37 L119.35,95.60 L116.03,102.25 L112.23,116.50 L112.23,180.17 L138.36,180.17 L158.79,179.22 L171.14,177.80 L181.12,173.99 L189.67,167.82 L194.90,162.59 L201.55,153.09 L206.30,141.69 L208.20,133.13 L208.68,120.30 L207.73,112.70 L204.40,101.77 L199.65,93.22 Z',
  counterCentre: [157.77, 128.6],

  /**
   * Lane markings, grouped the same way as the road above (up to 4 per
   * shared Svg). `trig`/`width` here drive off `paint`, not `journey` — see
   * AnimatedSplash's own `anims.dash` for how that's wired.
   */
  dashGroups: [
  { x: 61.34, y: 159.22, w: 28.13, h: 119.35, trig: 0.001, width: 0.221, pieces: [
      { dx: 0, dy: 102.15, d: 'M1.00,1.48 L1.00,15.25 L1.48,16.20 L3.38,16.20 L2.90,15.73 L3.85,14.30 L3.85,2.43 L2.90,1.00 Z' },
      { dx: 0.95, dy: 73.17, d: 'M6.23,1.00 L5.28,1.00 L4.33,1.95 L2.90,5.28 L2.43,9.08 L1.00,12.40 L1.48,14.78 L3.85,14.30 L4.80,7.65 L7.18,2.43 Z' },
      { dx: 13.78, dy: 51.31, d: 'M12.88,1.48 L11.45,1.00 L2.90,7.18 L1.00,9.55 L3.38,10.98 L7.18,7.18 L12.40,3.85 L12.40,2.90 L13.35,2.43 Z' },
      { dx: 22.33, dy: 0, d: 'M1.95,1.00 L1.00,2.43 L1.00,13.35 L1.95,14.78 L2.90,14.78 L3.85,13.35 L3.85,1.95 L3.38,1.00 Z' },
    ] },
  { x: 83.67, y: 54.21, w: 42.38, h: 91.33, trig: 0.24, width: 0.188, pieces: [
      { dx: 0, dy: 75.55, d: 'M1.95,1.00 L1.00,1.95 L1.00,14.30 L3.38,14.78 L3.38,1.48 Z' },
      { dx: 0, dy: 46.09, d: 'M5.28,1.00 L3.38,1.95 L2.43,4.80 L2.90,5.75 L1.95,7.65 L1.48,12.88 L1.00,13.35 L1.95,14.78 L3.38,14.30 L4.33,11.45 L5.28,4.33 L6.23,1.95 Z' },
      { dx: 9.03, dy: 19.96, d: 'M9.08,1.00 L7.65,1.00 L2.90,7.18 L1.00,10.98 L1.48,12.88 L3.85,11.93 L5.28,8.60 L9.55,2.90 Z' },
      { dx: 28.03, dy: 0, d: 'M12.88,1.48 L11.45,1.00 L5.75,4.33 L1.00,8.13 L1.48,10.03 L3.85,9.55 L5.75,7.65 L11.45,4.33 L13.35,2.43 Z' },
    ] },
  { x: 138.31, y: 45.18, w: 89.9, h: 42.87, trig: 0.447, width: 0.185, pieces: [
      { dx: 0, dy: 0, d: 'M14.30,1.48 L10.98,1.00 L8.60,1.95 L3.85,2.43 L1.00,3.85 L1.00,5.75 L14.30,3.38 Z' },
      { dx: 28.51, dy: 0, d: 'M1.00,1.95 L1.00,2.90 L1.95,3.85 L7.18,4.33 L11.93,5.75 L14.78,5.75 L14.30,3.38 L11.45,2.43 L9.08,2.43 L3.85,1.00 L1.95,1.00 Z' },
      { dx: 56.07, dy: 9.03, d: 'M1.00,2.43 L1.95,3.85 L3.38,4.33 L4.80,5.75 L5.75,5.75 L10.50,9.55 L12.40,10.50 L13.35,9.55 L12.40,7.18 L4.33,1.48 L2.43,1.00 Z' },
      { dx: 78.87, dy: 28.99, d: 'M1.48,1.00 L1.00,1.48 L1.48,3.38 L4.80,7.65 L7.18,12.40 L9.08,12.88 L10.03,11.45 L7.18,6.23 L2.90,1.00 Z' },
    ] },
  { x: 198.65, y: 100.3, w: 38.12, h: 94.18, trig: 0.651, width: 0.186, pieces: [
      { dx: 31.36, dy: 0, d: 'M1.95,1.00 L1.00,1.95 L1.00,3.38 L2.90,10.50 L2.90,14.30 L4.80,14.78 L5.75,13.83 L4.80,6.70 L3.38,1.48 Z' },
      { dx: 31.84, dy: 29.46, d: 'M4.80,1.00 L3.85,1.00 L2.90,1.95 L1.00,14.78 L1.48,14.30 L1.95,14.78 L3.85,14.30 L5.28,6.70 L5.28,1.95 Z' },
      { dx: 20.43, dy: 57.97, d: 'M8.60,1.00 L7.18,1.48 L1.00,11.93 L1.48,12.88 L1.00,13.83 L1.48,13.35 L2.90,13.83 L3.85,12.88 L4.33,10.98 L5.75,9.55 L9.55,1.95 Z' },
      { dx: 0, dy: 82.2, d: 'M12.40,1.00 L9.55,1.48 L9.08,2.43 L1.95,8.13 L1.00,10.50 L2.90,10.98 L9.55,5.75 L12.40,2.90 Z' },
    ] },
  { x: 101.25, y: 198.18, w: 85.62, h: 11.03, trig: 0.859, width: 0.153, pieces: [
      { dx: 69.84, dy: 0, d: 'M14.78,1.95 L13.83,1.00 L5.28,4.33 L1.95,4.80 L1.00,6.23 L1.95,7.18 L8.13,6.23 L13.83,4.33 Z' },
      { dx: 28.98, dy: 5.7, d: 'M1.00,1.95 L1.95,3.38 L3.38,3.85 L14.78,3.85 L16.20,2.90 L15.73,1.48 L12.88,1.48 L12.40,1.00 L2.43,1.00 Z' },
      { dx: 0, dy: 5.7, d: 'M1.00,3.38 L2.90,4.33 L3.38,3.85 L8.60,3.85 L9.08,3.38 L14.78,3.38 L15.73,1.95 L14.30,1.00 L6.23,1.00 L5.75,1.48 L1.95,1.48 Z' },
    ] },
  ],

  house: { x: 126.43, y: 138.31, w: 12.93, h: 20.06, d: 'M1.48,1.00 L1.00,1.48 L1.00,17.63 L1.48,18.58 L11.93,19.06 L11.93,17.15 L8.13,11.93 L2.43,1.48 Z' },
  pin: 'M156.89,86.09 L156.41,86.57 L154.04,86.57 L150.24,87.99 L148.81,87.99 L145.49,89.90 L144.54,89.90 L140.26,92.75 L140.26,93.22 L135.03,97.97 L132.66,101.30 L129.33,108.43 L128.86,112.23 L128.38,112.70 L128.38,115.55 L127.91,116.03 L127.91,120.78 L128.38,121.25 L128.38,124.10 L128.86,124.58 L129.33,127.91 L131.23,133.61 L138.36,146.91 L157.36,174.47 L159.74,177.32 L160.69,177.32 L164.49,172.57 L167.34,167.82 L179.22,151.19 L179.70,149.76 L185.40,141.21 L188.72,134.56 L192.05,124.10 L192.05,112.70 L191.57,112.23 L190.62,107.48 L187.77,101.30 L184.92,97.50 L178.75,91.80 L172.57,88.47 L168.29,87.04 L163.54,86.57 L163.07,86.09 Z',
  /** Where the pin's tip sits -- the point it grows out of, and where the car stops. */
  tip: [159.98, 177.32],
  disc: {
    cx: 160.18, cy: 118.66, r: 16.88,
    stops: [{ offset: 0.0, color: '#ffc63b' }, { offset: 0.12, color: '#ea9821' }, { offset: 0.25, color: '#ba621d' }, { offset: 0.38, color: '#7b4016' }, { offset: 0.55, color: '#462912' }, { offset: 0.75, color: '#101115' }, { offset: 1.0, color: '#101115' }],
  },

  /**
   * The car's whole journey as one arc-length-uniform keyframe table: the
   * off-tile approach, the road, then the turn into the bay. `in` is the
   * journey value each keyframe belongs to.
   */
  car: {
    in: [
    0.0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09,
    0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16, 0.17, 0.18, 0.19,
    0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.27, 0.28, 0.29,
    0.3, 0.31, 0.32, 0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39,
    0.4, 0.41, 0.42, 0.43, 0.44, 0.45, 0.46, 0.47, 0.48, 0.49,
    0.5, 0.51, 0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.59,
    0.6, 0.61, 0.62, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.69,
    0.7, 0.71, 0.72, 0.73, 0.74, 0.75, 0.7619, 0.77381, 0.78571, 0.79762,
    0.80952, 0.82143, 0.83333, 0.84524, 0.85714, 0.86905, 0.88095, 0.89286, 0.90476, 0.91667,
    0.92857, 0.94048, 0.95238, 0.96429, 0.97619, 0.9881, 1.0,
    ],
    x: [
    59.99, 60.57, 61.15, 61.72, 62.3, 62.86, 63.45, 63.87, 63.9, 64.13,
    65.02, 67.42, 71.46, 76.52, 80.6, 82.87, 83.93, 84.69, 85.17, 85.46,
    85.71, 85.94, 86.22, 86.28, 86.08, 85.85, 85.88, 85.83, 85.84, 86.3,
    87.39, 89.28, 91.74, 94.82, 98.16, 102.55, 107.49, 112.3, 118.16, 124.48,
    131.16, 137.33, 144.47, 151.77, 159.16, 165.73, 173.08, 180.29, 186.54, 193.34,
    199.82, 205.87, 210.86, 216.04, 220.71, 224.74, 227.72, 230.43, 232.51, 233.84,
    234.69, 234.91, 234.51, 233.62, 232.02, 229.81, 227.35, 224.0, 220.06, 215.57,
    211.15, 205.7, 199.83, 193.61, 187.72, 180.75, 178.65, 176.52, 174.37, 172.2,
    170.04, 167.97, 166.08, 164.5, 163.26, 162.32, 161.63, 161.13, 160.76, 160.49,
    160.3, 160.17, 160.08, 160.03, 159.99, 159.98, 159.98,
    ],
    y: [
    316.13, 308.97, 301.82, 294.66, 287.51, 280.6, 273.22, 265.83, 259.24, 251.84,
    244.5, 237.53, 232.35, 226.95, 220.79, 213.77, 207.27, 199.91, 192.52, 185.94,
    178.54, 171.14, 163.74, 157.16, 149.75, 142.35, 134.95, 128.37, 120.96, 113.57,
    107.08, 99.93, 92.94, 86.21, 80.54, 74.58, 69.07, 64.58, 60.06, 56.2,
    53.02, 50.72, 48.77, 47.56, 47.11, 47.33, 48.25, 49.91, 51.96, 54.89,
    58.47, 62.74, 67.03, 72.31, 78.06, 84.26, 90.13, 97.02, 104.13, 110.57,
    117.92, 125.32, 132.72, 139.24, 146.46, 153.53, 159.63, 166.24, 172.5, 178.39,
    183.26, 188.26, 192.79, 196.79, 199.72, 202.23, 202.79, 203.22, 203.49, 203.54,
    203.3, 202.67, 201.6, 200.12, 198.34, 196.38, 194.32, 192.21, 190.07, 187.91,
    185.75, 183.58, 181.41, 179.24, 177.07, 174.89, 172.72,
    ],
    rot: [
    '4.6deg', '4.6deg', '4.6deg', '4.6deg', '4.6deg', '4.6deg', '4.6deg', '0.78deg',
    '0.43deg', '3.6deg', '10.99deg', '29.89deg', '43.21deg', '40.42deg', '25.56deg', '11.95deg',
    '7.29deg', '4.56deg', '3.04deg', '2.18deg', '1.72deg', '1.94deg', '1.64deg', '-0.55deg',
    '-2.13deg', '-0.85deg', '0.04deg', '-0.6deg', '1.38deg', '6.21deg', '12.61deg', '17.04deg',
    '21.87deg', '27.56deg', '33.4deg', '39.24deg', '44.5deg', '49.39deg', '55.39deg', '61.69deg',
    '67.21deg', '71.92deg', '77.59deg', '83.6deg', '89.38deg', '94.38deg', '100.06deg', '105.74deg',
    '110.57deg', '116.01deg', '122.04deg', '128.2deg', '132.95deg', '138.14deg', '143.83deg', '150.29deg',
    '155.74deg', '161.22deg', '166.11deg', '170.69deg', '175.89deg', '180.7deg', '185.5deg', '190.0deg',
    '195.04deg', '199.72deg', '204.2deg', '209.62deg', '214.75deg', '219.85deg', '224.53deg', '230.45deg',
    '234.47deg', '240.4deg', '246.74deg', '253.65deg', '256.79deg', '260.68deg', '265.78deg', '272.59deg',
    '281.67deg', '293.2deg', '306.32deg', '319.11deg', '329.84deg', '338.01deg', '343.98deg', '348.34deg',
    '351.55deg', '353.95deg', '355.75deg', '357.11deg', '358.13deg', '358.89deg', '359.42deg', '359.78deg',
    '359.91deg',
    ],
  },
};
