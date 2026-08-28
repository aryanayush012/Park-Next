import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { RenterBookingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import {
  bookingStatusToBadgeStatus,
  formatDateTimeRange,
  formatTimeFromISO,
} from '../../utils/format';
import { Booking, Listing } from '../../types';

type Props = NativeStackScreenProps<RenterBookingsStackParamList, 'BookingDetail'>;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);

  useEffect(() => {
    dataSource.getBookingById(bookingId).then(async (result) => {
      if (!result) return;
      setBooking(result);
      const relatedListing = await dataSource.getListingById(result.listingId);
      if (relatedListing) setListing(relatedListing);
    });
  }, [bookingId]);

  if (!booking || !listing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading booking…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Summary</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: listing.photoUrl }} style={styles.photo} />

        <View style={styles.titleRow}>
          <Text style={styles.title}>{listing.title}</Text>
          <StatusBadge status={bookingStatusToBadgeStatus(booking.status)} />
        </View>
        <Text style={styles.address}>{listing.address}</Text>

        <View style={styles.card}>
          <SummaryRow label="Date & Time" value={formatDateTimeRange(booking.startTime, booking.endTime)} />
          {booking.checkInAt ? (
            <SummaryRow label="Checked in" value={formatTimeFromISO(booking.checkInAt)} />
          ) : null}
          {booking.checkOutAt ? (
            <SummaryRow label="Checked out" value={formatTimeFromISO(booking.checkOutAt)} />
          ) : null}
          <SummaryRow
            label="Pricing"
            value={booking.pricingModel === 'metered' ? 'Metered' : 'Flat rate'}
          />
          <SummaryRow
            label="Amount Paid"
            value={`${listing.currency}${booking.totalPrice}`}
            highlight
          />
        </View>

        <Text style={styles.footnote}>
          Rating & review coming in a later phase — for now this is a read-only summary.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
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
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  address: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  summaryValueHighlight: {
    ...typography.h3,
    color: colors.primary,
  },
  footnote: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
});
