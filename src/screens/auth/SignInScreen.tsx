import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useTranslation } from '../../i18n';
import { colors, radius, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';
import { signInWithGoogle } from '../../utils/googleAuth';
import { useAuth } from '../../navigation/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mock mode has no real backend to check credentials against — these just
// simulate the network delay so the button's loading state feels real. Any
// non-empty password is accepted, same spirit as the old "any 6-digit OTP"
// mock.
const MOCK_SIGN_IN_DELAY_MS = 700;
const MOCK_GOOGLE_SIGN_IN_DELAY_MS = 700;

export function SignInScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { signInMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const isValidEmail = EMAIL_REGEX.test(email.trim());
  const showEmailError = touched && email.length > 0 && !isValidEmail;
  const canSubmit = isValidEmail && password.length > 0;

  const handleGoogleSignIn = async () => {
    setFormError(undefined);

    if (!isSupabaseConfigured) {
      // Purely a UX simulation in mock mode, same as before — there's no
      // real Google Cloud OAuth client to call without a Supabase project
      // to register it against.
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
    // 'cancelled' (user backed out of the browser tab) — nothing to show,
    // just let them try again. 'success' — no manual navigation needed,
    // `AuthContext`'s `onAuthStateChange` listener picks up the new session
    // and `RootNavigator` swaps screens on its own.
  };

  const handleSignIn = async () => {
    setTouched(true);
    setFormError(undefined);
    if (!canSubmit) return;
    const trimmedEmail = email.trim();

    if (!isSupabaseConfigured) {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        signInMock();
      }, MOCK_SIGN_IN_DELAY_MS);
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setIsSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    // No manual navigation — same reasoning as the Google path above.
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
          <Image
            source={require('../../../assets/logo-wordmark.png')}
            style={styles.logoMark}
            resizeMode="contain"
            accessibilityLabel="ParkNext"
          />

          <Text style={styles.title}>{t('signIn.title')}</Text>
          <Text style={styles.subtitle}>{t('signIn.subtitle')}</Text>

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
                <Text style={styles.googleButtonText}>{t('auth.continueWithGoogle')}</Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('signIn.divider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.fieldSpacing}>
            <TextField
              label={t('auth.emailLabel')}
              placeholder="priya.sharma@gmail.com"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched(true)}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              errorText={showEmailError ? t('auth.emailInvalid') : undefined}
            />
          </View>
          <View style={styles.fieldSpacing}>
            <TextField
              label={t('auth.passwordLabel')}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
            />
          </View>

          <Text
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPasswordEmail')}
          >{t('signIn.forgot')}</Text>

          {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('signIn.submit')}
            onPress={handleSignIn}
            disabled={!email || !password || isSubmitting}
            loading={isSubmitting}
          />
          <Text style={styles.footerLinkRow}>
            New here?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('SignUp')}>{t('signIn.createAccount')}</Text>
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
    // 1400 x 271 artwork, so the height follows from the width.
    width: 168,
    height: 33,
    marginBottom: spacing.lg,
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
  forgotLink: {
    ...typography.caption,
    color: colors.primary,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  formErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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