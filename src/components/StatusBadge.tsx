import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { ListingStatus } from '../types';
import { TranslationKey, useTranslation } from '../i18n';

const STATUS_CONFIG: Record<ListingStatus, { labelKey: TranslationKey; fg: string; bg: string }> = {
  available: { labelKey: 'status.available', fg: colors.statusAvailable, bg: colors.statusAvailableBg },
  booked: { labelKey: 'status.booked', fg: colors.statusBooked, bg: colors.statusBookedBg },
  in_progress: { labelKey: 'status.in_progress', fg: colors.statusInProgress, bg: colors.statusInProgressBg },
  completed: { labelKey: 'status.completed', fg: colors.statusCompleted, bg: colors.statusCompletedBg },
};

export interface StatusBadgeProps {
  status: ListingStatus;
  /**
   * `compact` trims the padding and dot for places where the badge is a
   * marginal note rather than the headline — the top corner of a booking
   * card, say. Defaults to the full size every other screen uses.
   */
  size?: 'default' | 'compact';
  /**
   * `onPhoto` swaps the tinted background for a dark glass chip. The default
   * background is a ~14%-opacity tint of the status color, which reads fine
   * against this app's own solid surface color but nearly disappears — tint
   * and text both — over an arbitrary listing photo behind it. `colors.overlay`
   * is the same dark scrim already used for other controls floating on a
   * photo (the delete button on this same card), so status text stays legible
   * over any photo instead of just the ones dark enough to carry a 14% tint.
   */
  variant?: 'default' | 'onPhoto';
}

export function StatusBadge({ status, size = 'default', variant = 'default' }: StatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  const isCompact = size === 'compact';
  const onPhoto = variant === 'onPhoto';

  return (
    <View
      style={[
        styles.badge,
        isCompact && styles.badgeCompact,
        { backgroundColor: onPhoto ? colors.overlay : config.bg },
        onPhoto && styles.badgeGlass,
      ]}
    >
      <View
        style={[styles.dot, isCompact && styles.dotCompact, { backgroundColor: config.fg }]}
      />
      <Text style={[styles.label, isCompact && styles.labelCompact, { color: config.fg }]}>
        {t(config.labelKey)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  badgeCompact: {
    paddingVertical: 1,
    paddingHorizontal: spacing.xxs,
  },
  // A hairline light border on the dark scrim is what reads as "glass"
  // rather than just a plain dark chip.
  badgeGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xxs,
  },
  dotCompact: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 3,
  },
  label: {
    ...typography.caption,
  },
  labelCompact: {
    ...typography.caption,
    fontSize: 10,
    // Devanagari needs the room even at 10pt, so keep this above 1.4.
    lineHeight: 15,
  },
});
