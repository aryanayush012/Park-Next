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
import { signInWithGoogle } from '../../utils/googleAuth';
import { useAuth } from '../../navigation/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Matches Supabase Auth's own default minimum ("Minimum password length: 6"
// under Authentication → Providers → Email) — client-side validation here
// is purely a fast-feedback nicety, the real enforcement is server-side.
const MIN_PASSWORD_LENGTH = 6;
const MOCK_SIGN_UP_DELAY_MS = 700;
const MOCK_GOOGLE_SIGN_IN_DELAY_MS = 700;

export function SignUpScreen({ navigation }: Props) {
  const { signInMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [infoMessage, setInfoMessage] = useState<string | undefined>(undefined);

  const isValidEmail = EMAIL_REGEX.test(email.trim());
  const isValidPassword = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isValid = isValidEmail && isValidPassword && passwordsMatch;

  const showEmailError = touched && email.length > 0 && !isValidEmail;
  const showPasswordError = touched && password.length > 0 && !isValidPassword;
  const showConfirmError = touched && confirmPassword.length > 0 && !passwordsMatch;

  const handleGoogleSignIn = async () => {
    setFormError(undefined);
    setInfoMessage(undefined);

    if (!isSupabaseConfigured) {
      setIsGoogleSigningIn(true);
      setTimeout(() => {
        setIsGoogleSigningIn(false);
        signInMock();
      }, MOCK_GOOGLE_SIGN_IN_DELAY_MS);
      return;
    }

    setIsGoogleSigningIn(true);
    const result = await signInWithGoogle();
    setIsGoogleSigningIn(false);
    if (result.status === 'error') {
      setFormError(result.message);
    }
  };

  const handleCreateAccount = async () => {
    setTouched(true);
    setFormError(undefined);
    setInfoMessage(undefined);
    if (!isValid) return;
    const trimmedEmail = email.trim();

    if (!isSupabaseConfigured) {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        signInMock();
      }, MOCK_SIGN_UP_DELAY_MS);
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    setIsSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    if (!data.session) {
      // Only reachable if "Confirm email" is still turned on for this
      // project (see supabase/README.md, which recommends turning it off
      // for exactly this reason) — `signUp` succeeds but there's no session
      // until the confirmation link is clicked, so there's nothing more to
      // do on this screen right now.
      setInfoMessage('Check your email to confirm your account, then sign in.');
      return;
    }
    // A real session already exists — no manual navigation needed,
    // `AuthContext`'s `onAuthStateChange` listener picks it up and
    // `RootNavigator` swaps to Complete Your Profile on its own.
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

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Rent a spot, or list your own — it only takes a minute.</Text>

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
            <Text style={styles.dividerText}>or sign up with email</Text>
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
              errorText={showEmailError ? 'Enter a valid email address.' : undefined}
            />
          </View>
          <View style={styles.fieldSpacing}>
            <TextField
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              secureTextEntry
              errorText={showPasswordError ? 'Use at least 6 characters.' : undefined}
            />
          </View>
          <View style={styles.fieldSpacing}>
            <TextField
              label="Confirm password"
              placeholder="Type it again"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={() => setTouched(true)}
              autoCapitalize="none"
              autoComplete="password-new"
              secureTextEntry
              errorText={showConfirmError ? "Passwords don't match." : undefined}
            />
          </View>

          {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
          {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Create Account"
            onPress={handleCreateAccount}
            disabled={!email || !password || !confirmPassword || isSubmitting}
            loading={isSubmitting}
          />
          <Text style={styles.footerText}>
            By continuing, you agree to ParkNext's Terms & Privacy Policy.
          </Text>
          <Text style={styles.footerLinkRow}>
            Already have an account?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('SignIn')}>
              Sign In
            </Text>
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
    marginTop: spacing.sm,
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
  formErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
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
  footerLinkRow: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footerLink: {
    color: colors.primary,
  },
});