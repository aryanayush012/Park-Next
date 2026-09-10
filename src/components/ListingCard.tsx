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
}: ListingCardProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, elevation.card, pressed && styles.cardPressed]}
    >
      <View style={styles.photoWrap}>
        <View style={[styles.mediaFrame, dimmed && styles.dimmed]}>
          <Image source={{ uri: photoUrl }} style={styles.photo} />
          <View style={styles.statusOverlay}>
            <StatusBadge status={status} variant="onPhoto" />
          </View>
        </View>
        {topRightAction ? (
          <View style={styles.topRightOverlay}>{topRightAction}</View>
        ) : null}
      </View>
      <View style={styles.content}>
        <View style={dimmed && styles.dimmed}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {t('card.distanceAddress', { km: distanceKm.toFixed(1), address })}
            </Text>
          </View>
          {note ? <Text style={styles.note}>{note}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {currency}
              {pricePerHour}
              <Text style={styles.priceUnit}>{t('card.perHour')}</Text>
            </Text>
            <StarRating rating={rating} ratingCount={ratingCount} />
          </View>
        </View>
        {amenities.length > 0 || bottomRightAction ? (
          <View style={styles.footerRow}>
            <View style={[styles.amenityRow, dimmed && styles.dimmed]}>
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
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cardPressed: {
    opacity: 0.9,
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
