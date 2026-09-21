import { TextStyle } from 'react-native';

/**
 * Font family names as registered by @expo-google-fonts/inter in App.tsx.
 * Falls back to system font until fonts finish loading.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

type TypeStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontWeight'>;

/**
 * Type scale — display down to caption/button-label.
 */
export const typography: Record<
  | 'displayLarge'
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLarge'
  | 'body'
  | 'bodyMedium'
  | 'eyebrow'
  | 'label'
  | 'dataValue'
  | 'caption'
  | 'buttonLabel',
  TypeStyle
> = {
  /**
   * Screen-opening statements only — "Welcome back", "My Bookings". One per
   * screen, at the top, never mid-page. Tighter tracking than `display`
   * because at this size the default spacing reads loose.
   */
  displayLarge: {
    fontFamily: fontFamily.extraBold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  display: {
    fontFamily: fontFamily.extraBold,
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    lineHeight: 25,
  },
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 17,
    lineHeight: 25,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  /**
   * Letterspaced micro-caps — section markers and the brand taglines that
   * sit on the horizon art. Callers pass the text already uppercased;
   * `textTransform` isn't part of the shared type so it stays a deliberate
   * choice at the call site.
   */
  eyebrow: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.6,
  },
  /** The quiet grey word above a value — "Date", "Total Price". */
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  /**
   * Numbers someone reads off the screen under pressure — an arrival code at
   * a barrier gate, a price, a countdown. Deliberately a step above `h3`:
   * these are the payload of the screen, not a heading for it.
   */
  dataValue: {
    fontFamily: fontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  buttonLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
};
