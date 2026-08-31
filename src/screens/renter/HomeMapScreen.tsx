import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { ListingCard } from '../../components/ListingCard';
import { MapMarker, MapView } from '../../components/MapView';
import { Stepper } from '../../components/Stepper';
import { colors, radius, spacing, typography } from '../../theme';
import { RenterHomeStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { AMENITIES, AMENITY_SELECTOR_KEYS } from '../../data/mockData';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { isListingAvailableForWindow } from '../../utils/listingAvailability';
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
import { AmenityKey, BookingType, Listing, VehicleType } from '../../types';

type Props = NativeStackScreenProps<RenterHomeStackParamList, 'HomeMap'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_HEIGHT = 148;
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.62);
const CARD_HEIGHT = 258;
// Caps the Filters sheet's scrollable body so its "Show N Spots" button stays
// on screen even with every section (Sort/Budget/Amenities/Vehicle Type)
// visible at once, on a shorter device.
const FILTERS_SCROLL_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.5);

/** One of a small set of hourly-price bands — replaces the old flat "Budget
 * Friendly" on/off toggle with something that scales past this app's own
 * sample-data price range (which happens to sit under ₹50/hr today). */
type BudgetBucket = 'under_50' | '50_100' | '100_200' | '200_300' | 'above_300';

interface BudgetBucketDef {
  key: BudgetBucket;
  label: string;
  min: number;
  /** null = open-ended (no upper bound). */
  max: number | null;
}

const BUDGET_BUCKETS: BudgetBucketDef[] = [
  { key: 'under_50', label: 'Under ₹50/hr', min: 0, max: 50 },
  { key: '50_100', label: '₹50 – 100/hr', min: 50, max: 100 },
  { key: '100_200', label: '₹100 – 200/hr', min: 100, max: 200 },
  { key: '200_300', label: '₹200 – 300/hr', min: 200, max: 300 },
  { key: 'above_300', label: 'Above ₹300/hr', min: 300, max: null },
];

interface Filters {
  /** null = any price. */
  budgetBucket: BudgetBucket | null;
  /** A listing must have every amenity in this set — empty set = no amenity requirement. */
  amenities: AmenityKey[];
  /** null = any vehicle type. */
  vehicleType: VehicleType | null;
}

const EMPTY_FILTERS: Filters = { budgetBucket: null, amenities: [], vehicleType: null };

/** Whether the renter is looking for a spot right now, or planning ahead for a later date/time. */
type SearchMode = 'now' | 'later';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const VEHICLE_OPTIONS: { key: VehicleType | null; label: string }[] = [
  { key: null, label: 'Any' },
  { key: 'car', label: 'Car' },
  { key: 'suv', label: 'SUV' },
  { key: 'two_wheeler', label: '2-Wheeler' },
];

