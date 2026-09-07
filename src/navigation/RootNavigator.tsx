import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthProvider, useAuth } from './AuthContext';
import { RoleProvider } from './RoleContext';
import { UserProfileProvider } from './UserProfileContext';
import { MainNavigator } from './MainNavigator';
import { colors } from '../theme';
import { LanguageProvider } from '../i18n';
import { usePushBookingRequests } from '../hooks/usePushBookingRequests';
import {
  OnboardingScreen,
  SignInScreen,
  SignUpScreen,
  ForgotPasswordEmailScreen,
  ForgotPasswordOTPScreen,
  ResetPasswordScreen,
} from '../screens/auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <UserProfileProvider>
        <RoleProvider>
          <RootNavigatorInner />
        </RoleProvider>
        </UserProfileProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

/**
 * Conditionally renders one of three screen sets based on `isPasswordRecovery`
 * and `isSignedIn` — the standard React Navigation "auth flow" pattern, with
 * one special-case in-between step. Switching
 * which set is registered (rather than just navigating within one fixed set)
 * is what makes a real Supabase sign-out — which flips `isSignedIn` from
 * outside any screen's own navigation calls, via `onAuthStateChange` —
 * reliably land back on Onboarding, and what lets an already-signed-in user
 * skip straight past Onboarding/sign-in on a cold start once a real session
 * exists.
 *
 * `isPasswordRecovery` is checked *first*, ahead of `isSignedIn` — a
 * password-reset code verifying successfully establishes a real (if
 * short-lived) Supabase session of its own, which would otherwise satisfy
 * `isSignedIn` and drop someone straight into the main app mid password-reset
 * instead of letting them set a new one. See the comment on that flag in
 * `AuthContext.tsx` for the full reasoning.
 *
 * Signing in now goes straight to Main. There used to be a mandatory
 * Complete Your Profile step in between, collecting a name and mobile number
 * from every new account before it could reach the app at all. The number is
 * instead asked for at the point it's actually needed — confirming a booking
 * or publishing a listing — by `PhoneRequiredDialog`.
 */
function RootNavigatorInner() {
  const { isReady, isSignedIn, isPasswordRecovery } = useAuth();

  // Owner-side push: registers this device for booking requests and
  // performs Accept / Decline taken straight from the notification.
  usePushBookingRequests();

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
      ) : isSignedIn ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <>
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