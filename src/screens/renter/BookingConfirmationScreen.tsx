import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { MapView, RouteResolvedInfo } from '../../components/MapView';
import { colors, radius, spacing, typography } from '../../theme';
import { SharedBookingParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { openDirectionsInMaps } from '../../utils/maps';
import { expireIfOverdue, formatResponseDeadline } from '../../utils/bookingRequest';
import {
  estimateDrivingMinutes,
  formatDateTimeRange,
  formatHHmm,
  haversineDistanceKm,
  WEEKDAY_LABELS,
} from '../../utils/format';
import { Booking, Listing, RenterProfile } from '../../types';

type Props = NativeStackScreenProps<SharedBookingParamList, 'BookingConfirmation'>;

// How often to re-check a still-`pending` request while waiting for the
// owner's Accept/Decline — cheap enough to poll, and this is also what
// notices a response window that's simply run out (see
// `utils/bookingRequest.ts`'s `expireIfOverdue`), not just an owner action.
const PENDING_POLL_MS = 5000;

export function BookingConfirmationScreen({ navigation, route }: Props) {
  const { bookingId, justBooked = false } = route.params;
  const { location: currentLocation } = useCurrentLocation();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [host, setHost] = useState<RenterProfile | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResolvedInfo | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    dataSource.getBookingById(bookingId).then(async (result) => {
      if (!result) return;
      setBooking(result);
      const relatedListing = await dataSource.getListingById(result.listingId);
      if (relatedListing) setListing(relatedListing);
    });
  }, [bookingId]);

  // Host contact info is only revealed once the owner has actually accepted
  // — while the request is still `pending`, showing their phone number
  // would be premature (and once declined/expired, pointless).
  useEffect(() => {
    if (!booking || !listing || booking.status === 'pending') return;
    dataSource.getPublicProfile(listing.ownerId).then((result) => setHost(result ?? null));
  }, [booking?.status, listing?.ownerId]);

  const refetchBooking = useCallback(async () => {
    const latest = await dataSource.getBookingById(bookingId);
    if (!latest) return;
    // Lazily flip an overdue request to `expired` the moment this screen —
    // the renter's own — notices, in case the owner's device never does.
    const settled = await expireIfOverdue(latest);
    setBooking(settled);
  }, [bookingId]);

  // While waiting on the owner, poll for a status change and re-check the
  // response deadline. Once Supabase is connected, the owner's Accept/
  // Decline on their own device also arrives near-instantly via the
  // realtime subscription below — the poll stays as the fallback (and is
  // the only mechanism at all in mock mode) and as what actually notices
  // pure time passing, which no realtime event fires for on its own.
  useEffect(() => {
    if (booking?.status !== 'pending') return;
    const poll = setInterval(refetchBooking, PENDING_POLL_MS);
    return () => clearInterval(poll);
  }, [booking?.status, refetchBooking]);

  useRealtimeTable('bookings', refetchBooking, `id=eq.${bookingId}`);

  const handleCancelRequest = async () => {
    setIsCancelling(true);
    try {
      const updated = await dataSource.cancelBooking(bookingId);
      setBooking(updated);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleBrowseOtherSpots = () => {
    navigation.popToTop();
  };

  const straightLineKm = useMemo(() => {
    if (!listing) return 0;
    return haversineDistanceKm(currentLocation, listing);
  }, [currentLocation, listing]);

  // Memoized so <MapView route={...}> gets the same object reference across
  // re-renders as long as the actual origin/destination haven't changed —
  // otherwise every render (including the ones `onRouteResolved` itself
  // triggers via `setRouteInfo`) would hand MapView a brand-new object, which
  // was causing it to redraw/re-fit the route on a loop (see MapView.tsx).
  const directionsRoute = useMemo(() => {
    if (!listing) return null;
    return {
      origin: currentLocation,
      destination: {
        latitude: listing.latitude,
        longitude: listing.longitude,
        label: `${listing.currency}${listing.pricePerHour}`,
      },
    };
  }, [currentLocation, listing]);

  if (!booking || !listing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading booking…</Text>
      </SafeAreaView>
    );
  }

  if (booking.status === 'pending') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.pendingContent}>
          <ActivityIndicator color={colors.secondary} size="large" />
          <Text style={styles.pendingTitle}>Waiting for host approval</Text>
          <Text style={styles.pendingSubtitle}>
            Your request has been sent to the host. They've been notified and have{' '}
            {formatResponseDeadline(booking.responseDeadline)} to respond — we'll take you
            straight to your booking the moment they accept.
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.spotTitle}>{listing.title}</Text>
            {booking.recurring ? (
              <SummaryRow
                label="Time"
                value={`${formatHHmm(booking.recurring.startTime)} – ${formatHHmm(
                  booking.recurring.endTime
                )}`}
              />
            ) : (
              <SummaryRow
                label="Date & Time"
                value={formatDateTimeRange(booking.startTime, booking.endTime)}
              />
            )}
            <SummaryRow
              label={booking.pricingModel === 'metered' ? 'Estimated Total' : 'Total Price'}
              value={`${listing.currency}${booking.totalPrice}`}
              highlight
            />
          </View>
        </View>

        <View style={styles.bottomPanel}>
          <Button
            label="Cancel Request"
            variant="secondary"
            onPress={handleCancelRequest}
            loading={isCancelling}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (booking.status === 'declined' || booking.status === 'expired' || booking.status === 'cancelled') {
    const isCancelledByMe = booking.status === 'cancelled';
    const isDeclined = booking.status === 'declined';
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.pendingContent}>
          <View style={styles.declinedIconWrap}>
            <Ionicons name="close" size={26} color={colors.error} />
          </View>
          <Text style={styles.pendingTitle}>
            {isCancelledByMe
              ? 'Request cancelled'
              : isDeclined
              ? 'Request declined'
              : "Host didn't respond in time"}
          </Text>
          <Text style={styles.pendingSubtitle}>
            {isCancelledByMe
              ? `You cancelled your request for ${listing.title}.`
              : isDeclined
              ? `The host isn't able to accept your request for ${listing.title}. You haven't been charged — try another spot.`
              : `The host for ${listing.title} didn't respond to your request in time. You haven't been charged — try another spot.`}
          </Text>
        </View>

        <View style={styles.bottomPanel}>
          <Button label="Browse Other Spots" onPress={handleBrowseOtherSpots} />
        </View>
      </SafeAreaView>
    );
  }

  const distanceKm = routeInfo?.distanceMeters ? routeInfo.distanceMeters / 1000 : straightLineKm;
  const durationMinutes = routeInfo?.durationSeconds
    ? Math.round(routeInfo.durationSeconds / 60)
    : estimateDrivingMinutes(straightLineKm);
  const roadName = listing.address.split(',')[0];

  // Always the same single action, regardless of whether the booking starts
  // today or later — the Active Booking screen itself handles "you're early,
  // here's your arrival code" vs. "you're checked in" states, so there's no
  // need to branch into a different label/action here.
  const handlePrimaryAction = () => {
    navigation.replace('ActiveBooking', { bookingId: booking.id });
  };

  const handleNavigate = () => {
    openDirectionsInMaps({ latitude: listing.latitude, longitude: listing.longitude });
  };

  const handleContactHost = () => {
    if (host?.phone) {
      Linking.openURL(`tel:${host.phone}`).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {justBooked ? (
          <View style={styles.confirmHeader}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={28} color={colors.textOnSecondary} />
            </View>
            <Text style={styles.confirmTitle}>Booking Confirmed!</Text>
          </View>
        ) : (
          <Text style={styles.plainTitle}>Your Booking</Text>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.spotTitle}>{listing.title}</Text>
          {booking.recurring ? (
            <>
              <SummaryRow
                label="Repeats"
                value={booking.recurring.days.map((d) => WEEKDAY_LABELS[d]).join(', ')}
              />
              <SummaryRow
                label="Time"
                value={`${formatHHmm(booking.recurring.startTime)} – ${formatHHmm(
                  booking.recurring.endTime
                )}`}
              />
            </>
          ) : (
            <SummaryRow
              label="Date & Time"
              value={formatDateTimeRange(booking.startTime, booking.endTime)}
            />
          )}
          <SummaryRow
            label={booking.pricingModel === 'metered' ? 'Estimated Total' : 'Total Price'}
            value={`${listing.currency}${booking.totalPrice}`}
            highlight
          />
        </View>

        {host ? (
          <View style={styles.hostCard}>
            <View style={styles.hostAvatar}>
              <Ionicons name="person" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.hostTextBlock}>
              <Text style={styles.hostName}>{host.name}</Text>
              <Text style={styles.hostPhone}>{host.phone}</Text>
            </View>
            <Button label="Call" variant="secondary" onPress={handleContactHost} style={styles.callButton} />
          </View>
        ) : null}
      </View>

      <View style={styles.mapSection}>
        <MapView
          latitude={(currentLocation.latitude + listing.latitude) / 2}
          longitude={(currentLocation.longitude + listing.longitude) / 2}
          zoom={13}
          route={directionsRoute ?? undefined}
          onRouteResolved={setRouteInfo}
          style={styles.map}
        />
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.infoBar}>
          <Text style={styles.infoBarText}>
            {durationMinutes} mins · {distanceKm.toFixed(1)} km
          </Text>
          <Text style={styles.infoBarSubtext}>via {roadName}</Text>
        </View>

        <Text style={styles.routeSourceText}>
          {routeInfo?.source === 'osrm'
            ? 'Live route from OSRM'
            : 'Estimated route (straight-line fallback)'}
        </Text>

        <Button
          label="Navigate in Google Maps"
          variant="secondary"
          onPress={handleNavigate}
          style={styles.navigateButton}
        />
        <Button label="I've Reached the Spot" onPress={handlePrimaryAction} />
      </View>
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
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  pendingContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  pendingTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  pendingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  declinedIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  confirmTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  plainTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  spotTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  hostAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostTextBlock: {
    flex: 1,
  },
  hostName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  hostPhone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  callButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  mapSection: {
    flex: 1,
    marginTop: spacing.md,
  },
  map: {
    flex: 1,
  },
  bottomPanel: {
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  infoBar: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoBarText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  infoBarSubtext: {
    ...typography.caption,
    color: colors.textMuted,
  },
  routeSourceText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  navigateButton: {
    marginBottom: spacing.sm,
  },
});