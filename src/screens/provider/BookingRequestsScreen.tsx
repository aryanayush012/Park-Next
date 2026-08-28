import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderBookingsStackParamList } from '../../navigation/types';
import { dataSource, CURRENT_USER_ID } from '../../data/dataSource';
import { MOCK_RENTERS } from '../../data/mockData';
import { formatDateTimeRange, formatRecurringSchedule, formatRelativeDate } from '../../utils/format';
import { Booking, BookingType, Listing, RenterProfile } from '../../types';

type Props = NativeStackScreenProps<ProviderBookingsStackParamList, 'BookingRequests'>;

interface JoinedRequest {
  booking: Booking;
  listing: Listing;
  renter: RenterProfile;
}

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

export function BookingRequestsScreen({ navigation }: Props) {
  const [requests, setRequests] = useState<JoinedRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pending = await dataSource.getBookingRequestsForOwner(CURRENT_USER_ID);
    const joined = await Promise.all(
      pending.map(async (booking) => {
        const listing = await dataSource.getListingById(booking.listingId);
        const renter = MOCK_RENTERS[booking.renterId];
        return listing && renter ? { booking, listing, renter } : null;
      })
    );
    setRequests(joined.filter((item): item is JoinedRequest => item !== null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const respond = async (bookingId: string, accept: boolean) => {
    setRespondingId(bookingId);
    await dataSource.respondToBookingRequest(bookingId, accept);
    setRequests((prev) => prev.filter((item) => item.booking.id !== bookingId));
    setRespondingId(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Booking Requests</Text>
        <Text style={styles.subtitle}>{requests.length} pending requests</Text>
      </View>

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
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
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
  listingTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  scheduleText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
