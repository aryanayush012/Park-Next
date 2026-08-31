import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { StarRatingInput } from '../../components/StarRatingInput';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderBookingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { VEHICLE_TYPE_LABELS } from '../../data/mockData';
import { useAuth } from '../../navigation/AuthContext';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import {
  bookingStatusToBadgeStatus,
  formatElapsedClock,
  formatRelativeDate,
  formatTimeFromISO,
} from '../../utils/format';
import { formatResponseDeadline } from '../../utils/bookingRequest';
import { Booking, BookingStatus, Listing, RenterProfile, Review } from '../../types';

/** Contact info (phone) is only meaningful once a request actually turned
 * into a real booking — never for one still pending, and no longer relevant
 * once it's declined/expired/cancelled without ever becoming one. */
const CONTACT_REVEALED_STATUSES: BookingStatus[] = ['booked', 'in_progress', 'completed'];

type Props = NativeStackScreenProps<ProviderBookingsStackParamList, 'BookingDetailOwner'>;

export function BookingDetailOwnerScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const { userId } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [renter, setRenter] = useState<RenterProfile | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [myReview, setMyReview] = useState<Review | null | undefined>(undefined);
  const [ratingInput, setRatingInput] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    dataSource.getBookingById(bookingId).then(async (result) => {
      if (!result) return;
      setBooking(result);
      const relatedListing = await dataSource.getListingById(result.listingId);
      if (relatedListing) setListing(relatedListing);
      const renterProfile = await dataSource.getPublicProfile(result.renterId);
      setRenter(renterProfile ?? null);
    });
  }, [bookingId]);

  // Surfaces "Rate This Renter" the moment this screen itself notices the
  // booking has completed — covers both a fresh mount on an already-completed
  // booking (e.g. opened from the History tab) and a live transition while
  // this screen stays open (the renter checking out from their own device,
  // caught by the poll/realtime hooks below).
  useEffect(() => {
    if (!booking || booking.status !== 'completed') return;
    dataSource.getMyReviewForBooking(booking.id, userId).then((existing) => setMyReview(existing ?? null));
  }, [booking?.status, booking?.id, userId]);

  // The renter checking out happens on their own device/screen, not from
  // any action taken here — so unlike the arrival-code confirmation (which
  // updates local state immediately after this screen's own button press),
  // reaching `completed` while this screen is already open depends entirely
  // on noticing it from the outside. Poll while checked in (cheap, and this
  // is the only signal in mock mode); realtime below shortcuts the wait
  // once Supabase is connected.
  useEffect(() => {
    if (booking?.status !== 'in_progress') return;
    const poll = setInterval(async () => {
      const latest = await dataSource.getBookingById(bookingId);
      if (latest && latest.status !== 'in_progress') {
        setBooking(latest);
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [booking?.status, bookingId]);

  const refetchBooking = useCallback(() => {
    dataSource.getBookingById(bookingId).then((latest) => {
      if (latest) setBooking(latest);
    });
  }, [bookingId]);
  useRealtimeTable('bookings', refetchBooking, `id=eq.${bookingId}`);

  const handleSubmitReview = async () => {
    if (!booking || ratingInput === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const review = await dataSource.submitReview({
        bookingId,
        reviewerId: userId,
        revieweeId: booking.renterId,
        rating: ratingInput,
        comment: comment.trim() || undefined,
      });
      setMyReview(review);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (booking?.status !== 'in_progress') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [booking?.status]);

  if (!booking || !listing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading booking…</Text>
      </SafeAreaView>
    );
  }

  const handleContact = () => {
    if (renter?.phone) {
      Linking.openURL(`tel:${renter.phone}`).catch(() => {});
    }
  };

  const handleRespond = async (accept: boolean) => {
    if (!booking) return;
    setIsResponding(true);
    try {
      const updated = await dataSource.respondToBookingRequest(booking.id, accept);
      setBooking(updated);
    } catch (err) {
      Alert.alert(
        'Could not respond',
        err instanceof Error ? err.message : 'This request may have already expired or been withdrawn.'
      );
    } finally {
      setIsResponding(false);
    }
  };

  const handleConfirmArrival = async () => {
    setVerifying(true);
    setCodeError(null);
    try {
      const updated = await dataSource.verifyArrivalCode(booking.id, codeInput);
      setBooking(updated);
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Booking Detail</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <StatusBadge status={bookingStatusToBadgeStatus(booking.status)} />
        </View>

        <View style={styles.renterCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(renter?.name ?? '?')[0]}</Text>
          </View>
          <View style={styles.renterTextBlock}>
            <Text style={styles.renterName}>{renter?.name ?? 'Renter'}</Text>
            <View style={styles.renterRatingRow}>
              <Ionicons name="star" size={13} color={colors.primary} />
              <Text style={styles.renterRatingText}>
                {(renter?.rating ?? 0).toFixed(1)} · Verified renter
              </Text>
            </View>
            {CONTACT_REVEALED_STATUSES.includes(booking.status) ? (
              <Text style={styles.renterPhoneText}>{renter?.phone}</Text>
            ) : (
              <Text style={styles.renterPhoneHidden}>
                Contact details unlock once you accept this request
              </Text>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <DetailRow label="Listing" value={listing.title} />
          <DetailRow label="Location" value={listing.address.split(',')[0]} />
          <DetailRow
            label="Date"
            value={
              booking.recurring
                ? `${formatRelativeDate(booking.startTime)} (recurring)`
                : formatRelativeDate(booking.startTime)
            }
          />
          <DetailRow
            label="Time"
            value={`${formatTimeFromISO(booking.startTime)} – ${formatTimeFromISO(booking.endTime)}`}
          />
          <DetailRow
            label="Vehicle"
            value={
              booking.renterVehiclePlate
                ? `${booking.renterVehiclePlate}${
                    booking.renterVehicleType ? ` (${VEHICLE_TYPE_LABELS[booking.renterVehicleType]})` : ''
                  }`
                : '—'
            }
          />
          <DetailRow label="Amount" value={`${listing.currency}${booking.totalPrice}`} highlight />
          {booking.status === 'pending' ? (
            <DetailRow
              label="Respond"
              value={formatResponseDeadline(booking.responseDeadline)}
              highlight
            />
          ) : null}
        </View>

        {booking.status === 'pending' ? (
          <View style={styles.card}>
            <Text style={styles.codeHint}>
              Accept to confirm this booking, or decline if you can't take it — the renter is
              notified either way.
            </Text>
            <View style={styles.responseActionsRow}>
              <Button
                label="Decline"
                variant="secondary"
                onPress={() => handleRespond(false)}
                loading={isResponding}
                style={styles.responseActionButton}
              />
              <Button
                label="Accept"
                onPress={() => handleRespond(true)}
                loading={isResponding}
                style={styles.responseActionButton}
              />
            </View>
          </View>
        ) : null}

        {booking.status === 'booked' ? (
          <>
            <Text style={styles.sectionTitle}>Confirm Arrival</Text>
            <View style={styles.card}>
              <Text style={styles.codeHint}>
                Ask the renter for their 4-digit arrival code, then enter it below — the booking
                starts automatically once it matches.
              </Text>
              <TextInput
                style={styles.codeInput}
                value={codeInput}
                onChangeText={(text) => {
                  setCodeInput(text.replace(/[^0-9]/g, '').slice(0, 4));
                  setCodeError(null);
                }}
                placeholder="0000"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />
              {codeError ? <Text style={styles.codeErrorText}>{codeError}</Text> : null}
              <Button
                label="Confirm Arrival"
                onPress={handleConfirmArrival}
                loading={verifying}
                disabled={codeInput.length !== 4}
                style={styles.confirmButton}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Check-in / Check-out Tracking</Text>
        <View style={styles.card}>
          <DetailRow
            label="Arrived"
            value={booking.checkInAt ? formatTimeFromISO(booking.checkInAt) : 'Not yet'}
          />
          {booking.status === 'in_progress' ? (
            <DetailRow
              label="Time Remaining"
              value={formatElapsedClock(Math.max(0, new Date(booking.endTime).getTime() - now))}
              highlight
            />
          ) : null}
          <DetailRow
            label="Vacated"
            value={booking.checkOutAt ? formatTimeFromISO(booking.checkOutAt) : 'Not yet'}
          />
        </View>

        {booking.status === 'completed' ? (
          <>
            <Text style={styles.sectionTitle}>Rate This Renter</Text>
            <View style={styles.card}>
              {myReview === undefined ? null : myReview ? (
                <>
                  <StarRating rating={myReview.rating} size={18} />
                  {myReview.comment ? (
                    <Text style={styles.reviewComment}>{myReview.comment}</Text>
                  ) : null}
                  <Text style={styles.reviewSubmittedNote}>Thanks for rating this renter!</Text>
                </>
              ) : (
                <>
                  <Text style={styles.reviewPrompt}>How was your experience with this renter?</Text>
                  <StarRatingInput value={ratingInput} onChange={setRatingInput} />
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Add a comment (optional)"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  {submitError ? <Text style={styles.reviewErrorText}>{submitError}</Text> : null}
                  <Button
                    label="Submit Review"
                    onPress={handleSubmitReview}
                    loading={submitting}
                    disabled={ratingInput === 0}
                    style={styles.submitButton}
                  />
                </>
              )}
            </View>
          </>
        ) : null}

        {CONTACT_REVEALED_STATUSES.includes(booking.status) ? (
          <Button
            label="Contact Renter"
            variant="secondary"
            onPress={handleContact}
            style={styles.contactButton}
          />
        ) : null}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
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
  badgeRow: {
    marginBottom: spacing.md,
  },
  renterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...typography.h2,
    color: colors.textOnPrimary,
  },
  renterTextBlock: {
    flex: 1,
  },
  renterName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  renterRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  renterRatingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  renterPhoneText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  renterPhoneHidden: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxs,
  },
  detailLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  detailValueHighlight: {
    ...typography.h3,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  codeHint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  codeInput: {
    ...typography.h1,
    fontSize: 32,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  codeErrorText: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  confirmButton: {
    marginTop: spacing.xxs,
  },
  responseActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  responseActionButton: {
    flex: 1,
  },
  contactButton: {
    marginTop: spacing.sm,
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
});