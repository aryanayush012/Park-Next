import React from 'react';
import { GestureResponderEvent, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing, typography } from '../theme';
import { Amenity, ListingStatus } from '../types';
import { AmenityBadge } from './AmenityBadge';
import { useTranslation } from '../i18n';
import { StarRating } from './StarRating';
import { StatusBadge } from './StatusBadge';

export interface ListingCardProps {
  title: string;
  photoUrl: string;
  distanceKm: number;
  address: string;
  pricePerHour: number;
  currency?: string;
  rating: number;
  ratingCount: number;
  status: ListingStatus;
  amenities: Amenity[];
  /**
   * A short line under the address — used to say a spot only covers part
   * of the requested window, so a shortened booking is visible while
   * choosing rather than discovered at checkout.
   */
  note?: string;
  onPress?: (event: GestureResponderEvent) => void;
  /**
   * Rendered over the photo's top-right corner, opposite the status badge —
   * an owner's delete button, for instance. Omitted on the renter's screens.
   */
  topRightAction?: React.ReactNode;
  /**
   * Rendered at the end of the bottom row, after the amenity badges. Shares
   * that row rather than floating over it, so it can never sit on top of a
   * badge on a narrow screen.
   */
  bottomRightAction?: React.ReactNode;
  /**
   * Fades the photo, status badge and text — but never `topRightAction` /
   * `bottomRightAction` — to signal "off the market" without a real blur.
   * Opacity composites down the whole view tree, so keeping the action
   * buttons at full strength means they must render as siblings of the
   * dimmed views rather than inside them; giving a button its own
   * `opacity: 1` can't undo a parent's.
   */
  dimmed?: boolean;
  /**
   * An active booking covers this exact instant — an instant book would be
   * rejected server-side (the `bookings_no_overlap` exclusion constraint).
   * Dims the card the same way `dimmed` does and swaps the status badge to
   * "Occupied" regardless of `status`. Disables the card's own `onPress`
   * too — a dimmed area that still responds to a tap is confusing regardless
   * of what it happens to do — so the only remaining live action is
   * `onScheduleInstead` below.
   */
  occupied?: boolean;
  /**
   * The one thing that's still clickable on an `occupied` card: a full-
   * opacity row (rendered from `note`) offering to schedule ahead instead.
   * Ignored unless `occupied` is set.
   */
  onScheduleInstead?: () => void;
}

export function ListingCard({
  title,
  photoUrl,
  distanceKm,
  address,
  pricePerHour,
  currency = '₹',
  rating,
  ratingCount,
  status,
  amenities,
  note,
  onPress,
  topRightAction,
  bottomRightAction,
  dimmed,
  occupied,
  onScheduleInstead,
}: ListingCardProps) {
  const { t } = useTranslation();
  const isDimmed = dimmed || occupied;

  return (
    <Pressable
      onPress={onPress}
      disabled={occupied}
      style={({ pressed }) => [
        styles.card,
        elevation.card,
        pressed && !occupied && styles.cardPressed,
      ]}
    >
      <View style={styles.photoWrap}>
        <View style={[styles.mediaFrame, isDimmed && styles.dimmed]}>
          <Image source={{ uri: photoUrl }} style={styles.photo} />
          <View style={styles.statusOverlay}>
            <StatusBadge status={occupied ? 'occupied' : status} variant="onPhoto" />
          </View>
        </View>
        {topRightAction ? (
          <View style={styles.topRightOverlay}>{topRightAction}</View>
        ) : null}
      </View>
      <View style={styles.content}>
        <View style={isDimmed && styles.dimmed}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {t('card.distanceAddress', { km: distanceKm.toFixed(1), address })}
            </Text>
          </View>
          {note && !occupied ? <Text style={styles.note}>{note}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {currency}
              {pricePerHour}
              <Text style={styles.priceUnit}>{t('card.perHour')}</Text>
            </Text>
            <StarRating rating={rating} ratingCount={ratingCount} />
          </View>
        </View>
        {occupied && note ? (
          <Pressable
            onPress={onScheduleInstead}
            hitSlop={8}
            style={({ pressed }) => [
              styles.scheduleRow,
              pressed && styles.scheduleRowPressed,
            ]}
          >
            <Text style={styles.scheduleText} numberOfLines={2}>
              {note}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        ) : null}
        {amenities.length > 0 || bottomRightAction ? (
          <View style={styles.footerRow}>
            <View style={[styles.amenityRow, isDimmed && styles.dimmed]}>
              {amenities.slice(0, 2).map((amenity) => (
                <AmenityBadge
                  key={amenity.key}
                  icon={amenity.icon as any}
                  label={t(`amenity.${amenity.key}`)}
                />
              ))}
            </View>
            {bottomRightAction}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...elevation.card,
  },
  cardPressed: {
    // The card lifts toward the light rather than shrinking away from the
    // finger. A scale-down reads as the card retreating, and an amber border
    // reads as "selected" or "invalid" — neither of which a tap means. Moving
    // the surface one step up the elevation ramp is the same signal every
    // other pressable in the app gives, and it costs no geometry change.
    backgroundColor: colors.surfaceElevated,
  },
  photoWrap: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surfaceElevated,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  // Fills `photoWrap` (which sets the explicit height) so wrapping it for
  // the dimmed-opacity treatment doesn't change the photo's size.
  mediaFrame: {
    flex: 1,
  },
  dimmed: {
    opacity: 0.5,
  },
  statusOverlay: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  topRightOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  content: {
    padding: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 4,
    flexShrink: 1,
  },
  note: {
    ...typography.caption,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  // Full opacity and its own Pressable, deliberately outside the dimmed
  // wrapper above — the one thing on an `occupied` card that still works,
  // so it needs to look like it does (a dimmed row that secretly still
  // responded to a tap was the whole problem this replaced).
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginBottom: spacing.xs,
  },
  scheduleRowPressed: {
    opacity: 0.6,
  },
  scheduleText: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  price: {
    ...typography.h3,
    color: colors.primary,
  },
  priceUnit: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  amenityRow: {
    flexDirection: 'row',
    gap: spacing.xxs,
    flexShrink: 1,
  },
});
