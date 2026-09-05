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
  onPress,
  topRightAction,
  bottomRightAction,
}: ListingCardProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, elevation.card, pressed && styles.cardPressed]}
    >
      <View style={styles.photoWrap}>
        <Image source={{ uri: photoUrl }} style={styles.photo} />
        <View style={styles.statusOverlay}>
          <StatusBadge status={status} />
        </View>
        {topRightAction ? (
          <View style={styles.topRightOverlay}>{topRightAction}</View>
        ) : null}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {t('card.distanceAddress', { km: distanceKm.toFixed(1), address })}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {currency}
            {pricePerHour}
            <Text style={styles.priceUnit}>{t('card.perHour')}</Text>
          </Text>
          <StarRating rating={rating} ratingCount={ratingCount} />
        </View>
        {amenities.length > 0 || bottomRightAction ? (
          <View style={styles.footerRow}>
            <View style={styles.amenityRow}>
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
