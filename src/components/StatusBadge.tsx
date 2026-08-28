import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { ListingStatus } from '../types';

const STATUS_CONFIG: Record<ListingStatus, { label: string; fg: string; bg: string }> = {
  available: { label: 'Available', fg: colors.statusAvailable, bg: colors.statusAvailableBg },
  booked: { label: 'Booked', fg: colors.statusBooked, bg: colors.statusBookedBg },
  in_progress: { label: 'In Progress', fg: colors.statusInProgress, bg: colors.statusInProgressBg },
  completed: { label: 'Completed', fg: colors.statusCompleted, bg: colors.statusCompletedBg },
};

export interface StatusBadgeProps {
  status: ListingStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.fg }]} />
      <Text style={[styles.label, { color: config.fg }]}>{config.label}</Text>
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xxs,
  },
  label: {
    ...typography.caption,
  },
});
