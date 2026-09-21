import { ViewStyle } from 'react-native';
import { colors } from './colors';

/**
 * Soft colored glow elevation — used instead of flat black shadows, which
 * read wrong on a dark surface. Apply to primary CTAs / active elements.
 */
type Glow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const elevation: Record<
  'none' | 'glowPrimary' | 'glowSecondary' | 'glowAmbient' | 'card' | 'cardRaised',
  Glow
> = {
  none: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  glowPrimary: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  glowSecondary: {
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  /**
   * A wide, faint amber halo — atmosphere rather than lift. For the lamp
   * bloom behind a hero element, where `glowPrimary`'s tight offset shadow
   * would read as a hard drop shadow instead of light in the air.
   */
  glowAmbient: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 12,
  },
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  /** The one card a screen is built around, when it needs to sit above its peers. */
  cardRaised: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
};
