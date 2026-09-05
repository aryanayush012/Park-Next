import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radius, spacing, typography } from '../theme';
import { useUserProfile } from '../navigation/UserProfileContext';
import { isValidPhone, sanitizePhoneInput, toE164 } from '../utils/phone';
import { useTranslation } from '../i18n';

const REASON_KEYS = {
  book: 'phone.reasonBook',
  publish: 'phone.reasonPublish',
  /** Opened from Profile to add or change a number, with no action waiting. */
  manage: 'phone.reasonManage',
} as const;

export interface PhoneRequiredDialogProps {
  visible: boolean;
  /** Which action is being gated. Picks the explanation shown. */
  reason: keyof typeof REASON_KEYS;
  onCancel: () => void;
  /**
   * Fired once the number is saved. Continue the interrupted action directly
   * here — don't re-run the check that opened this dialog. `updateProfile`
   * updates context state, which hasn't re-rendered the caller yet at this
   * point, so a re-check would still read the old empty number and reopen this
   * dialog forever.
   */
  onSaved: () => void;
}

/**
 * Collects a mobile number at the moment it's actually needed — confirming a
 * booking, publishing a listing, or from Profile.
 *
 * The number is **not** verified. SMS OTP was built and works (see
 * `supabase/README.md`), but Firebase gates real SMS behind a paid plan, so
 * V1 ships the requirement without the proof. The number is only revealed to
 * the other party once a booking is confirmed, which keeps the cost of an
 * unverified one low — it is worth adding verification when no-shows and fake
 * listings become a real problem, not before.
 */
export function PhoneRequiredDialog({
  visible,
  reason,
  onCancel,
  onSaved,
}: PhoneRequiredDialogProps) {
  const { updateProfile } = useUserProfile();
  const { t } = useTranslation();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const close = () => {
    setPhone('');
    setError(undefined);
  };

  const handleCancel = () => {
    close();
    onCancel();
  };

  const handleSave = () => {
    const trimmed = phone.trim();
    if (!isValidPhone(trimmed)) {
      setError(t('phone.invalid'));
      return;
    }
    // Stored canonically, so one number is one value however it was typed.
    updateProfile({ phone: toE164(trimmed) });
    close();
    onSaved();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <Ionicons name="call-outline" size={22} color={colors.primary} />
          </View>

          <Text style={styles.title}>{t('phone.dialogTitle')}</Text>
          <Text style={styles.body}>{t(REASON_KEYS[reason])}</Text>

          <TextField
            label={t('profile.fieldMobile')}
            prefix="+91"
            placeholder={t('profile.mobilePlaceholder')}
            value={phone}
            onChangeText={(text) => {
              setPhone(sanitizePhoneInput(text));
              if (error) setError(undefined);
            }}
            keyboardType="number-pad"
            maxLength={10}
            autoFocus
            errorText={error}
          />

          <Button
            label={t('phone.saveAndContinue')}
            onPress={handleSave}
            style={styles.saveButton}
          />
          <Pressable onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>{t('phone.notNow')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  saveButton: {
    marginTop: spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelLabel: {
    ...typography.buttonLabel,
    color: colors.textSecondary,
  },
});
