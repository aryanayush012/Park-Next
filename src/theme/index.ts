export * from './colors';
export * from './spacing';
export * from './typography';
export * from './elevation';

import { colors } from './colors';
import { spacing, radius } from './spacing';
import { typography, fontFamily } from './typography';
import { elevation } from './elevation';

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  fontFamily,
  elevation,
};

export type Theme = typeof theme;
