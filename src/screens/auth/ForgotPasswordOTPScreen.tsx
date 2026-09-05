import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { OTPInput } from '../../components/OTPInput';
import { useTranslation } from '../../i18n';
import { colors, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';
import { useAuth } from '../../navigation/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPasswordOTP'>;

const RESEND_COOLDOWN_SECONDS = 30;
const MOCK_VERIFY_DELAY_MS = 900;

export function ForgotPasswordOTPScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { beginPasswordRecovery } = useAuth();
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChangeCode = (value: string) => {
    setCode(value);
    if (error) setError(undefined);
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    if (!isSupabaseConfigured) {
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode('');
      setError(undefined);
      return;
    }

    setIsResending(true);
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
    setIsResending(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCode('');
    setError(undefined);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError(t('forgotOtp.codeRequired'));
      return;
    }

    if (!isSupabaseConfigured) {
      // Mocked, same as every other auth screen without a real backend —
      // any 6-digit code is accepted after a short simulated delay.
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        beginPasswordRecovery();
      }, MOCK_VERIFY_DELAY_MS);
      return;
    }

    setIsVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    setIsVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    // A successful `verifyOtp({ type: 'recovery' })` establishes a real
    // (if short-lived) Supabase session — which, left unchecked, would
    // otherwise make `AuthContext`'s own `onAuthStateChange` listener flip
    // `isSignedIn` true and let `RootNavigator` jump straight into the main
    // app before this person ever sets a new password. `beginPasswordRecovery`
    // sets an explicit local flag `RootNavigator` checks *ahead of*
    // `isSignedIn`, forcing it to Reset Password instead regardless of
    // whatever auth event Supabase's SDK happens to fire internally here
    // (verified inconsistent across Supabase's own SDKs — see the comment
    // on `isPasswordRecovery` in AuthContext.tsx).
    beginPasswordRecovery();
  };

  const formattedCooldown = `0:${cooldown.toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>{t('forgotOtp.title')}</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

        <View style={styles.otpWrap}>
          <OTPInput value={code} onChange={handleChangeCode} autoFocus />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.resendRow}>
          {cooldown > 0 ? (
            <Text style={styles.resendText}>
              Didn't get a code? Resend in {formattedCooldown}
            </Text>
          ) : (
            <Text
              style={styles.resendLink}
              onPress={handleResend}
              suppressHighlighting={isResending}
            >
              {isResending ? t('forgotOtp.resending') : t('forgotOtp.resend')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label={t('forgotOtp.verify')} onPress={handleVerify} loading={isVerifying} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backButton: {
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  otpWrap: {
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  resendRow: {
    marginTop: spacing.xs,
  },
  resendText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  resendLink: {
    ...typography.caption,
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});