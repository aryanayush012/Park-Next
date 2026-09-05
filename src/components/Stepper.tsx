import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { useTranslation } from '../i18n';

/**
 * Direct editing of the stepper's value.
 *
 * Everything is minutes — a time of day is minutes since midnight, a duration
 * is just minutes — so one shape covers both kinds of control in the app.
 */
export interface StepperEdit {
  /** `time` shows an AM/PM toggle; `duration` is a plain hours + minutes span. */
  kind: 'time' | 'duration';
  minutes: number;
  min: number;
  max: number;
  onChange: (minutes: number) => void;
}

export interface StepperProps {
  label: string;
  valueLabel: string;
  onIncrement: () => void;
  onDecrement: () => void;
  canIncrement?: boolean;
  canDecrement?: boolean;
  /** Omit and the value is plain text, exactly as before. */
  edit?: StepperEdit;
}

/**
 * +/- stepper for the duration and time-of-day controls across the booking
 * flow. Deliberately custom rather than a native date/time picker dependency.
 *
 * The buttons move in fixed steps for quick nudges; tapping the value itself
 * opens a keypad, the way a phone's clock app lets you type a time instead of
 * spinning to it. Typed values are **not** snapped to the button's step — the
 * whole point of typing is to reach 2:47 when the buttons only offer :30s.
 * They are still clamped to the same bounds.
 */
export function Stepper({
  label,
  valueLabel,
  onIncrement,
  onDecrement,
  canIncrement = true,
  canDecrement = true,
  edit,
}: StepperProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          onPress={onDecrement}
          disabled={!canDecrement}
          style={[styles.button, !canDecrement && styles.buttonDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="remove"
            size={18}
            color={canDecrement ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>

        {edit ? (
          <Pressable
            onPress={() => setIsEditing(true)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${valueLabel}`}
            hitSlop={6}
          >
            {/* Underlined so it reads as editable rather than as a readout. */}
            <Text style={[styles.valueLabel, styles.valueEditable]}>{valueLabel}</Text>
          </Pressable>
        ) : (
          <Text style={styles.valueLabel}>{valueLabel}</Text>
        )}

        <Pressable
          onPress={onIncrement}
          disabled={!canIncrement}
          style={[styles.button, !canIncrement && styles.buttonDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="add"
            size={18}
            color={canIncrement ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>
      </View>

      {edit ? (
        <ValueEditor
          visible={isEditing}
          title={label}
          edit={edit}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
    </View>
  );
}

function ValueEditor({
  visible,
  title,
  edit,
  onClose,
}: {
  visible: boolean;
  title: string;
  edit: StepperEdit;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const isTime = edit.kind === 'time';

  const initialHours = isTime
    ? Math.floor(edit.minutes / 60) % 12 || 12
    : Math.floor(edit.minutes / 60);

  const [hours, setHours] = useState(String(initialHours));
  const [mins, setMins] = useState(String(edit.minutes % 60).padStart(2, '0'));
  const [isPm, setIsPm] = useState(edit.minutes >= 12 * 60);
  const [error, setError] = useState<string | undefined>(undefined);

  // Re-seed each time it opens, so cancelling never leaves a stale draft.
  const open = () => {
    setHours(String(initialHours));
    setMins(String(edit.minutes % 60).padStart(2, '0'));
    setIsPm(edit.minutes >= 12 * 60);
    setError(undefined);
  };

  const handleSet = () => {
    const h = Number(hours);
    const m = Number(mins);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m > 59) {
      setError(t('stepper.invalid'));
      return;
    }

    const total = isTime ? ((h % 12) + (isPm ? 12 : 0)) * 60 + m : h * 60 + m;

    if (total < edit.min || total > edit.max) {
      setError(t('stepper.outOfRange', { min: describe(edit.min), max: describe(edit.max) }));
      return;
    }

    edit.onChange(total);
    onClose();
  };

  const describe = (minutes: number) => {
    if (!isTime) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m === 0 ? `${h}h` : `${h}h ${m}m`;
    }
    const h12 = Math.floor(minutes / 60) % 12 || 12;
    const suffix = minutes >= 12 * 60 ? 'PM' : 'AM';
    return `${h12}:${String(minutes % 60).padStart(2, '0')} ${suffix}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={open}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{title}</Text>

          <View style={styles.fieldRow}>
            <TextInput
              value={hours}
              onChangeText={(text) => {
                setHours(text.replace(/\D/g, '').slice(0, 2));
                if (error) setError(undefined);
              }}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
              autoFocus
              style={styles.field}
              placeholder="HH"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.colon}>:</Text>
            <TextInput
              value={mins}
              onChangeText={(text) => {
                setMins(text.replace(/\D/g, '').slice(0, 2));
                if (error) setError(undefined);
              }}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
              style={styles.field}
              placeholder="MM"
              placeholderTextColor={colors.textMuted}
            />

            {isTime ? (
              <View style={styles.meridiem}>
                {(['AM', 'PM'] as const).map((option) => {
                  const active = (option === 'PM') === isPm;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setIsPm(option === 'PM')}
                      style={[styles.meridiemButton, active && styles.meridiemButtonActive]}
                    >
                      <Text style={[styles.meridiemText, active && styles.meridiemTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          <Text style={error ? styles.errorText : styles.hintText}>
            {error ?? t('stepper.range', { min: describe(edit.min), max: describe(edit.max) })}
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.actionButton}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={handleSet} style={[styles.actionButton, styles.setButton]}>
              <Text style={styles.setText}>{t('common.set')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  valueLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    minWidth: 78,
    textAlign: 'center',
  },
  valueEditable: {
    color: colors.primary,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },

  // --- editor ----------------------------------------------------------
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  field: {
    ...typography.h2,
    color: colors.textPrimary,
    backgroundColor: 'colors.surfaceElevated',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    width: 72,
    textAlign: 'center',
  },
  colon: {
    ...typography.h2,
    color: colors.textSecondary,
  },
  meridiem: {
    marginLeft: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
  },
  meridiemButton: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  meridiemButtonActive: {
    backgroundColor: colors.primary,
  },
  meridiemText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  meridiemTextActive: {
    color: colors.textOnPrimary,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  setButton: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    ...typography.buttonLabel,
    color: colors.textSecondary,
  },
  setText: {
    ...typography.buttonLabel,
    color: colors.textOnPrimary,
  },
});
