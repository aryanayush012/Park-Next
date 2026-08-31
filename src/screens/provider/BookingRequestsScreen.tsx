import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderBookingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { useAuth } from '../../navigation/AuthContext';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { expireIfOverdue } from '../../utils/bookingRequest';
import { notifyNewBookingRequest } from '../../utils/notifications';
import { formatDateTimeRange, formatRecurringSchedule, formatRelativeDate } from '../../utils/format';
import { Booking, BookingType, Listing, RenterProfile } from '../../types';

type Props = NativeStackScreenProps<ProviderBookingsStackParamList, 'BookingRequests'>;

interface JoinedBooking {
  booking: Booking;
  listing: Listing;
  renter: RenterProfile;
}

type Tab = 'requests' | 'history';

const TYPE_LABEL: Record<BookingType, string> = {
  instant: 'Instant Booking',
  advance: 'Advance Booking',
  recurring: 'Recurring',
};

const TYPE_COLOR: Record<BookingType, { fg: string; bg: string }> = {
  instant: { fg: colors.info, bg: colors.infoMuted },
  advance: { fg: colors.secondary, bg: colors.secondaryMuted },
  recurring: { fg: colors.primary, bg: colors.primaryMuted },
};

// How often to re-check pending requests while this screen is open — both
// to lazily expire an overdue one (see utils/bookingRequest.ts) and to keep
// the "Respond within Xm" countdown roughly current. Realtime (once
// Supabase is connected) still delivers a genuinely new request from
// another device faster than this; this poll is what covers mock mode (no
// realtime at all) and the pure time-passing case realtime can't push an
// event for on its own.
const REQUESTS_POLL_MS = 30000;

