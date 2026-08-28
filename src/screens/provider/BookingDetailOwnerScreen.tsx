import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderBookingsStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { MOCK_RENTERS, VEHICLE_TYPE_LABELS } from '../../data/mockData';
import {
  bookingStatusToBadgeStatus,
  formatElapsedClock,
  formatRelativeDate,
  formatTimeFromISO,
} from '../../utils/format';
import { Booking, Listing, RenterProfile } from '../../types';

type Props = NativeStackScreenProps<ProviderBookingsStackParamList, 'BookingDetailOwner'>;

export function BookingDetailOwnerScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [renter, setRenter] = useState<RenterProfile | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    dataSource.getBookingById(bookingId).then(async (result) => {
      if (!result) return;
      setBooking(result);
      const relatedListing = await dataSource.getListingById(result.listingId);
      if (relatedListing) setListing(relatedListing);
      setRenter(MOCK_RENTERS[result.renterId] ?? null);
    });
  }, [bookingId]);

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
            {booking.status !== 'pending' ? (
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
        </View>

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

        {booking.status !== 'pending' ? (
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
  contactButton: {
    marginTop: spacing.sm,
  },
});