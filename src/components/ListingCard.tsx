import React from 'react';
import { GestureResponderEvent, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing, typography } from '../theme';
import { Amenity, ListingStatus } from '../types';
import { AmenityBadge } from './AmenityBadge';
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
}: ListingCardProps) {
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
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {distanceKm.toFixed(1)} km away · {address}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {currency}
            {pricePerHour}
            <Text style={styles.priceUnit}>/hr</Text>
          </Text>
          <StarRating rating={rating} ratingCount={ratingCount} />
        </View>
        {amenities.length > 0 ? (
          <View style={styles.amenityRow}>
            {amenities.slice(0, 2).map((amenity) => (
              <AmenityBadge key={amenity.key} icon={amenity.icon as any} label={amenity.label} />
            ))}
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
  amenityRow: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
});