/** "Respond within 8 min" / "Respond within 2h 15m" countdown label. */
function formatTimeLeftLabel(deadlineIso: string, now: number): string {
  const msLeft = new Date(deadlineIso).getTime() - now;
  if (msLeft <= 0) return 'Expiring…';
  const minutes = Math.ceil(msLeft / 60000);
  if (minutes < 60) return `Respond within ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `Respond within ${hours}h ${remainingMinutes}m`;
}

export function BookingRequestsScreen({ navigation }: Props) {
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>('requests');
  const [all, setAll] = useState<JoinedBooking[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Tracks which requests were already `pending` as of the last load, so a
  // brand-new one can be told apart from ones that were already sitting
  // there — only the former should fire a notification. `null` until the
  // first load completes, so the very first batch (however many sample/
  // already-existing requests there are) never notifies on mount.
  const previousPendingIdsRef = useRef<Set<string> | null>(null);

  // One fetch covering every one of the owner's bookings — the Requests and
  // History tabs below both just filter/sort this same list client-side,
  // rather than each tab making its own round trip.
  const load = useCallback(async () => {
    const bookings = await dataSource.getBookingsForOwner(userId);
    const joined = await Promise.all(
      bookings.map(async (booking) => {
        const listing = await dataSource.getListingById(booking.listingId);
        const renter = await dataSource.getPublicProfile(booking.renterId);
        return listing && renter ? { booking, listing, renter } : null;
      })
    );
    const validItems = joined.filter((item): item is JoinedBooking => item !== null);

    // Lazily expire any request whose response window has passed — see
    // `expireIfOverdue`'s own comment for why this has to happen wherever a
    // screen happens to notice, rather than on a server-side schedule.
    const settled = await Promise.all(
      validItems.map(async (item) =>
        item.booking.status === 'pending'
          ? { ...item, booking: await expireIfOverdue(item.booking) }
          : item
      )
    );

    const currentPendingIds = new Set(
      settled.filter((item) => item.booking.status === 'pending').map((item) => item.booking.id)
    );
    if (previousPendingIdsRef.current) {
      const newlyPending = settled.filter(
        (item) =>
          item.booking.status === 'pending' && !previousPendingIdsRef.current!.has(item.booking.id)
      );
      newlyPending.forEach((item) => {
        notifyNewBookingRequest(item.listing.title).catch(() => {});
      });
    }
    previousPendingIdsRef.current = currentPendingIds;

    setAll(settled);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Once Supabase is connected, a brand-new booking request created by a
  // renter on a different device — or a booking completing elsewhere —
  // appears here live instead of waiting for this screen to regain focus —
  // a no-op in mock mode. See `src/hooks/useRealtimeTable.ts`.
  useRealtimeTable('bookings', load);

  // Periodic refresh so an overdue request expires (and its countdown
  // updates) even if nothing external ever pushes a change — see the
  // module-level comment on REQUESTS_POLL_MS.
  useEffect(() => {
    const poll = setInterval(() => {
      setNow(Date.now());
      load();
    }, REQUESTS_POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  const requests = all.filter(({ booking }) => booking.status === 'pending');
  const history = [...all]
    .filter(({ booking }) => booking.status === 'completed')
    .sort((a, b) => new Date(b.booking.startTime).getTime() - new Date(a.booking.startTime).getTime());

  const respond = async (bookingId: string, accept: boolean) => {
    setRespondingId(bookingId);
    try {
      const updated = await dataSource.respondToBookingRequest(bookingId, accept);
      setAll((prev) =>
        prev.map((item) => (item.booking.id === bookingId ? { ...item, booking: updated } : item))
      );
    } catch (error) {
      Alert.alert(
        'Could not respond',
        error instanceof Error
          ? error.message
          : 'This request may have already expired or been withdrawn. Refreshing the list.'
      );
      load();
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Booking Requests</Text>
        <Text style={styles.subtitle}>
          {tab === 'requests' ? `${requests.length} pending requests` : `${history.length} completed`}
        </Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          options={[
            { value: 'requests', label: 'Requests' },
            { value: 'history', label: 'History' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={({ booking }) => booking.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const typeColor = TYPE_COLOR[item.booking.type];
            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  navigation.navigate('BookingDetailOwner', { bookingId: item.booking.id })
                }
              >
                <View style={styles.cardTop}>
                  <View style={styles.renterRow}>
                    <Text style={styles.renterName}>{item.renter.name}</Text>
                    <Ionicons name="star" size={13} color={colors.primary} />
                    <Text style={styles.renterRating}>{item.renter.rating.toFixed(1)}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: typeColor.fg }]}>
                      {TYPE_LABEL[item.booking.type]}
                    </Text>
                  </View>
                </View>

                <Text style={styles.listingTitle}>{item.listing.title}</Text>

                <Text style={styles.scheduleText}>
                  {item.booking.recurring
                    ? `${formatRecurringSchedule(
                        item.booking.recurring.days,
                        item.booking.recurring.startTime,
                        item.booking.recurring.endTime
                      )} · Starts ${formatRelativeDate(item.booking.startTime)}`
                    : formatDateTimeRange(item.booking.startTime, item.booking.endTime)}
                </Text>

                <View style={styles.deadlineRow}>
                  <Ionicons name="time-outline" size={13} color={colors.secondary} />
                  <Text style={styles.deadlineText}>
                    {formatTimeLeftLabel(item.booking.responseDeadline, now)}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    label="Decline"
                    variant="secondary"
                    onPress={() => respond(item.booking.id, false)}
                    loading={respondingId === item.booking.id}
                    style={styles.actionButton}
                  />
                  <Button
                    label="Accept"
                    onPress={() => respond(item.booking.id, true)}
                    loading={respondingId === item.booking.id}
                    style={styles.actionButton}
                  />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No pending requests right now.</Text>
          }
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={({ booking }) => booking.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('BookingDetailOwner', { bookingId: item.booking.id })
              }
            >
              <View style={styles.cardTop}>
                <View style={styles.renterRow}>
                  <Text style={styles.renterName}>{item.renter.name}</Text>
                  <Ionicons name="star" size={13} color={colors.primary} />
                  <Text style={styles.renterRating}>{item.renter.rating.toFixed(1)}</Text>
                </View>
                <Text style={styles.historyAmount}>
                  {item.listing.currency}
                  {item.booking.totalPrice}
                </Text>
              </View>

              <Text style={styles.listingTitle}>{item.listing.title}</Text>

              <Text style={styles.scheduleText}>
                {formatDateTimeRange(item.booking.startTime, item.booking.endTime)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Completed bookings on your listings will show up here — tap one to rate the renter.
            </Text>
          }
        />
      )}
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
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  segmentWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  renterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  renterName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginRight: 2,
  },
  renterRating: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  typeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  typeBadgeText: {
    ...typography.caption,
  },
  historyAmount: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  listingTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  scheduleText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },
  deadlineText: {
    ...typography.caption,
    color: colors.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});