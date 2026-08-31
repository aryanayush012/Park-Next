import React, { useState } from 'react';
import {
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
import { colors, spacing, typography } from '../../theme';
import { RootStackParamList } from '../../navigation/types';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPasswordEmail'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordEmailScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>(undefined);

  const isValid = EMAIL_REGEX.test(email.trim());
  const showError = (touched && email.length > 0 && !isValid) || Boolean(sendError);

  const handleSendCode = async () => {
    setTouched(true);
    setSendError(undefined);
    if (!isValid) return;
    const trimmedEmail = email.trim();

    if (!isSupabaseConfigured) {
      // No real backend configured — keep the same mocked flow as every
      // other auth screen: no network call, straight to the code screen.
      navigation.navigate('ForgotPasswordOTP', { email: trimmedEmail });
      return;
    }

    setIsSending(true);
    // Uses Supabase's "Reset Password" email template — a different one
    // from the "Magic Link" template email+password sign-in no longer uses
    // — see supabase/README.md for the one-time setup that makes this send
    // a typeable 6-digit code instead of a clickable link.
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
    setIsSending(false);
    if (error) {
      setSendError(error.message);
      return;
    }
    navigation.navigate('ForgotPasswordOTP', { email: trimmedEmail });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter the email on your account and we'll send you a 6-digit code to reset your
            password.
          </Text>

          <TextField
            label="Email address"
            placeholder="priya.sharma@gmail.com"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            errorText={showError ? sendError ?? 'Enter a valid email address.' : undefined}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Send Reset Code"
            onPress={handleSendCode}
            disabled={!email || isSending}
            loading={isSending}
          />
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
  backButton: {
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});