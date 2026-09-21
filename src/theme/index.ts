export * from './colors';
export * from './spacing';
export * from './typography';
export * from './elevation';
export * from './motion';

import { colors } from './colors';
import { spacing, radius } from './spacing';
import { typography, fontFamily } from './typography';
import { elevation } from './elevation';
import { motion } from './motion';

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  fontFamily,
  elevation,
  motion,
};

export type Theme = typeof theme;
