import React, { useContext } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { HorizonGlow } from './HorizonGlow';

/**
 * The line ParkNext signs off with, on the horizon art.
 *
 * Deliberately one constant rather than a string passed in at each call
 * site: a tagline that varies screen to screen stops being a tagline. Left
 * untranslated for the same reason the wordmark is — it's part of the brand
 * lock-up, and letterspaced Devanagari breaks the shirorekha, so a Hindi
 * version couldn't hold the same form anyway.
 */
const TAGLINE: [string, string] = ['PARK SMART', 'LIVE BETTER'];

export interface BrandFooterProps {
  /**
   * Height in dp. Use the default where a screen has room; pass something
   * shorter on dense screens that only have a sliver to spare.
   */
  height?: number;
  /**
   * Drop the words and keep the skyline. For screens that already carry a
   * lot of text at the bottom, where the tagline would be one voice too
   * many but the horizon still closes the page.
   */
  silent?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BrandFooter({ height = 104, silent, style }: BrandFooterProps) {
  const insets = useSafeAreaInsets();
  // `undefined` outside a tab navigator — the auth screens — and a number
  // inside one, which is exactly the distinction needed below.
  const underTabBar = useContext(BottomTabBarHeightContext) !== undefined;

  /**
   * Sit flush on top of the tab bar.
   *
   * The screens all wrap themselves in `SafeAreaView edges={['top','bottom']}`,
   * and `BottomTabView` does NOT override `SafeAreaInsetsContext` for the
   * screens it hosts — it only forwards insets to the tab bar. So on a tab
   * screen the device's bottom inset gets paid for twice: once by the
   * screen's own safe-area padding, and again by the tab bar's
   * `paddingBottom`. That leaves a band of dead space under the horizon.
   *
   * Cancelling the screen's half here keeps the correction in one place and
   * scales with the actual device, rather than each screen hand-tuning a
   * magic negative margin that's wrong on the next handset.
   */
  const flushToTabBar: ViewStyle | null =
    underTabBar && insets.bottom > 0 ? { marginBottom: -insets.bottom } : null;

  return (
    <HorizonGlow
      height={height}
      tagline={silent ? undefined : TAGLINE}
      style={[flushToTabBar, style]}
    />
  );
}