export function HomeMapScreen({ navigation }: Props) {
  const {
    location: currentLocation,
    source: locationSource,
    loading: locationLoading,
    error: locationError,
    reason: locationReason,
    refresh: refreshLocation,
    openLocationSettings,
  } = useCurrentLocation();
  // Services off, or a permission the OS won't prompt for again — neither
  // can be fixed by simply re-running the same check, so the notice should
  // send the person to Settings instead of just retrying in place.
  const locationNeedsSettings =
    locationReason === 'services_disabled' || locationReason === 'permission_needs_settings';
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'distance' | 'rating'>('distance');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);

  // "When do you need parking?" — chosen before a specific spot, so the list
  // below can be filtered down to only the spots actually available for that
  // window (per each listing's own availableDays/From/Until), the same way
  // Instant/Advance ride-hailing apps ask "now or later" up front.
  const [searchMode, setSearchMode] = useState<SearchMode>('now');
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const scheduleDays = useMemo(() => nextDays(7), []);
  const [scheduleDateOffset, setScheduleDateOffset] = useState(0);
  const [scheduleStartMinutes, setScheduleStartMinutes] = useState(() => {
    const now = new Date();
    return clampToStep(
      now.getHours() * 60 + now.getMinutes() + TIME_STEP_MINUTES,
      MIN_MINUTES_OF_DAY,
      MAX_MINUTES_OF_DAY,
      TIME_STEP_MINUTES
    );
  });
  const [scheduleDurationMinutes, setScheduleDurationMinutes] = useState(120);

  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED_HEIGHT)).current;
  const listRef = useRef<FlatList<Listing>>(null);

  // Animated.Value doesn't expose a synchronous getter, so we track the
  // last-committed height ourselves — both the tap-to-toggle animation below
  // and the drag gesture need to know "where is the sheet right now" to
  // compute the next frame / decide which way to snap.
  const currentHeightRef = useRef(SHEET_COLLAPSED_HEIGHT);

  const loadListings = useCallback(() => {
    dataSource.getListings().then(setListings);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // Once Supabase is connected, a listing published/edited/toggled on a
  // different device shows up here live instead of only on next reload —
  // a no-op in mock mode. See `src/hooks/useRealtimeTable.ts`.
  useRealtimeTable('listings', loadListings);

  useEffect(() => {
    const target = sheetExpanded ? SHEET_EXPANDED_HEIGHT : SHEET_COLLAPSED_HEIGHT;
    Animated.spring(sheetHeight, {
      toValue: target,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
    currentHeightRef.current = target;
  }, [sheetExpanded, sheetHeight]);

  // Lets the user actually drag the handle/header up and down, rather than
  // only tap it to toggle — this was previously missing entirely (the
  // handle only had an onPress), which is why dragging did nothing.
  const dragStartHeight = useRef(SHEET_COLLAPSED_HEIGHT);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        dragStartHeight.current = currentHeightRef.current;
      },
      onPanResponderMove: (_evt, gesture) => {
        // Dragging up (negative dy) should grow the sheet.
        const next = clamp(
          dragStartHeight.current - gesture.dy,
          SHEET_COLLAPSED_HEIGHT,
          SHEET_EXPANDED_HEIGHT
        );
        sheetHeight.setValue(next);
        currentHeightRef.current = next;
      },
      onPanResponderRelease: (_evt, gesture) => {
        // A near-stationary release is a tap on the handle, not a drag —
        // just flip the current state rather than running the snap logic.
        const wasTap = Math.abs(gesture.dy) < 6 && Math.abs(gesture.vy) < 0.1;
        if (wasTap) {
          setSheetExpanded((prev) => !prev);
          return;
        }
        const midpoint = (SHEET_COLLAPSED_HEIGHT + SHEET_EXPANDED_HEIGHT) / 2;
        const fastFlickUp = gesture.vy < -0.6;
        const fastFlickDown = gesture.vy > 0.6;
        const shouldExpand = fastFlickUp || (!fastFlickDown && currentHeightRef.current > midpoint);
        setSheetExpanded(shouldExpand);
      },
    })
  ).current;

  // The window a listing must be available for, derived from the Now/Later
  // choice above — "Now" is a point-in-time check (is this spot open right
  // this minute), "Later" is the whole planned start-to-end window.
  const availabilityWindow = useMemo(() => {
    if (searchMode === 'now') {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      return { dayOfWeek: now.getDay(), startMinutes: nowMinutes, endMinutes: nowMinutes };
    }
    const date = scheduleDays[scheduleDateOffset].date;
    return {
      dayOfWeek: date.getDay(),
      startMinutes: scheduleStartMinutes,
      endMinutes: scheduleStartMinutes + scheduleDurationMinutes,
    };
  }, [searchMode, scheduleDays, scheduleDateOffset, scheduleStartMinutes, scheduleDurationMinutes]);

  const budgetBucketDef = useMemo(
    () => BUDGET_BUCKETS.find((bucket) => bucket.key === filters.budgetBucket) ?? null,
    [filters.budgetBucket]
  );

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = listings.filter((listing) => {
      if (q && !listing.title.toLowerCase().includes(q) && !listing.address.toLowerCase().includes(q)) {
        return false;
      }
      if (budgetBucketDef) {
        const { min, max } = budgetBucketDef;
        if (listing.pricePerHour < min || (max !== null && listing.pricePerHour >= max)) return false;
      }
      if (filters.amenities.some((key) => !listing.amenities.includes(key))) return false;
      if (filters.vehicleType && !listing.vehicleTypes.includes(filters.vehicleType)) return false;
      if (!isListingAvailableForWindow(listing, availabilityWindow)) return false;
      return true;
    });

    return [...result].sort((a, b) =>
      sortMode === 'distance' ? a.distanceKm - b.distanceKm : b.rating - a.rating
    );
  }, [listings, query, filters, budgetBucketDef, sortMode, availabilityWindow]);

  // Drives the little count badge on the "Filters" button — sort isn't
  // counted here since it's an ordering preference, not something that
  // narrows the list down.
  const activeFilterCount =
    (filters.budgetBucket ? 1 : 0) + filters.amenities.length + (filters.vehicleType ? 1 : 0);

  const markers: MapMarker[] = useMemo(
    () =>
      filteredListings.map((listing) => ({
        id: listing.id,
        latitude: listing.latitude,
        longitude: listing.longitude,
        label: `${listing.currency}${listing.pricePerHour}`,
        selected: listing.id === selectedListingId,
      })),
    [filteredListings, selectedListingId]
  );

  const handleMarkerPress = (id: string) => {
    setSelectedListingId(id);
    setSheetExpanded(true);
    const index = filteredListings.findIndex((listing) => listing.id === id);
    if (index >= 0) {
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
        } catch {
          // Best-effort — scrollToIndex can throw if the list hasn't measured yet.
        }
      });
    }
  };

  const goToDetail = (listingId: string) => {
    const defaultBookingType: BookingType = searchMode === 'now' ? 'instant' : 'advance';
    // Carries the exact date/time already chosen in the "Schedule for later"
    // modal forward, so neither ListingDetail nor BookingFlow ask for it
    // again — only relevant for 'later', since 'now' always means "starts now".
    const schedule =
      searchMode === 'later'
        ? {
            dateOffset: scheduleDateOffset,
            startMinutes: scheduleStartMinutes,
            durationMinutes: scheduleDurationMinutes,
          }
        : undefined;
    navigation.navigate('ListingDetail', { listingId, defaultBookingType, schedule });
  };

  const setBudgetBucket = (key: BudgetBucket | null) => {
    setFilters((prev) => ({ ...prev, budgetBucket: prev.budgetBucket === key ? null : key }));
  };

  const toggleAmenity = (key: AmenityKey) => {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(key)
        ? prev.amenities.filter((a) => a !== key)
        : [...prev.amenities, key],
    }));
  };

  const setVehicleType = (key: VehicleType | null) => {
    setFilters((prev) => ({ ...prev, vehicleType: key }));
  };

  const clearAllFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <View style={styles.container}>
      <MapView
        latitude={currentLocation.latitude}
        longitude={currentLocation.longitude}
        zoom={14}
        markers={markers}
        userLocation={currentLocation}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Where are you headed?"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setSearchMode('now')}
            style={[styles.modeChip, searchMode === 'now' && styles.modeChipActive]}
          >
            <Ionicons
              name="flash"
              size={14}
              color={searchMode === 'now' ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text style={[styles.modeChipText, searchMode === 'now' && styles.modeChipTextActive]}>
              Now
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSearchMode('later');
              setScheduleModalVisible(true);
            }}
            style={[styles.modeChip, searchMode === 'later' && styles.modeChipActive]}
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={searchMode === 'later' ? colors.textOnPrimary : colors.textSecondary}
            />
            <Text style={[styles.modeChipText, searchMode === 'later' && styles.modeChipTextActive]}>
              {searchMode === 'later'
                ? `${scheduleDays[scheduleDateOffset].date.toLocaleDateString('en-US', {
                    weekday: 'short',
                  })} · ${minutesToTimeLabel(scheduleStartMinutes)}`
                : 'Schedule for later'}
            </Text>
          </Pressable>
        </View>

        {!locationLoading && locationSource === 'mock' && (
          <Pressable
            style={styles.locationNotice}
            onPress={locationNeedsSettings ? openLocationSettings : refreshLocation}
            hitSlop={4}
          >
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.locationNoticeText}>
              {locationError ?? 'Showing a sample location.'}{' '}
              {locationNeedsSettings ? 'Tap to open Settings.' : 'Tap to retry.'}
            </Text>
          </Pressable>
        )}
      </SafeAreaView>

      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        <View style={styles.sheetHandleArea} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
        </View>

        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleDragArea} {...panResponder.panHandlers}>
            <Text style={styles.sheetTitle}>
              {filteredListings.length} spots {searchMode === 'now' ? 'available now' : 'available then'}
            </Text>
          </View>
          <Pressable onPress={() => setFiltersModalVisible(true)} style={styles.filtersButton}>
            <Ionicons name="options-outline" size={15} color={colors.textPrimary} />
            <Text style={styles.filtersButtonText}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filtersBadge}>
                <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={filteredListings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: CARD_HEIGHT,
            offset: CARD_HEIGHT * index,
            index,
          })}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ListingCard
                title={item.title}
                photoUrl={item.photoUrl}
                distanceKm={item.distanceKm}
                address={item.address}
                pricePerHour={item.pricePerHour}
                currency={item.currency}
                rating={item.rating}
                ratingCount={item.ratingCount}
                status={item.status}
                amenities={item.amenities.map((key) => AMENITIES[key])}
                onPress={() => goToDetail(item.id)}
              />
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No spots match your filters yet.</Text>
          }
        />
      </Animated.View>

      <Modal
        visible={scheduleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setScheduleModalVisible(false)} />
        <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
          <Text style={styles.modalTitle}>When do you need parking?</Text>

          <Text style={styles.modalSectionLabel}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalDateRow}>
            {scheduleDays.map(({ offset, date }) => {
              const isActive = offset === scheduleDateOffset;
              return (
                <Pressable
                  key={offset}
                  onPress={() => setScheduleDateOffset(offset)}
                  style={[styles.modalDateChip, isActive && styles.modalDateChipActive]}
                >
                  <Text style={[styles.modalDateChipDay, isActive && styles.modalDateChipTextActive]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={[styles.modalDateChipDate, isActive && styles.modalDateChipTextActive]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.modalSectionLabel}>Start Time</Text>
          <Stepper
            label="Starts at"
            valueLabel={minutesToTimeLabel(scheduleStartMinutes)}
            onIncrement={() =>
              setScheduleStartMinutes((m) =>
                clampToStep(m + TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES)
              )
            }
            onDecrement={() =>
              setScheduleStartMinutes((m) =>
                clampToStep(m - TIME_STEP_MINUTES, MIN_MINUTES_OF_DAY, MAX_MINUTES_OF_DAY, TIME_STEP_MINUTES)
              )
            }
            canDecrement={scheduleStartMinutes > MIN_MINUTES_OF_DAY}
            canIncrement={scheduleStartMinutes < MAX_MINUTES_OF_DAY}
          />

          <View style={{ height: spacing.sm }} />

          <Stepper
            label="Duration"
            valueLabel={formatDurationLabel(scheduleDurationMinutes)}
            onIncrement={() =>
              setScheduleDurationMinutes((m) =>
                clampToStep(m + TIME_STEP_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, TIME_STEP_MINUTES)
              )
            }
            onDecrement={() =>
              setScheduleDurationMinutes((m) =>
                clampToStep(m - TIME_STEP_MINUTES, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, TIME_STEP_MINUTES)
              )
            }
            canDecrement={scheduleDurationMinutes > MIN_DURATION_MINUTES}
            canIncrement={scheduleDurationMinutes < MAX_DURATION_MINUTES}
          />

          <View style={{ height: spacing.md }} />

          <Button label="Show Available Spots" onPress={() => setScheduleModalVisible(false)} />

          <Pressable
            style={styles.modalNowLink}
            onPress={() => {
              setSearchMode('now');
              setScheduleModalVisible(false);
            }}
          >
            <Text style={styles.modalNowLinkText}>Actually, I need it now</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={filtersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setFiltersModalVisible(false)} />
        <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
          <View style={styles.filtersModalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            {activeFilterCount > 0 && (
              <Pressable onPress={clearAllFilters} hitSlop={8}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.filtersScroll}>
            <Text style={styles.modalSectionLabel}>Sort By</Text>
            <View style={styles.optionRow}>
              <SelectableChip
                label="Nearest"
                active={sortMode === 'distance'}
                onPress={() => setSortMode('distance')}
              />
              <SelectableChip
                label="Top Rated"
                active={sortMode === 'rating'}
                onPress={() => setSortMode('rating')}
              />
            </View>

            <Text style={styles.modalSectionLabel}>Budget</Text>
            <View style={styles.optionRow}>
              <SelectableChip
                label="Any"
                active={filters.budgetBucket === null}
                onPress={() => setBudgetBucket(null)}
              />
              {BUDGET_BUCKETS.map((bucket) => (
                <SelectableChip
                  key={bucket.key}
                  label={bucket.label}
                  active={filters.budgetBucket === bucket.key}
                  onPress={() => setBudgetBucket(bucket.key)}
                />
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>Amenities</Text>
            <View style={styles.optionRow}>
              {AMENITY_SELECTOR_KEYS.map((key) => (
                <SelectableChip
                  key={key}
                  label={AMENITIES[key].label}
                  icon={AMENITIES[key].icon}
                  active={filters.amenities.includes(key)}
                  onPress={() => toggleAmenity(key)}
                />
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>Vehicle Type</Text>
            <View style={styles.optionRow}>
              {VEHICLE_OPTIONS.map((option) => (
                <SelectableChip
                  key={option.label}
                  label={option.label}
                  active={filters.vehicleType === option.key}
                  onPress={() => setVehicleType(option.key)}
                />
              ))}
            </View>

            <View style={{ height: spacing.md }} />
          </ScrollView>

          <Button
            label={`Show ${filteredListings.length} Spot${filteredListings.length === 1 ? '' : 's'}`}
            onPress={() => setFiltersModalVisible(false)}
            style={styles.filtersApplyButton}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/** A single tappable option inside the Filters sheet — used for both
 * single-select rows (Sort By, Budget, Vehicle Type — the caller is
 * responsible for only letting one be active at a time) and multi-select
 * rows (Amenities — each toggles independently). */
function SelectableChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {icon && (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={14}
          color={active ? colors.textOnPrimary : colors.textSecondary}
          style={styles.chipIcon}
        />
      )}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    height: 52,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  modeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeChipTextActive: {
    color: colors.textOnPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipIcon: {
    marginRight: 4,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.textOnPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.sm,
    maxWidth: '92%',
  },
  locationNoticeText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingTop: spacing.xs,
    overflow: 'hidden',
  },
  sheetHandleArea: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceBorder,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  sheetTitleDragArea: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  filtersButtonText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  filtersBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersBadgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textOnPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  cardWrap: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.md,
    maxHeight: '88%',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalSectionLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  filtersModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearAllText: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  filtersScroll: {
    maxHeight: FILTERS_SCROLL_MAX_HEIGHT,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filtersApplyButton: {
    marginTop: spacing.md,
  },
  modalDateRow: {
    marginBottom: spacing.sm,
  },
  modalDateChip: {
    width: 56,
    height: 66,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  modalDateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalDateChipDay: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  modalDateChipDate: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalDateChipTextActive: {
    color: colors.textOnPrimary,
  },
  modalNowLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  modalNowLinkText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
});