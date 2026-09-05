import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { useTranslation } from '../i18n';

export interface ScreenHeaderProps {
  /** Omit on screens that already print their own heading in the body. */
  title?: string;
  /**
   * Omit and no arrow is rendered — which is what a tab root wants. Callers
   * should pass `navigation.canGoBack() ? () => navigation.goBack() : undefined`
   * rather than wiring it unconditionally: a screen can be the only route in
   * its stack, and `goBack()` there is a silent no-op that looks like a broken
   * button.
   */
  onBack?: () => void;
}

/** The back-arrow + title strip used at the top of pushed screens. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  const { t } = useTranslation();

  if (!onBack && !title) return null;

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
      ) : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flexShrink: 1,
  },
});
