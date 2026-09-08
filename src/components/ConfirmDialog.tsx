import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme';

export type ConfirmTone = 'primary' | 'danger';

export interface ConfirmDialogProps {
  visible: boolean;
  /** Icon in the circle at the top. Carries the meaning before the words do. */
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  confirmLabel: string;
  /**
   * Omit for a one-button acknowledgement — a failure message with nothing to
   * decide. When omitted there is no cancel row, and dismissing with the
   * hardware back button calls `onConfirm`, since acknowledging is the only
   * thing the dialog can do.
   */
  cancelLabel?: string;
  /** `danger` for anything irreversible: red confirm button, red icon. */
  tone?: ConfirmTone;
  /** Shows a spinner in the confirm button and blocks both actions. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * The app's confirmation dialog, in place of `Alert.alert`.
 *
 * `Alert.alert` renders the platform's own dialog, which on Android arrives
 * in Material colours on a white sheet — in the middle of a dark amber app it
 * reads as a system error rather than part of the product. This is the same
 * shell as `PhoneRequiredDialog` so every interruption in the app looks like
 * it came from the same place.
 */
export function ConfirmDialog({
  visible,
  icon,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = tone === 'danger';
  const dismiss = onCancel ?? onConfirm;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : dismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={[styles.iconCircle, isDanger && styles.iconCircleDanger]}>
            <Ionicons
              name={icon}
              size={22}
              color={isDanger ? colors.error : colors.primary}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Button
            label={confirmLabel}
            variant={isDanger ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={loading}
            style={styles.confirmButton}
          />

          {cancelLabel && onCancel ? (
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={styles.cancelButton}
              accessibilityRole="button"
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
          ) : null}
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
  iconCircleDanger: {
    backgroundColor: colors.errorMuted,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  confirmButton: {
    marginTop: spacing.lg,
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
