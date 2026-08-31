import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { StarRatingInput } from '../../components/StarRatingInput';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { SharedBookingParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { useAuth } from '../../navigation/AuthContext';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import {
  bookingStatusToBadgeStatus,
  formatElapsedClock,
  formatRelativeDate,
  formatTimeFromISO,
} from '../../utils/format';
import { openDirectionsInMaps } from '../../utils/maps';
import {
  cancelBookingEndingSoonReminder,
  scheduleBookingEndingSoonReminder,
} from '../../utils/notifications';
import { Booking, Listing, RenterProfile, Review } from '../../types';

type Props = NativeStackScreenProps<SharedBookingParamList, 'ActiveBooking'>;

// How often to re-check the booking while waiting for the host to enter the
// arrival code — cheap enough to poll, and this is the only signal the
// renter's screen has that the host has confirmed (see mock-data-source
// caveat: on two separate physical devices this only works once a real
// backend is connected, since the in-memory mock store is per app instance).
const ARRIVAL_POLL_MS = 3000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
// An advance booking's arrival code is deliberately hidden until close to
// the booking's own start time — showing it the instant the booking is
// confirmed (which could be hours or days early) would let a renter show up
// and check in well before their actual slot. A short grace window before
// the literal start time is allowed so someone arriving a few minutes early
// isn't blocked from checking in right at the door.
const EARLY_ARRIVAL_CODE_REVEAL_MS = 15 * 60 * 1000;

export function ActiveBookingScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const { userId } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [host, setHost] = useState<RenterProfile | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [myReview, setMyReview] = useState<Review | null | undefined>(undefined);
  const [ratingInput, setRatingInput] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);

  useEffect(() => {
    dataSource.getBookingById(bookingId).then(async (result) => {
      if (!result) return;
      setBooking(result);
      const relatedListing = await dataSource.getListingById(result.listingId);
      if (relatedListing) {
        setListing(relatedListing);
        // The booking already exists by the time this screen is reachable
        // — i.e. it's confirmed — so it's safe to reveal host contact info
        // here (never earlier, e.g. while just browsing listings).
        const hostProfile = await dataSource.getPublicProfile(relatedListing.ownerId);
        setHost(hostProfile ?? null);
      }
    });
  }, [bookingId]);

  // Ticks the clock every second while checked in (elapsed/remaining time
  // needs second-level precision there), or every 15s while still `booked`
  // and waiting on either the start time to arrive or the host's arrival
  // confirmation — coarser is fine there, it just needs to notice the
  // moment has passed without a manual refresh.
  useEffect(() => {
    if (booking?.status === 'in_progress') {
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }
    if (booking?.status === 'booked') {
      const timer = setInterval(() => setNow(Date.now()), 15000);
      return () => clearInterval(timer);
    }
  }, [booking?.status]);

  // Waiting for the host to enter the renter's arrival code on their own
  // Booking Detail screen — poll for the status flip instead of a
  // self-service "I've Arrived" button.
  useEffect(() => {
    if (booking?.status !== 'booked') return;
    const poll = setInterval(async () => {
      const latest = await dataSource.getBookingById(bookingId);
      if (latest && latest.status !== 'booked') {
        setBooking(latest);
      }
    }, ARRIVAL_POLL_MS);
    return () => clearInterval(poll);
  }, [booking?.status, bookingId]);

  // Once Supabase is connected, this specific booking's row changing on
  // the host's own device (arrival code confirmed, or a later checkout)
  // arrives near-instantly over a live subscription — the poll above stays
  // as a fallback (and is the only mechanism at all in mock mode, where
  // this hook no-ops), so a missed/dropped realtime event still recovers
  // within a few seconds either way.
  const refetchBooking = useCallback(() => {
    dataSource.getBookingById(bookingId).then((latest) => {
      if (latest) setBooking(latest);
    });
  }, [bookingId]);
  useRealtimeTable('bookings', refetchBooking, `id=eq.${bookingId}`);

  // Schedules the "10 minutes left" sound + vibration reminder as soon as
  // the booking is checked in, and re-schedules it (via the endTime dep)
  // whenever the renter extends. Deliberately does NOT cancel on unmount —
  // the whole point is it still fires while this screen isn't open. It
  // only cancels once the booking leaves `in_progress` (checked out).
  useEffect(() => {
    if (!booking || !listing) return;
    if (booking.status !== 'in_progress') {
      cancelBookingEndingSoonReminder(booking.id).catch(() => {});
      return;
    }
    scheduleBookingEndingSoonReminder(booking, listing.title).catch(() => {});
  }, [booking?.status, booking?.endTime, booking?.id, listing?.title]);

  // Surfaces the review prompt the moment this screen itself notices the
  // booking has completed — whether that's this renter's own "I'm Leaving"
  // tap just above, or (less commonly, e.g. a host-initiated edge case) a
  // status flip picked up via the poll/realtime hooks above. Runs whenever
  // `booking.status` transitions to `completed`, including the case where
  // this screen is reached already-completed (so it also covers a fresh
  // mount, not just the live transition).
  useEffect(() => {
    if (!booking || booking.status !== 'completed') return;
    dataSource.getMyReviewForBooking(booking.id, userId).then((existing) => setMyReview(existing ?? null));
  }, [booking?.status, booking?.id, userId]);

  const handleSubmitReview = async () => {
    if (!booking || !listing || ratingInput === 0) return;
    setSubmittingReview(true);
    setReviewSubmitError(null);
    try {
      const review = await dataSource.submitReview({
        bookingId: booking.id,
        reviewerId: userId,
        revieweeId: listing.ownerId,
        rating: ratingInput,
        comment: comment.trim() || undefined,
      });
      setMyReview(review);
    } catch (err) {
      setReviewSubmitError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!booking || !listing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading booking…</Text>
      </SafeAreaView>
    );
  }

  const elapsedMs = booking.checkInAt ? now - new Date(booking.checkInAt).getTime() : 0;
  const elapsedHours = elapsedMs / 3600000;
  const currentEstimate =
    booking.pricingModel === 'metered'
      ? Math.max(0, Math.round(elapsedHours * listing.pricePerHour))
      : booking.totalPrice;

  const remainingMs = Math.max(0, new Date(booking.endTime).getTime() - now);
  const isOverdue = now > new Date(booking.endTime).getTime();
  const isEndingSoon = remainingMs <= TEN_MINUTES_MS;

  // Instant bookings start at the moment they're created, so this is
  // already true the instant this screen is reachable — only an advance
  // booking can actually be "not yet time" here.
  const canRevealArrivalCode =
    new Date(booking.startTime).getTime() - now <= EARLY_ARRIVAL_CODE_REVEAL_MS;

  const handleVacated = async () => {
    setIsUpdating(true);
    const updated = await dataSource.checkOut(booking.id);
    cancelBookingEndingSoonReminder(booking.id).catch(() => {});
    setBooking({ ...updated });
    setIsUpdating(false);
  };

  const handleExtend = async (extraMinutes: number) => {
    setIsExtending(true);
    try {
      const updated = await dataSource.extendBooking(booking.id, extraMinutes);
      setBooking({ ...updated });
    } catch {
      // Best-effort — nothing to roll back locally since the booking wasn't
      // mutated yet; the ring/estimate just stay as they were.
    } finally {
      setIsExtending(false);
    }
  };

  const handleDone = () => {
    navigation.popToTop();
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
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <StatusBadge status={bookingStatusToBadgeStatus(booking.status)} />
        </View>

        {booking.status === 'booked' ? (
          canRevealArrivalCode ? (
            <View style={styles.centerBlock}>
              <Text style={styles.stateTitle}>You're on your way</Text>
              <Text style={styles.stateSubtitle}>
                Show this code to the host when you arrive at {listing.title}. The booking starts
                automatically once they enter it on their phone.
              </Text>
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>Your Arrival Code</Text>
                <Text style={styles.codeText}>{booking.verificationCode}</Text>
              </View>
              <View style={styles.waitingRow}>
                <ActivityIndicator color={colors.secondary} />
                <Text style={styles.waitingText}>Waiting for host to confirm…</Text>
              </View>
            </View>
          ) : (
            <View style={styles.centerBlock}>
              <Ionicons name="time-outline" size={40} color={colors.secondary} />
              <Text style={styles.stateTitle}>Your booking hasn't started yet</Text>
              <Text style={styles.stateSubtitle}>
                {listing.title} is reserved for you starting {formatRelativeDate(booking.startTime)}{' '}
                at {formatTimeFromISO(booking.startTime)}. Come back closer to that time — your
                arrival code will show up here automatically, no need to refresh.
              </Text>
            </View>
          )
        ) : null}

        {booking.status === 'in_progress' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.timerLabel}>{isOverdue ? "Time's Up" : 'Time Remaining'}</Text>
            <View style={styles.timerRing}>
              <Text style={styles.timerText}>{formatElapsedClock(remainingMs)}</Text>
            </View>
            {isEndingSoon ? (
              <View style={styles.endingSoonCard}>
                <View style={styles.endingSoonHeader}>
                  <Ionicons name="notifications" size={16} color={colors.secondary} />
                  <Text style={styles.endingSoonTitle}>
                    {isOverdue ? "You're past your booked time" : 'Ending in under 10 minutes'}
                  </Text>
                </View>
                <Text style={styles.endingSoonSubtitle}>
                  We've sent you a reminder — need more time? Extend right from here, or confirm
                  vacated below once you leave.
                </Text>
                <View style={styles.extendRow}>
                  <Button
                    label="+15 min"
                    variant="secondary"
                    onPress={() => handleExtend(15)}
                    loading={isExtending}
                    style={styles.extendButton}
                  />
                  <Button
                    label="+30 min"
                    variant="secondary"
                    onPress={() => handleExtend(30)}
                    loading={isExtending}
                    style={styles.extendButton}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {booking.status === 'completed' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.stateTitle}>Booking Completed</Text>
            <Text style={styles.stateSubtitle}>
              Thanks for parking with ParkNext. Settle up directly with the host.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{listing.title}</Text>

          {booking.checkInAt ? (
            <SummaryRow label="Checked in at" value={formatTimeFromISO(booking.checkInAt)} />
          ) : null}
          {booking.checkOutAt ? (
            <SummaryRow label="Checked out at" value={formatTimeFromISO(booking.checkOutAt)} />
          ) : null}

          <SummaryRow
            label="Rate"
            value={
              booking.pricingModel === 'metered'
                ? `${listing.currency}${listing.pricePerHour}/hr`
                : 'Flat rate'
            }
          />

          <SummaryRow
            label={booking.status === 'completed' ? 'Amount Owed' : 'Current Estimate'}
            value={`${listing.currency}${currentEstimate}`}
            highlight
          />

          {booking.status === 'completed' ? (
            <Text style={styles.paymentNote}>
              Pay the host directly (cash/UPI) — ParkNext doesn't process payments in-app.
            </Text>
          ) : null}
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

        {booking.status === 'completed' ? (
          <>
            <Text style={styles.sectionTitle}>Your Review</Text>
            <View style={styles.card}>
              {myReview === undefined ? (
                <ActivityIndicator color={colors.secondary} />
              ) : myReview ? (
                <>
                  <StarRating rating={myReview.rating} size={18} />
                  {myReview.comment ? (
                    <Text style={styles.reviewComment}>{myReview.comment}</Text>
                  ) : null}
                  <Text style={styles.reviewSubmittedNote}>Thanks for rating your host!</Text>
                </>
              ) : (
                <>
                  <Text style={styles.reviewPrompt}>How was your experience with the host?</Text>
                  <StarRatingInput value={ratingInput} onChange={setRatingInput} />
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Add a comment (optional)"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  {reviewSubmitError ? (
                    <Text style={styles.reviewErrorText}>{reviewSubmitError}</Text>
                  ) : null}
                  <Button
                    label="Submit Review"
                    onPress={handleSubmitReview}
                    loading={submittingReview}
                    disabled={ratingInput === 0}
                    style={styles.submitButton}
                  />
                </>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {booking.status === 'booked' ? (
          <Button
            label="Navigate in Google Maps"
            variant="secondary"
            onPress={handleNavigate}
            style={styles.navigateButton}
          />
        ) : null}
        {booking.status === 'in_progress' ? (
          <>
            <Button label="I'm Leaving · Confirm Vacated" onPress={handleVacated} loading={isUpdating} />
            <Text style={styles.footerNote}>We'll notify the host and stop your meter.</Text>
          </>
        ) : null}
        {booking.status === 'completed' ? <Button label="Done" onPress={handleDone} /> : null}
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
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  centerBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stateTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stateSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  codeCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  codeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xxs,
  },
  codeText: {
    ...typography.h1,
    fontSize: 40,
    letterSpacing: 8,
    color: colors.primary,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  waitingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  timerLabel: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  timerRing: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  timerText: {
    ...typography.h1,
    fontSize: 34,
    color: colors.textPrimary,
  },
  endingSoonCard: {
    width: '100%',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.md,
  },
  endingSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  endingSoonTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  endingSoonSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  extendRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  extendButton: {
    flex: 1,
    minHeight: 44,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
  },
  cardTitle: {
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
  paymentNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
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
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  reviewPrompt: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  commentInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reviewErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  reviewComment: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  reviewSubmittedNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
  },
  navigateButton: {
    marginBottom: spacing.sm,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});