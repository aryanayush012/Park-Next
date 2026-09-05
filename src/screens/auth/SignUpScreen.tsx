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
import { useTranslation } from '../../i18n';
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
  const { t } = useTranslation();
  const { signInMock } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [infoMessage, setInfoMessage] = useState<string | undefined>(undefined);

  const hasFirstName = firstName.trim().length > 0;
  const hasLastName = lastName.trim().length > 0;
  const isValidEmail = EMAIL_REGEX.test(email.trim());
  const isValidPassword = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isValid =
    hasFirstName && hasLastName && isValidEmail && isValidPassword && passwordsMatch;

  const showFirstNameError = touched && !hasFirstName;
  const showLastNameError = touched && !hasLastName;
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
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

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
      options: {
        // Lands in the auth user's `user_metadata`, which is where
        // `UserProfileContext` looks to seed the `profiles` row — the same
        // route Google's own `full_name`/`picture` arrive by, so neither
        // sign-up path needs a screen of its own to ask for a name.
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: `${trimmedFirstName} ${trimmedLastName}`,
        },
      },
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
      setInfoMessage(t('signUp.confirmEmail'));
      return;
    }
    // A real session already exists — no manual navigation needed,
    // `AuthContext`'s `onAuthStateChange` listener picks it up and
    // `RootNavigator` swaps to the main app on its own.
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

          <Text style={styles.title}>{t('signUp.title')}</Text>
          <Text style={styles.subtitle}>{t('signUp.subtitle')}</Text>

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
            <Text style={styles.dividerText}>{t('signUp.divider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={[styles.fieldSpacing, styles.nameRow]}>
            <View style={styles.nameField}>
              <TextField
                label={t('signUp.firstName')}
                placeholder="Priya"
                value={firstName}
                onChangeText={setFirstName}
                onBlur={() => setTouched(true)}
                autoCapitalize="words"
                errorText={showFirstNameError ? t('signUp.firstNameError') : undefined}
              />
            </View>
            <View style={styles.nameField}>
              <TextField
                label={t('signUp.lastName')}
                placeholder="Sharma"
                value={lastName}
                onChangeText={setLastName}
                onBlur={() => setTouched(true)}
                autoCapitalize="words"
                errorText={showLastNameError ? t('signUp.lastNameError') : undefined}
              />
            </View>
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
              placeholder={t('auth.passwordMinPlaceholder')}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              secureTextEntry
              errorText={showPasswordError ? t('auth.passwordTooShort') : undefined}
            />
          </View>
          <View style={styles.fieldSpacing}>
            <TextField
              label={t('signUp.confirmPassword')}
              placeholder={t('auth.typeItAgain')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={() => setTouched(true)}
              autoCapitalize="none"
              autoComplete="password-new"
              secureTextEntry
              errorText={showConfirmError ? t('auth.passwordsDontMatch') : undefined}
            />
          </View>

          {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
          {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('signUp.submit')}
            onPress={handleCreateAccount}
            disabled={
              !firstName || !lastName || !email || !password || !confirmPassword || isSubmitting
            }
            loading={isSubmitting}
          />
          <Text style={styles.footerText}>
            By continuing, you agree to ParkNext's Terms & Privacy Policy.
          </Text>
          <Text style={styles.footerLinkRow}>
            Already have an account?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('SignIn')}>{t('signIn.submit')}</Text>
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
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  nameField: {
    flex: 1,
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