import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthProvider, useAuth } from './AuthContext';
import { RoleProvider } from './RoleContext';
import { UserProfileProvider, useUserProfile } from './UserProfileContext';
import { MainNavigator } from './MainNavigator';
import { colors } from '../theme';
import {
  SplashScreen,
  OnboardingScreen,
  SignInScreen,
  SignUpScreen,
  ForgotPasswordEmailScreen,
  ForgotPasswordOTPScreen,
  ResetPasswordScreen,
  CompleteProfileScreen,
} from '../screens/auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <AuthProvider>
      <UserProfileProvider>
        <RoleProvider>
          <RootNavigatorInner />
        </RoleProvider>
      </UserProfileProvider>
    </AuthProvider>
  );
}

/**
 * Conditionally renders one of four screen sets based on `isPasswordRecovery`,
 * `isSignedIn`, and `isProfileComplete` — the standard React Navigation "auth
 * flow" pattern, extended with two special-case in-between steps. Switching
 * which set is registered (rather than just navigating within one fixed set)
 * is what makes a real Supabase sign-out — which flips `isSignedIn` from
 * outside any screen's own navigation calls, via `onAuthStateChange` —
 * reliably land back on Splash, and what lets an already-signed-in user (with
 * an already-complete profile) skip straight past Splash/Onboarding/sign-in
 * on a cold start once a real session exists.
 *
 * `isPasswordRecovery` is checked *first*, ahead of `isSignedIn` — a
 * password-reset code verifying successfully establishes a real (if
 * short-lived) Supabase session of its own, which would otherwise satisfy
 * `isSignedIn` and drop someone straight into the main app mid password-reset
 * instead of letting them set a new one. See the comment on that flag in
 * `AuthContext.tsx` for the full reasoning.
 *
 * A signed-in user whose profile isn't complete yet — a brand-new account, by
 * any sign-in path — always lands on Complete Your Profile instead of Main,
 * with no way to navigate around it, until `completeProfile()` flips
 * `isProfileComplete` to `true`. In mock mode this is invisible: `isSignedIn`
 * starts `false` and flips to `true` the same way it always effectively did,
 * just via `signInMock()` instead of a manual `navigation.reset(...)`.
 */
function RootNavigatorInner() {
  const { isReady, isSignedIn, isPasswordRecovery } = useAuth();
  const { isProfileComplete } = useUserProfile();

  if (!isReady) {
    // Only reachable with Supabase configured, and only for the brief
    // moment it takes to check AsyncStorage for an existing session.
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isPasswordRecovery ? (
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      ) : isSignedIn && isProfileComplete ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : isSignedIn ? (
        <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      ) : (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ForgotPasswordEmail" component={ForgotPasswordEmailScreen} />
          <Stack.Screen name="ForgotPasswordOTP" component={ForgotPasswordOTPScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});