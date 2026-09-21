import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { BrandFooter } from '../../components/BrandFooter';
import { SignInHero } from '../../components/SignInHero';
import { TextField } from '../../components/TextField';
import { useTranslation } from '../../i18n';
import { colors, fontFamily, spacing, typography } from '../../theme';
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
      {/* Outside the ScrollView on purpose: as a content-container child its
          negative offset would be clipped on Android, and it's a backdrop
          rather than part of the form's flow. */}
      <SignInHero width={160} height={175} style={styles.hero} />

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

          {/* White needs no halo to win attention — the screen's one light
              source sits behind the amber CTA instead. */}
          <Button
            variant="google"
            label={t('auth.continueWithGoogle')}
            onPress={handleGoogleSignIn}
            loading={isGoogleSigningIn}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('signIn.divider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.fieldSpacing}>
            <TextField
              label={t('auth.emailLabel')}
              icon="mail-outline"
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
              icon="lock-closed-outline"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              secureToggle
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
            trailingIcon="arrow-forward"
            disabled={!email || !password || isSubmitting}
            loading={isSubmitting}
          />
          <Text style={styles.footerLinkRow}>
            {t('signIn.newHere')}{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('SignUp')}>{t('signIn.createAccount')}</Text>
          </Text>
        </View>

        {/* Left untranslated on purpose: this is part of the brand lock-up,
            like the wordmark above it — and letterspaced Devanagari breaks
            the shirorekha, so a Hindi version couldn't keep the same form. */}
        <BrandFooter height={112} />
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
  hero: {
    position: 'absolute',
    // Bleeds off the right edge so it reads as a window onto a scene rather
    // than a sticker dropped into the corner.
    right: 0,
    top: 25,
  },
  logoMark: {
    // 1400 x 266 artwork, so the height follows from the width.
    width: 180,
    height: 34,
    marginBottom: spacing.xxl,
  },
  brandTagline: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  fieldSpacing: {
    marginTop: spacing.sm,
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
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footerLink: {
    fontFamily: fontFamily.semiBold,
    color: colors.primary,
  },
});