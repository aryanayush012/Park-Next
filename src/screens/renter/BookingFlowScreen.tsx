import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../theme';
import { RenterHomeStackParamList } from '../../navigation/types';
import { dataSource, CURRENT_USER_ID } from '../../data/dataSource';
import {
  clampToStep,
  formatDurationLabel,
  MAX_DURATION_MINUTES,
  MAX_MINUTES_OF_DAY,
  MIN_DURATION_MINUTES,
  MIN_MINUTES_OF_DAY,
  minutesToTimeLabel,
  nextDays,
  TIME_STEP_MINUTES,
} from '../../utils/scheduling';
import { Listing } from '../../types';

type Props = NativeStackScreenProps<RenterHomeStackParamList, 'BookingFlow'>;

export function BookingFlowScreen({ navigation, route }: Props) {
  const { listingId, bookingType: mode, schedule } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Advance mode — pre-filled from whatever date/time was already chosen on
  // the Home/Map search (see ScheduleSelection), so this screen never asks
  // for it from scratch; it's just a review with room to fine-tune. Falls
  // back to sensible defaults only if reached without a schedule at all.
  const [dateOffset, setDateOffset] = useState(schedule?.dateOffset ?? 0);
  const [advanceStartMinutes, setAdvanceStartMinutes] = useState(schedule?.startMinutes ?? 10 * 60);
  const [durationMinutes, setDurationMinutes] = useState(schedule?.durationMinutes ?? 120);

  // Instant mode
  const [instantDurationMinutes, setInstantDurationMinutes] = useState(60);

  useEffect(() => {
    dataSource.getListingById(listingId).then((result) => {
      if (result) setListing(result);
    });
  }, [listingId]);

  const days = useMemo(() => nextDays(7), []);

  const rate = listing?.pricePerHour ?? 0;
  const currency = listing?.currency ?? '₹';

  const advanceEndMinutes = advanceStartMinutes + durationMinutes;
  const advanceHours = durationMinutes / 60;
  const advanceTotal = Math.round(advanceHours * rate);

  const instantHours = instantDurationMinutes / 60;
  const instantTotal = Math.round(instantHours * rate);

  const minutesToLabel = minutesToTimeLabel;

  const canConfirm = Boolean(listing) && !isSubmitting;

  const handleConfirm = async () => {
    if (!listing || !canConfirm) return;
    setIsSubmitting(true);

    let startTime: Date;
    let endTime: Date;
    let totalPrice: number;

    if (mode === 'instant') {
      startTime = new Date();
      endTime = new Date(startTime.getTime() + instantDurationMinutes * 60000);
      totalPrice = instantTotal;
    } else {
      const base = days[dateOffset].date;
      startTime = new Date(base);
      startTime.setHours(Math.floor(advanceStartMinutes / 60), advanceStartMinutes % 60, 0, 0);
      endTime = new Date(startTime.getTime() + durationMinutes * 60000);
      totalPrice = advanceTotal;
    }

    const booking = await dataSource.createBooking({
      listingId: listing.id,
      renterId: CURRENT_USER_ID,
      type: mode,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      totalPrice,
      pricingModel: listing.pricingModel,
    });

    setIsSubmitting(false);
    navigation.replace('BookingConfirmation', { bookingId: booking.id, justBooked: true });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Choose Date & Time</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.modeHeader}>
          <Ionicons name={mode === 'instant' ? 'flash' : 'calendar-outline'} size={16} color={colors.primary} />
          <Text style={styles.modeHeaderText}>
            {mode === 'instant' ? 'Instant Booking' : 'Advance Booking'}
          </Text>
        </View>

        {mode === 'advance' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow}>
              {days.map(({ offset, date }) => {
                const isActive = offset === dateOffset;
                return (
                  <Pressable
                    key={offset}
                    onPress={() => setDateOffset(offset)}
                    style={[styles.dateChip, isActive && styles.dateChipActive]}
                  >
                    <Text style={[styles.dateChipDay, isActive && styles.dateChipTextActive]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={[styles.dateChipDate, isActive && styles.dateChipTextActive]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionLabel}>Start Time</Text>
            <Stepper
              label="Starts at"
              valueLabel={minutesToLabel(advanceStartMinutes)}
              onIncrement={() =>
                setAdvanceStartMinutes((m) =>
                  clampToStep(m + TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES)
                )
              }
              onDecrement={() =>
                setAdvanceStartMinutes((m) =>
                  clampToStep(m - TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES)
                )
              }
              canDecrement={advanceStartMinutes > MIN_MINUTES_OF_DAY}
              canIncrement={advanceStartMinutes < MAX_MINUTES_OF_DAY}
            />

            <View style={{ height: spacing.sm }} />

            <Stepper
              label="Duration"
              valueLabel={formatDurationLabel(durationMinutes)}
              onIncrement={() =>
                setDurationMinutes((m) => clampToStep(m + TIME_STEP_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, TIME_STEP_MINUTES))
              }
              onDecrement={() =>
                setDurationMinutes((m) => clampToStep(m - TIME_STEP_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, TIME_STEP_MINUTES))
              }
              canDecrement={durationMinutes > MIN_DURATION_MINUTES}
              canIncrement={durationMinutes < MAX_DURATION_MINUTES}
            />

            <Text style={styles.endsAtText}>Ends at {minutesToLabel(advanceEndMinutes)}</Text>

            <SummaryBox
              rows={[
                ['Duration', formatDurationLabel(durationMinutes)],
                ['Rate', `${currency}${rate}/hr`],
                ['Estimated Total', `${currency}${advanceTotal}`],
              ]}
              highlightLast
            />
          </View>
        ) : null}

        {mode === 'instant' ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Start</Text>
            <View style={styles.startsNowBanner}>
              <Ionicons name="flash" size={16} color={colors.primary} />
              <Text style={styles.startsNowText}>Starts now</Text>
            </View>

            <Text style={styles.sectionLabel}>Duration</Text>
            <Stepper
              label="Duration"
              valueLabel={formatDurationLabel(instantDurationMinutes)}
              onIncrement={() =>
                setInstantDurationMinutes((m) => clampToStep(m + TIME_STEP_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, TIME_STEP_MINUTES))
              }
              onDecrement={() =>
                setInstantDurationMinutes((m) => clampToStep(m - TIME_STEP_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, TIME_STEP_MINUTES))
              }
              canDecrement={instantDurationMinutes > MIN_DURATION_MINUTES}
              canIncrement={instantDurationMinutes < MAX_DURATION_MINUTES}
            />

            <SummaryBox
              rows={[
                ['Duration', formatDurationLabel(instantDurationMinutes)],
                ['Rate', `${currency}${rate}/hr`],
                ['Estimated Total', `${currency}${instantTotal}`],
              ]}
              highlightLast
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Continue to Confirm"
          onPress={handleConfirm}
          disabled={!canConfirm}
          loading={isSubmitting}
        />
      </View>
    </SafeAreaView>
  );
}

function SummaryBox({
  rows,
  highlightLast,
}: {
  rows: [string, string][];
  highlightLast?: boolean;
}) {
  return (
    <View style={styles.summaryBox}>
      {rows.map(([label, value], index) => (
        <View
          key={label}
          style={[styles.summaryRow, index === rows.length - 1 && styles.summaryRowLast]}
        >
          <Text style={styles.summaryLabel}>{label}</Text>
          <Text
            style={[
              styles.summaryValue,
              highlightLast && index === rows.length - 1 && styles.summaryValueHighlight,
            ]}
          >
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  modeHeaderText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  dateRow: {
    marginBottom: spacing.lg,
  },
  dateChip: {
    width: 62,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipDay: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  dateChipDate: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  dateChipTextActive: {
    color: colors.textOnPrimary,
  },
  endsAtText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  startsNowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  startsNowText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  summaryBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryRowLast: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    marginTop: spacing.xxs,
    paddingTop: spacing.sm,
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
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
});