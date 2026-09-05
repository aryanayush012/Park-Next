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
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bodyLarge'
  | 'body'
  | 'bodyMedium'
  | 'caption'
  | 'buttonLabel',
  TypeStyle
> = {
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
