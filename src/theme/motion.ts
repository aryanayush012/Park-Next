import { Easing } from 'react-native';

/**
 * Motion tokens — so screens stop hand-rolling 200/300/400ms and each
 * transition doesn't get its own slightly-different feel.
 *
 * The app's motion idea matches its light model: things arrive the way a car
 * settles into a bay — quick to move, slow to stop. That means an ease-OUT
 * curve almost everywhere, and an ease-in-out only when something is
 * travelling between two resting states (a sheet, a tab).
 */
export const duration = {
  /** Press feedback, toggles — must feel instant, not animated. */
  instant: 120,
  /** The default: a card appearing, a value changing, a fade. */
  quick: 220,
  /** Screen-level entrances, sheets, anything that moves a long distance. */
  settle: 360,
  /** Celebratory beats only — the confirmation check, a success bloom. */
  celebrate: 620,
} as const;

export const easing = {
  /** Arrive fast, settle slow. The default for anything entering. */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** Travelling between two resting positions — sheets, tabs, carousels. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** A touch of overshoot, for a success beat that should feel physical. */
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const motion = { duration, easing };
