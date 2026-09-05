import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BookingCard } from '../../components/BookingCard';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useTranslation } from '../../i18n';
import { colors, spacing, typography } from '../../theme';
import { RenterBookingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { openDirectionsInMaps } from '../../utils/maps';
import { useAuth } from '../../navigation/AuthContext';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { bookingStatusToBadgeStatus, formatTimeRangeShort } from '../../utils/format';
import { Booking, Listing } from '../../types';

type Props = NativeStackScreenProps<RenterBookingsStackParamList, 'MyBookings'>;

interface JoinedBooking {
  booking: Booking;
  listing: Listing;
  /** The host's number, for the card's call button. Undefined until the
   * owner has accepted — a pending request reveals no contact details. */
  hostPhone?: string;
}

type Tab = 'upcoming' | 'past';

export function MyBookingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [items, setItems] = useState<JoinedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const bookings = await dataSource.getBookingsForUser(userId);
    const joined = await Promise.all(
      bookings.map(async (booking) => {
        const listing = await dataSource.getListingById(booking.listingId);
        if (!listing) return null;
        // Contact details are only revealed once a request is accepted —
        // the same rule the Booking Confirmation screen applies.
        const revealHost = booking.status !== 'pending';
        const host = revealHost ? await dataSource.getPublicProfile(listing.ownerId) : null;
        const joinedBooking: JoinedBooking = {
          booking,
          listing,
          hostPhone: host?.phone || undefined,
        };
        return joinedBooking;
      })
    );
    setItems(joined.filter((item): item is JoinedBooking => item !== null));
    setIsLoading(false);
  }, [userId]);

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

  // Once Supabase is connected, a status change made from the provider
  // side (accept/decline, arrival confirmed) on a different device shows
  // up here live instead of waiting for this screen to regain focus — a
  // no-op in mock mode. See `src/hooks/useRealtimeTable.ts`.
  useRealtimeTable('bookings', load);

  const upcoming = items.filter(
    ({ booking }) =>
      booking.status === 'pending' || booking.status === 'booked' || booking.status === 'in_progress'
  );
  const past = items.filter(
    ({ booking }) =>
      booking.status === 'completed' ||
      booking.status === 'cancelled' ||
      booking.status === 'declined' ||
      booking.status === 'expired'
  );
  const visible = tab === 'upcoming' ? upcoming : past;

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleNavigate = async ({ listing }: JoinedBooking) => {
    const opened = await openDirectionsInMaps({
      latitude: listing.latitude,
      longitude: listing.longitude,
    });
    if (!opened) Alert.alert(t('bookings.mapsFailedTitle'), t('bookings.mapsFailedBody'));
  };

  const handlePress = ({ booking }: JoinedBooking) => {
    if (tab === 'upcoming') {
      // `booked` (accepted, not yet checked in) and `in_progress` both belong
      // on Active Booking — that's the screen that actually shows the
      // arrival code / live countdown and the rest of the booking's detail.
      // Only a still-`pending` request has nothing to show there yet, so it
      // goes to Booking Confirmation's waiting-for-approval state instead.
      if (booking.status === 'booked' || booking.status === 'in_progress') {
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
        <Text style={styles.title}>{t('bookings.title')}</Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            { value: 'upcoming', label: t('bookings.upcoming') },
            { value: 'past', label: t('bookings.past') },
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
          <View style={styles.cardWrap}>
            <BookingCard
              title={item.listing.title}
              status={bookingStatusToBadgeStatus(item.booking.status)}
              rating={item.listing.rating}
              ratingCount={item.listing.ratingCount}
              cost={`${item.listing.currency}${item.booking.totalPrice}`}
              timeRange={formatTimeRangeShort(item.booking.startTime, item.booking.endTime)}
              // Only worth showing while it can still be used to get in.
              arrivalCode={
                item.booking.status === 'booked' ? item.booking.verificationCode : undefined
              }
              onCall={item.hostPhone ? () => handleCall(item.hostPhone as string) : undefined}
              onNavigate={() => handleNavigate(item)}
              onPress={() => handlePress(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.emptyText}>
              {tab === 'upcoming'
                ? t('bookings.noUpcoming')
                : t('bookings.noPast')}
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
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});