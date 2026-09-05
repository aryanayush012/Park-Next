import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { Language, LANGUAGES, useTranslation } from '../i18n';

export interface LanguageSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom drawer for picking the app language.
 *
 * Driven entirely by `LANGUAGES` in `src/i18n`, so adding a third language is
 * a dictionary file plus one entry in that array — nothing here changes. It
 * scrolls, and caps its own height, so a long list behaves on a small screen.
 */
export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const { t, language, setLanguage } = useTranslation();

  const choose = (next: Language) => {
    setLanguage(next);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.dismiss')}>
        {/* Swallows taps on the sheet so they don't close it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{t('profile.language')}</Text>

          <ScrollView style={styles.list} bounces={false}>
            {LANGUAGES.map((option) => {
              const isActive = option.value === language;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <Text style={[styles.label, isActive && styles.labelActive]}>{option.label}</Text>
                  {isActive ? (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
    marginBottom: spacing.xs,
  },
  list: {
    // Keeps a long language list from pushing the sheet off-screen.
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  label: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  labelActive: {
    color: colors.textPrimary,
  },
});
