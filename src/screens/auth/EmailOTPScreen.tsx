import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { OTPInput } from '../../components/OTPInput';
import { colors, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailOTP'>;

const RESEND_COOLDOWN_SECONDS = 30;
const MOCK_VERIFY_DELAY_MS = 900;

export function EmailOTPScreen({ navigation, route }: Props) {
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
      // No real backend configured — keep the existing local-only reset,
      // no network call.
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode('');
      setError(undefined);
      return;
    }

    setIsResending(true);
    const { error: resendError } = await supabase.auth.signInWithOtp({ email });
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
      setError('Enter the 6-digit code we sent you.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Auth is mocked for now — no real backend configured. Any 6-digit
      // code is accepted (123456 included) after a short simulated delay.
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }, MOCK_VERIFY_DELAY_MS);
      return;
    }

    setIsVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setIsVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const formattedCooldown = `0:${cooldown.toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
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
              {isResending ? 'Resending…' : "Didn't get a code? Resend now"}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Verify & Continue" onPress={handleVerify} loading={isVerifying} />
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
