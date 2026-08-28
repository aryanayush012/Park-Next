import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListingCard } from '../../components/ListingCard';
import { SegmentedControl } from '../../components/SegmentedControl';
import { colors, spacing, typography } from '../../theme';
import { RenterBookingsStackParamList } from '../../navigation/types';
import { dataSource, CURRENT_USER_ID } from '../../data/dataSource';
import { AMENITIES } from '../../data/mockData';
import { bookingStatusToBadgeStatus, formatDateTimeRange } from '../../utils/format';
import { Booking, Listing } from '../../types';

type Props = NativeStackScreenProps<RenterBookingsStackParamList, 'MyBookings'>;

interface JoinedBooking {
  booking: Booking;
  listing: Listing;
}

type Tab = 'upcoming' | 'past';

export function MyBookingsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [items, setItems] = useState<JoinedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const bookings = await dataSource.getBookingsForUser(CURRENT_USER_ID);
    const joined = await Promise.all(
      bookings.map(async (booking) => {
        const listing = await dataSource.getListingById(booking.listingId);
        return listing ? { booking, listing } : null;
      })
    );
    setItems(joined.filter((item): item is JoinedBooking => item !== null));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh whenever this screen regains focus, so a booking just created
  // or checked in/out elsewhere in the stack shows up immediately.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const upcoming = items.filter(
    ({ booking }) => booking.status === 'booked' || booking.status === 'in_progress'
  );
  const past = items.filter(
    ({ booking }) => booking.status === 'completed' || booking.status === 'cancelled'
  );
  const visible = tab === 'upcoming' ? upcoming : past;

  const handlePress = ({ booking }: JoinedBooking) => {
    if (tab === 'upcoming') {
      if (booking.status === 'in_progress') {
        navigation.navigate('ActiveBooking', { bookingId: booking.id });
      } else {
        navigation.navigate('BookingConfirmation', { bookingId: booking.id, justBooked: false });
      }
    } else {
      navigation.navigate('BookingDetail', { bookingId: booking.id });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={({ booking }) => booking.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable onPress={() => handlePress(item)} style={styles.cardWrap}>
            <ListingCard
              title={item.listing.title}
              photoUrl={item.listing.photoUrl}
              distanceKm={item.listing.distanceKm}
              address={item.listing.address}
              pricePerHour={item.listing.pricePerHour}
              currency={item.listing.currency}
              rating={item.listing.rating}
              ratingCount={item.listing.ratingCount}
              status={bookingStatusToBadgeStatus(item.booking.status)}
              amenities={item.listing.amenities.map((key) => AMENITIES[key])}
            />
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleText}>
                {formatDateTimeRange(item.booking.startTime, item.booking.endTime)}
              </Text>
              <Text style={styles.scheduleTotal}>
                {item.listing.currency}
                {item.booking.totalPrice}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.emptyText}>
              {tab === 'upcoming'
                ? 'No upcoming bookings yet — go find a spot on the Home tab.'
                : 'No past bookings yet.'}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  segmentWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  scheduleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scheduleTotal: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
