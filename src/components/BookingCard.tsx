import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconActionButton } from './IconActionButton';
import { colors, elevation, radius, spacing, typography } from '../theme';
import { useTranslation } from '../i18n';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';
import { ListingStatus } from '../types';

export interface BookingCardProps {
  title: string;
  status: ListingStatus;
  rating: number;
  ratingCount: number;
  /** Formatted, currency included — the total for this booking, not a rate. */
  cost: string;
  /** Formatted range, e.g. "2:30 – 6:30 PM". */
  timeRange: string;
  /** Only meaningful before arrival; omit and the tile is not rendered. */
  arrivalCode?: string;
  /** Omitted when the host's number isn't available yet (request still pending). */
  onCall?: () => void;
  onNavigate: () => void;
  onPress: () => void;
}

/**
 * A booking, as it appears in the My Bookings list.
 *
 * Deliberately not `ListingCard`: that one sells a spot you haven't booked —
 * photo, distance, address, per-hour rate, amenities. None of that helps once
 * the booking exists. What a person needs at a glance is what they paid, how
 * long they have it, the code that gets them in, and one tap each to ring the
 * host or start driving. Everything else lives on the detail screen behind a
 * tap on the card.
 */
export function BookingCard({
  title,
  status,
  rating,
  ratingCount,
  cost,
  timeRange,
  arrivalCode,
  onCall,
  onNavigate,
  onPress,
}: BookingCardProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, elevation.card, pressed && styles.cardPressed]}
    >
      <StatusBadge status={status} size="compact" />

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.ratingRow}>
            <StarRating rating={rating} ratingCount={ratingCount} />
          </View>
        </View>

        <View style={styles.actions}>
          {onCall ? (
            <IconActionButton
              icon="call"
              onPress={onCall}
              accessibilityLabel={t('common.call')}
            />
          ) : null}
          <IconActionButton
            icon="navigate"
            onPress={onNavigate}
            accessibilityLabel={t('common.navigateMaps')}
          />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.factRow}>
        {arrivalCode ? (
          <Fact label={t('active.arrivalCode')} value={arrivalCode} highlight />
        ) : null}
        <Fact label={t('bookings.cost')} value={cost} />
        <Fact label={t('common.time')} value={timeRange} />
      </View>
    </Pressable>
  );
}

function Fact({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.factValue, highlight && styles.factValueHighlight]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    ...elevation.card,
  },
  cardPressed: {
    // Scale rather than fade: a card that dims reads as disabled, whereas
    // one that dips reads as pressed. Same reason the listing card does it.
    opacity: 1,
    transform: [{ scale: 0.985 }],
    borderColor: colors.primary,
  },
  headerRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  ratingRow: {
    marginTop: spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginVertical: spacing.md,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  fact: {
    // Nothing in this row needs to give way now that the status badge
    // has moved up to the header, so let each value keep its full width.
    flexShrink: 0,
  },
  factLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  factValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    alignSelf: 'center',
  },
  factValueHighlight: {
    ...typography.h3,
    color: colors.primary,
    letterSpacing: 2,
  },
});
