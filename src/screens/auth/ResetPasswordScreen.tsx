import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, spacing, typography } from '../../theme';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';
import { useAuth } from '../../navigation/AuthContext';

const MIN_PASSWORD_LENGTH = 6;
const MOCK_UPDATE_DELAY_MS = 700;

/**
 * Reachable only while `AuthContext`'s `isPasswordRecovery` flag is set —
 * `RootNavigator` renders this screen alone (no Sign In/Up siblings)
 * whenever that flag is true, regardless of `isSignedIn`. See the comment
 * on that flag in `AuthContext.tsx` for why it exists at all instead of
 * just gating on a recovery-specific auth event.
 */
export function ResetPasswordScreen() {
  const { endPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const isValidPassword = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isValid = isValidPassword && passwordsMatch;

  const showPasswordError = touched && password.length > 0 && !isValidPassword;
  const showConfirmError = touched && confirmPassword.length > 0 && !passwordsMatch;

  const finishAndReturnToSignIn = () => {
    Alert.alert('Password updated', 'Sign in with your new password.', [
      { text: 'OK', onPress: () => endPasswordRecovery() },
    ]);
  };

  const handleUpdatePassword = async () => {
    setTouched(true);
    setFormError(undefined);
    if (!isValid) return;

    if (!isSupabaseConfigured) {
      setIsSubmitting(true);
      setTimeout(() => {
        setIsSubmitting(false);
        finishAndReturnToSignIn();
      }, MOCK_UPDATE_DELAY_MS);
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    finishAndReturnToSignIn();
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    await endPasswordRecovery();
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
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your account — you'll use it to sign in from now on.
          </Text>

          <TextField
            label="New password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (formError) setFormError(undefined);
            }}
            autoCapitalize="none"
            autoComplete="password-new"
            secureTextEntry
            errorText={showPasswordError ? 'Use at least 6 characters.' : undefined}
          />
          <View style={styles.fieldSpacing}>
            <TextField
              label="Confirm new password"
              placeholder="Type it again"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (formError) setFormError(undefined);
              }}
              onBlur={() => setTouched(true)}
              autoCapitalize="none"
              autoComplete="password-new"
              secureTextEntry
              errorText={showConfirmError ? "Passwords don't match." : undefined}
            />
          </View>

          {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Update Password"
            onPress={handleUpdatePassword}
            disabled={!password || !confirmPassword || isSubmitting}
            loading={isSubmitting}
          />
          <Text style={styles.cancelLink} onPress={handleCancel} suppressHighlighting={isCancelling}>
            {isCancelling ? 'Cancelling…' : 'Changed your mind? Back to Sign In'}
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
    paddingTop: spacing.xl,
    flexGrow: 1,
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
  formErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cancelLink: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});