import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../theme';
import { ProviderListingsStackParamList } from '../../navigation/types';
import { formatHHmm, formatWeekdayList, toHHmm, WEEKDAY_LABELS } from '../../utils/format';

type Props = NativeStackScreenProps<ProviderListingsStackParamList, 'AddListingPricingAvailability'>;

const TIME_STEP_MINUTES = 30;
const MIN_MINUTES_OF_DAY = 0;
const MAX_MINUTES_OF_DAY = 23 * 60 + 30;

function clampToStep(value: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHHmm(minutes: number): string {
  return toHHmm(Math.floor(minutes / 60), minutes % 60);
}

export function AddListingPricingAvailabilityScreen({ navigation, route }: Props) {
  const { draft, editingListingId } = route.params;

  // Every listing is owner-set flat-rate pricing — there is no metered
  // option any more (renters always see a fixed rate the owner decided,
  // never a running meter). `pricingModel` stays `'flat'` unconditionally;
  // it's still threaded through the draft/create-input shape below so
  // `PricingModel` (kept as a type for backward-compatible display of any
  // pre-existing metered listings/bookings) doesn't need touching anywhere
  // else.
  const pricingModel = 'flat' as const;
  const [priceText, setPriceText] = useState(String(draft.pricePerHour));
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set(draft.availableDays));
  const [fromMinutes, setFromMinutes] = useState(hhmmToMinutes(draft.availableFrom));
  const [untilMinutes, setUntilMinutes] = useState(hhmmToMinutes(draft.availableUntil));

  const price = Math.max(0, parseInt(priceText, 10) || 0);

  const toggleDay = (index: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const canContinue = price > 0 && selectedDays.size > 0 && untilMinutes > fromMinutes;

  const handleContinue = () => {
    if (!canContinue) return;
    navigation.navigate('ListingReviewPublish', {
      draft: {
        ...draft,
        pricingModel,
        pricePerHour: price,
        availableDays: Array.from(selectedDays).sort((a, b) => a - b),
        availableFrom: minutesToHHmm(fromMinutes),
        availableUntil: minutesToHHmm(untilMinutes),
      },
      editingListingId,
    });
  };

  const scheduleSummary =
    selectedDays.size > 0
      ? `${formatWeekdayList(Array.from(selectedDays))}, ${formatHHmm(
          minutesToHHmm(fromMinutes)
        )} – ${formatHHmm(minutesToHHmm(untilMinutes))}`
      : 'Select at least one available day.';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>{editingListingId ? 'Edit Listing' : 'Add Listing'}</Text>
          <Text style={styles.stepLabel}>Step 3 of 3 · Pricing &amp; Availability</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Pricing</Text>
        <Text style={styles.sectionSubtitle}>
          You set a flat hourly rate — renters always know the full cost upfront.
        </Text>

        <View style={styles.priceBox}>
          <Text style={styles.currencySymbol}>₹</Text>
          <TextInput
            value={priceText}
            onChangeText={(text) => setPriceText(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.priceInput}
            placeholder="40"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.priceUnit}>/ hour</Text>
        </View>

        <Text style={styles.sectionTitle}>Available Days</Text>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, index) => {
            const isActive = selectedDays.has(index);
            return (
              <Pressable
                key={label}
                onPress={() => toggleDay(index)}
                style={[styles.weekdayChip, isActive && styles.weekdayChipActive]}
              >
                <Text style={[styles.weekdayChipText, isActive && styles.weekdayChipTextActive]}>
                  {label[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Available Hours</Text>
        <Stepper
          label="From"
          valueLabel={formatHHmm(minutesToHHmm(fromMinutes))}
          onIncrement={() =>
            setFromMinutes((m) => clampToStep(m + TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES))
          }
          onDecrement={() =>
            setFromMinutes((m) => clampToStep(m - TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES))
          }
          canDecrement={fromMinutes > MIN_MINUTES_OF_DAY}
          canIncrement={fromMinutes < untilMinutes - TIME_STEP_MINUTES}
        />

        <View style={{ height: spacing.sm }} />

        <Stepper
          label="Until"
          valueLabel={formatHHmm(minutesToHHmm(untilMinutes))}
          onIncrement={() =>
            setUntilMinutes((m) => clampToStep(m + TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES))
          }
          onDecrement={() =>
            setUntilMinutes((m) => clampToStep(m - TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES))
          }
          canDecrement={untilMinutes > fromMinutes + TIME_STEP_MINUTES}
          canIncrement={untilMinutes < MAX_MINUTES_OF_DAY}
        />

        <Text style={styles.summaryText}>{scheduleSummary}</Text>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Continue to Review" onPress={handleContinue} disabled={!canContinue} />
      </View>
    </SafeAreaView>
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
  stepLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.xs,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  currencySymbol: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  priceInput: {
    ...typography.h1,
    color: colors.textPrimary,
    flex: 1,
    padding: 0,
  },
  priceUnit: {
    ...typography.body,
    color: colors.textMuted,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekdayChip: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekdayChipText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  weekdayChipTextActive: {
    color: colors.textOnPrimary,
  },
  summaryText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
});