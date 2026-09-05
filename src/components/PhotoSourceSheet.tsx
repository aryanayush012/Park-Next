import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { useTranslation } from '../i18n';

export interface PhotoSourceSheetProps {
  visible: boolean;
  /** Heading, e.g. "Add a listing photo". */
  title: string;
  onClose: () => void;
  onCamera: () => void;
  onLibrary: () => void;
}

/**
 * Bottom sheet for picking where a photo comes from — the Camera/Photos
 * choice every other app shows before opening a picker.
 *
 * This lives in the app rather than in the OS sheet because Android won't
 * list a camera app in its own "Open with" chooser: camera apps register no
 * ACTION_GET_CONTENT filter, so a Camera entry has to be injected with
 * `EXTRA_INITIAL_INTENTS`, which needs native code expo-image-picker doesn't
 * expose. Two tiles in JS get the same result with nothing to rebuild.
 */
export function PhotoSourceSheet({
  visible,
  title,
  onClose,
  onCamera,
  onLibrary,
}: PhotoSourceSheetProps) {
  const { t } = useTranslation();
  const choose = (action: () => void) => {
    onClose();
    // The picker is a separate view controller: on iOS, presenting it while
    // this modal is still on screen silently does nothing, so let the dismiss
    // animation finish first.
    // ponytail: a fixed delay rather than tracking Modal's onDismiss — swap to
    // that if the animation duration ever stops matching.
    if (Platform.OS === 'ios') {
      setTimeout(action, 350);
    } else {
      action();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.dismiss')}>
        {/* Swallows taps on the sheet itself so they don't close it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          <View style={styles.optionRow}>
            <SourceTile icon="camera" label={t('photoSource.camera')} onPress={() => choose(onCamera)} />
            <SourceTile icon="images" label={t('photoSource.photos')} onPress={() => choose(onLibrary)} />
          </View>

          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SourceTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceBorder,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surfaceElevated,
  },
  tilePressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  tileLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  cancelLabel: {
    ...typography.buttonLabel,
    color: colors.textSecondary,
  },
});
