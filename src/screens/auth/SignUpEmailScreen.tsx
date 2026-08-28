import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUpEmail'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Purely a UX simulation — no Google Cloud project/OAuth client exists for
// this app yet, so there's nothing to actually call. Real Google Sign-In
// would need the account owner to create OAuth credentials in Google Cloud
// Console (and, once Supabase is connected, wire them into its Google auth
// provider) — this mock just demonstrates the "skip straight in, no email,
// no OTP" speed benefit until that setup happens.
const MOCK_GOOGLE_SIGN_IN_DELAY_MS = 700;

export function SignUpEmailScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>(undefined);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const isValid = EMAIL_REGEX.test(email.trim());
  const showError = (touched && email.length > 0 && !isValid) || Boolean(sendError);

  const handleGoogleSignIn = () => {
    setIsGoogleSigningIn(true);
    setTimeout(() => {
      setIsGoogleSigningIn(false);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }, MOCK_GOOGLE_SIGN_IN_DELAY_MS);
  };

  const handleContinue = async () => {
    setTouched(true);
    setSendError(undefined);
    if (!isValid) return;
    const trimmedEmail = email.trim();

    if (!isSupabaseConfigured) {
      // No real backend configured — keep the existing mocked flow exactly
      // as-is, no network call, straight to the OTP screen.
      navigation.navigate('EmailOTP', { email: trimmedEmail });
      return;
    }

    setIsSending(true);
    const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail });
    setIsSending(false);
    if (error) {
      setSendError(error.message);
      return;
    }
    navigation.navigate('EmailOTP', { email: trimmedEmail });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>P</Text>
          </View>

          <Text style={styles.title}>What's your email?</Text>
          <Text style={styles.subtitle}>
            We'll send a 6-digit code to verify it's you. No passwords, no
            phone numbers.
          </Text>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={isGoogleSigningIn}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              isGoogleSigningIn && styles.googleButtonDisabled,
            ]}
          >
            {isGoogleSigningIn ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.fieldSpacing}>
            <TextField
              label="Email address"
              placeholder="priya.sharma@gmail.com"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched(true)}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              helperText={showError ? undefined : "We'll never share your email."}
              errorText={
                showError
                  ? sendError ?? 'Enter a valid email address.'
                  : undefined
              }
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Send Code"
            onPress={handleContinue}
            disabled={!email || isSending}
            loading={isSending}
          />
          <Text style={styles.footerText}>
            By continuing, you agree to ParkNext's Terms & Privacy Policy.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    flexGrow: 1,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoLetter: {
    ...typography.h2,
    color: colors.textOnPrimary,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  fieldSpacing: {
    marginTop: spacing.xs,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  googleButtonPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleButtonText: {
    ...typography.buttonLabel,
    color: colors.textPrimary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceBorder,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});