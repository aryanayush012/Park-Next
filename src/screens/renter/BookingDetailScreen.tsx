import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/StarRating';
import { StarRatingInput } from '../../components/StarRatingInput';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { RenterBookingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { useAuth } from '../../navigation/AuthContext';
import {
  bookingStatusToBadgeStatus,
  formatDateTimeRange,
  formatTimeFromISO,
} from '../../utils/format';
import { Booking, Listing, Review } from '../../types';

type Props = NativeStackScreenProps<RenterBookingsStackParamList, 'BookingDetail'>;

export function BookingDetailScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const { userId } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
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
      if (result.status === 'completed') {
        const existing = await dataSource.getMyReviewForBooking(bookingId, userId);
        setMyReview(existing ?? null);
      } else {
        setMyReview(null);
      }
    });
  }, [bookingId, userId]);

  const handleSubmitReview = async () => {
    if (!listing || ratingInput === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const review = await dataSource.submitReview({
        bookingId,
        reviewerId: userId,
        revieweeId: listing.ownerId,
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

        {booking.status === 'completed' ? (
          <>
            <Text style={styles.sectionTitle}>Your Review</Text>
            <View style={styles.card}>
              {myReview === undefined ? null : myReview ? (
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
});