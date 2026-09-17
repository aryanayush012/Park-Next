import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { AppReadyProvider } from './src/navigation/AppReadyContext';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op — safe to ignore if it's already hidden or unsupported.
});

/**
 * Google sign-in hands off to a system browser (`WebBrowser.openAuthSessionAsync`)
 * and gets control back via a `parknext://auth-callback` deep link. Confirmed
 * on-device: that round trip doesn't just re-render `App`, it re-boots the JS
 * engine outright (the OS reclaims the backgrounded app's process, then
 * silently restarts it to deliver the deep link — invisible to the user, who
 * never sees "the app closed") — so even module-level state resets, and the
 * native splash screen itself (governed by `Theme.App.SplashScreen`, shown
 * before any JS runs) genuinely re-appears too, not just this component's own
 * `AnimatedSplash`. Nothing that lives only in this process' memory can
 * survive that, so this has to be checked from disk instead.
 *
 * Time-windowed rather than "seen once, ever": a real cold open later —
 * next day, after actually closing the app — should still play the intro
 * normally, same as any other app's splash. 30 minutes is the standard
 * mobile session-timeout convention (Firebase/Google Analytics, Adobe
 * Analytics, Mixpanel all default a session to expiring after 30 minutes of
 * inactivity) — reusing it here means "still mid-session" is judged the same
 * way most apps already define that boundary, rather than a value picked
 * just to outlast a Google sign-in specifically.
 */
const SPLASH_SEEN_AT_KEY = 'parknext:splashSeenAt';
const SPLASH_SKIP_WINDOW_MS = 30 * 60 * 1000;

async function wasSplashRecentlyShown(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SPLASH_SEEN_AT_KEY);
    const seenAt = raw ? Number(raw) : NaN;
    return Number.isFinite(seenAt) && Date.now() - seenAt < SPLASH_SKIP_WINDOW_MS;
  } catch {
    return false; // Can't read it — safest default is to just play the intro.
  }
}

function rememberSplashShown() {
  AsyncStorage.setItem(SPLASH_SEEN_AT_KEY, String(Date.now())).catch(() => {
    // Not fatal — worst case a future OS-triggered restart replays the intro.
  });
}

const navigationTheme: NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.surfaceBorder,
    primary: colors.primary,
    text: colors.textPrimary,
  },
};

export default function App() {
  // The overlay sits above the navigator rather than replacing it, so the
  // whole app mounts and settles underneath while the animation plays.
  // `null` = still checking disk for a recent play; treated the same as
  // "not ready yet" below, exactly like `fontsLoaded` already is — the
  // native splash screen is still covering the screen during that check
  // regardless, so there's nothing to flash.
  const [splashDone, setSplashDone] = useState<boolean | null>(null);

  useEffect(() => {
    wasSplashRecentlyShown().then(setSplashDone);
  }, []);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded && splashDone !== null) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, splashDone]);

  if (!fontsLoaded || splashDone === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style="light" />
          <NavigationContainer ref={navigationRef} theme={navigationTheme}>
            <AppReadyProvider ready={splashDone}>
              <RootNavigator />
            </AppReadyProvider>
          </NavigationContainer>
          {splashDone ? null : (
            <AnimatedSplash
              onFinish={() => {
                rememberSplashShown();
                setSplashDone(true);
              }}
            />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
