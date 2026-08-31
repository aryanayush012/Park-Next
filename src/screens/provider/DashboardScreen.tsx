import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderTabParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { useAuth } from '../../navigation/AuthContext';
import { useUserProfile } from '../../navigation/UserProfileContext';
import { bookingStatusToBadgeStatus, formatDateTimeRange, formatRecurringSchedule, isSameDay } from '../../utils/format';
import { Booking, Listing } from '../../types';

type Props = BottomTabScreenProps<ProviderTabParamList, 'Home'>;

interface JoinedBooking {
  booking: Booking;
  listing: Listing;
}

export function DashboardScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const { name } = useUserProfile();
  const [listings, setListings] = useState<Listing[]>([]);
  const [upcoming, setUpcoming] = useState<JoinedBooking[]>([]);
  const [todaysCount, setTodaysCount] = useState(0);

  const load = useCallback(async () => {
    const ownListings = await dataSource.getListingsByOwner(userId);
    setListings(ownListings);

    const listingById = new Map(ownListings.map((listing) => [listing.id, listing]));
    const bookings = await dataSource.getBookingsForOwner(userId);
    const confirmed = bookings.filter((b) => b.status === 'booked' || b.status === 'in_progress');

    const joined: JoinedBooking[] = confirmed
      .map((booking) => {
        const listing = listingById.get(booking.listingId);
        return listing ? { booking, listing } : null;
      })
      .filter((item): item is JoinedBooking => item !== null);

    setUpcoming(joined.slice(0, 3));
    setTodaysCount(
      confirmed.filter((b) => isSameDay(new Date(b.startTime), new Date())).length
    );
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const activeListingsCount = listings.filter((listing) => listing.isActive).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>Hi, {name.split(' ')[0]} 👋</Text>
        <Text style={styles.subtitle}>Manage your parking spots</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeListingsCount}</Text>
            <Text style={styles.statLabel}>Active Listings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, styles.statValueSecondary]}>{todaysCount}</Text>
            <Text style={styles.statLabel}>Today's Bookings</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
          <Pressable onPress={() => navigation.navigate('Bookings', { screen: 'BookingRequests' })}>
            <Text style={styles.viewAll}>View All</Text>
          </Pressable>
        </View>

        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming bookings on your listings yet.</Text>
        ) : (
          upcoming.map(({ booking, listing }) => (
            <Pressable
              key={booking.id}
              style={styles.bookingCard}
              onPress={() =>
                navigation.navigate('Bookings', {
                  screen: 'BookingDetailOwner',
                  params: { bookingId: booking.id },
                })
              }
            >
              <View style={styles.bookingCardTop}>
                <Text style={styles.bookingTitle}>{listing.title}</Text>
                <StatusBadge status={bookingStatusToBadgeStatus(booking.status)} />
              </View>
              <Text style={styles.bookingAddress}>{listing.address.split(',').slice(0, 2).join(',')}</Text>
              <Text style={styles.bookingSchedule}>
                {booking.recurring
                  ? `${formatRecurringSchedule(booking.recurring.days, booking.recurring.startTime, booking.recurring.endTime)} (Recurring)`
                  : formatDateTimeRange(booking.startTime, booking.endTime)}
              </Text>
            </Pressable>
          ))
        )}

        <View style={{ height: spacing.lg }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="+ Add Listing"
          onPress={() => navigation.navigate('Listings', { screen: 'AddListingDetails', params: {} })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  statValue: {
    ...typography.display,
    fontSize: 28,
    color: colors.primary,
    marginBottom: spacing.xxs,
  },
  statValueSecondary: {
    color: colors.secondary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  viewAll: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bookingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxs,
  },
  bookingTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  bookingAddress: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xxs,
  },
  bookingSchedule: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
});