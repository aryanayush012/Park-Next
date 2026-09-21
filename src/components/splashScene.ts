/**
 * Geometry for the splash scene: the night map, the route to the spot, and
 * where everything sits on it.
 *
 * Laid out in a fixed design box so the map, the route, the pins and the car
 * keep the same relationship on every screen -- only the scale changes.
 */

/** The scene box. Its aspect matches the map area of the brand artwork. */
export const SCENE_W = 360;
export const SCENE_H = 420;

/* ----------------------------------------------------------- car and route */

/**
 * Where the car comes to rest, and where it starts from.
 *
 * The car stays in the lower third and the route runs on ahead of it to the
 * spot -- which is the composition in the artwork, and the reason the car does
 * not drive the route itself. Driving it would end with the car parked on top
 * of the pin, covering the one thing the scene is about.
 *
 * It enters from below the frame, so it arrives rather than fading up.
 */
export const CAR_REST_Y = 330;
export const CAR_START_Y = 486;
export const CAR_X = 178;

/** Where the pin stands, and where its ripples are centred on the ground. */
export const PIN_GROUND: [number, number] = [208, 192];

/**
 * The route, from the car's bonnet to the spot: up the road it is on, then a
 * turn across to the street the pin is on.
 *
 * It starts at the car's centre rather than its nose so the car's own body
 * covers the line's end -- the glow then reads as coming out from under the
 * car instead of starting in mid-air just in front of it.
 */
export const ROUTE_PATH = [
  `M${CAR_X},${CAR_REST_Y}`,
  'C178,296 182,276 190,258',
  'C200,236 208,226 208,196',
].join(' ');

/* --------------------------------------------------------------- the pins */

export interface MiniPin {
  x: number;
  y: number;
  /** Smaller further out, which reads as further away. */
  scale: number;
}

/** The other spots on the map. Scattered, not gridded -- they are parking. */
export const MINI_PINS: MiniPin[] = [
  { x: 116, y: 50, scale: 0.46 },
  { x: 330, y: 108, scale: 0.42 },
  { x: 82, y: 182, scale: 0.44 },
  { x: 300, y: 268, scale: 0.4 },
];

/* ---------------------------------------------------------------- the map */

/**
 * The city is generated rather than drawn by hand, but from a FIXED seed, so
 * it is the same city on every launch and in every render used to check it.
 * A random city each run would make the splash subtly different every time and
 * would make any visual regression impossible to spot.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Building extends Rect {
  /** Lit windows, as offsets within the building. */
  lights: { x: number; y: number }[];
}
export interface City {
  roads: Rect[];
  blocks: Building[];
  trees: { x: number; y: number; r: number }[];
}

/**
 * The grid is generated well outside the scene box because the whole map is
 * drawn rotated: at 14 degrees the corners of the viewBox reach past where an
 * unrotated grid would end, and the bare background would show through.
 */
const BLEED = 150;

function buildCity(): City {
  const rnd = mulberry32(20260920);
  const roads: Rect[] = [];
  const blocks: Building[] = [];
  const trees: { x: number; y: number; r: number }[] = [];

  const x0 = -BLEED;
  const x1 = SCENE_W + BLEED;
  const y0 = -BLEED;
  const y1 = SCENE_H + BLEED;

  // Avenues, wider than the side streets, so the grid has a hierarchy rather
  // than reading as graph paper.
  const vLines = [-92, 10, 118, 232, 348, 452];
  const hLines = [-96, 8, 104, 214, 318, 424, 530];
  const wide = new Set([118, 232]);

  for (const x of vLines) {
    const w = wide.has(x) ? 15 : 9;
    roads.push({ x: x - w / 2, y: y0, w, h: y1 - y0 });
  }
  for (const y of hLines) {
    const h = y === 214 ? 15 : 9;
    roads.push({ x: x0, y: y - h / 2, w: x1 - x0, h });
  }

  // Fill each block between the roads with a few buildings and some planting.
  for (let vi = 0; vi < vLines.length - 1; vi++) {
    for (let hi = 0; hi < hLines.length - 1; hi++) {
      const left = vLines[vi] + 9;
      const right = vLines[vi + 1] - 9;
      const top = hLines[hi] + 9;
      const bottom = hLines[hi + 1] - 9;
      if (right - left < 26 || bottom - top < 26) continue;

      const cols = rnd() < 0.45 ? 2 : 3;
      const rows = rnd() < 0.4 ? 2 : 3;
      const cw = (right - left) / cols;
      const ch = (bottom - top) / rows;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() < 0.2) {
            // A gap in the block: a small park, rather than a building.
            const n = 1 + Math.floor(rnd() * 3);
            for (let k = 0; k < n; k++) {
              trees.push({
                x: left + c * cw + 5 + rnd() * Math.max(4, cw - 12),
                y: top + r * ch + 5 + rnd() * Math.max(4, ch - 12),
                r: 2.8 + rnd() * 2.8,
              });
            }
            continue;
          }
          const pad = 2 + rnd() * 3;
          const bw = Math.max(7, cw - pad * 2);
          const bh = Math.max(7, ch - pad * 2);
          const bx = left + c * cw + pad;
          const by = top + r * ch + pad;

          // Only some buildings have anyone home. Sparse light is what makes
          // the ones that are lit read as lit.
          const lights: { x: number; y: number }[] = [];
          if (rnd() < 0.3) {
            const n = 1 + Math.floor(rnd() * 3);
            for (let k = 0; k < n; k++) {
              lights.push({
                x: 2 + rnd() * Math.max(1, bw - 5),
                y: 2 + rnd() * Math.max(1, bh - 5),
              });
            }
          }
          blocks.push({ x: bx, y: by, w: bw, h: bh, lights });
        }
      }
    }
  }

  return { roads, blocks, trees };
}

export const CITY: City = buildCity();

/** The map is turned off-axis so it reads as a place, not a diagram. */
export const CITY_ROTATION = -14;

/** Where the map starts dissolving into the background the branding sits on. */
export const FADE_FROM = 0.62;
