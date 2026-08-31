import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  starCount?: number;
  disabled?: boolean;
}

/**
 * A tappable 1–N star picker — the write counterpart to the read-only
 * `StarRating` display component. Each star sets the rating to its own
 * position (tapping the 3rd star sets `value` to 3), matching the standard
 * star-rating-input convention.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 32,
  starCount = 5,
  disabled = false,
}: StarRatingInputProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: starCount }, (_, index) => {
        const filled = value >= index + 1;
        return (
          <Pressable
            key={index}
            onPress={() => onChange(index + 1)}
            disabled={disabled}
            hitSlop={6}
            style={styles.star}
          >
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={disabled ? colors.textMuted : colors.primary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  star: {},
});