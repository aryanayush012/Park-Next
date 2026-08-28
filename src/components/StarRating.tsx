import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

export interface StarRatingProps {
  rating: number;
  ratingCount?: number;
  size?: number;
  starCount?: number;
}

export function StarRating({ rating, ratingCount, size = 14, starCount = 5 }: StarRatingProps) {
  return (
    <View style={styles.row}>
      <View style={styles.stars}>
        {Array.from({ length: starCount }, (_, index) => {
          const filled = rating >= index + 1;
          const half = !filled && rating > index && rating < index + 1;
          const iconName = filled ? 'star' : half ? 'star-half' : 'star-outline';
          return (
            <Ionicons
              key={index}
              name={iconName}
              size={size}
              color={colors.primary}
              style={styles.star}
            />
          );
        })}
      </View>
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      {ratingCount !== undefined ? (
        <Text style={styles.ratingCount}>({ratingCount})</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: spacing.xxs,
  },
  star: {
    marginRight: 1,
  },
  ratingText: {
    ...typography.bodyMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  ratingCount: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.xxs,
  },
});
