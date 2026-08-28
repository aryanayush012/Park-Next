import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { AMENITIES } from '../../data/mockData';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
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
import { BookingType, Listing, VehicleType } from '../../types';

type Props = NativeStackScreenProps<RenterHomeStackParamList, 'HomeMap'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_HEIGHT = 148;
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.62);
const CARD_HEIGHT = 258;

interface Filters {
  budgetFriendly: boolean;
  nearby: boolean;
  evCharging: boolean;
  vehicleType: VehicleType | null;
}

/** Whether the renter is looking for a spot right now, or planning ahead for a later date/time. */
type SearchMode = 'now' | 'later';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const VEHICLE_CYCLE: VehicleType[] = ['car', 'suv', 'two_wheeler'];
const VEHICLE_LABEL: Record<VehicleType, string> = {
  car: 'Car',
  suv: 'SUV',
  two_wheeler: '2-Wheeler',
};

export function HomeMapScreen({ navigation }: Props) {
  const {
    location: currentLocation,
    source: locationSource,
    loading: locationLoading,
    error: locationError,
    refresh: refreshLocation,
  } = useCurrentLocation();
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({
    budgetFriendly: false,
    nearby: false,
    evCharging: false,
    vehicleType: null,
  });
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'distance' | 'rating'>('distance');
  const [sheetExpanded, setSheetExpanded] = useState(false);

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

  useEffect(() => {
    dataSource.getListings().then(setListings);
  }, []);

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

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = listings.filter((listing) => {
      if (q && !listing.title.toLowerCase().includes(q) && !listing.address.toLowerCase().includes(q)) {
        return false;
      }
      if (filters.budgetFriendly && listing.pricePerHour > 35) return false;
      if (filters.nearby && listing.distanceKm > 1.5) return false;
      if (filters.evCharging && !listing.amenities.includes('ev_charging')) return false;
      if (filters.vehicleType && !listing.vehicleTypes.includes(filters.vehicleType)) return false;
      if (!isListingAvailableForWindow(listing, availabilityWindow)) return false;
      return true;
    });

    return [...result].sort((a, b) =>
      sortMode === 'distance' ? a.distanceKm - b.distanceKm : b.rating - a.rating
    );
  }, [listings, query, filters, sortMode, availabilityWindow]);

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

  const toggleFilter = (key: keyof Omit<Filters, 'vehicleType'>) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cycleVehicleType = () => {
    setFilters((prev) => {
      if (!prev.vehicleType) return { ...prev, vehicleType: VEHICLE_CYCLE[0] };
      const currentIndex = VEHICLE_CYCLE.indexOf(prev.vehicleType);
      const nextIndex = currentIndex + 1;
      return { ...prev, vehicleType: nextIndex < VEHICLE_CYCLE.length ? VEHICLE_CYCLE[nextIndex] : null };
    });
  };

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

        <View style={styles.chipsRow}>
          <FilterChip
            label="Budget (≤ ₹35/hr)"
            active={filters.budgetFriendly}
            onPress={() => toggleFilter('budgetFriendly')}
          />
          <FilterChip
            label="Nearby (≤ 1.5 km)"
            active={filters.nearby}
            onPress={() => toggleFilter('nearby')}
          />
          <FilterChip
            label={AMENITIES.ev_charging.label}
            active={filters.evCharging}
            onPress={() => toggleFilter('evCharging')}
          />
          <FilterChip
            label={filters.vehicleType ? VEHICLE_LABEL[filters.vehicleType] : 'Vehicle Type'}
            active={Boolean(filters.vehicleType)}
            onPress={cycleVehicleType}
          />
        </View>

        {!locationLoading && locationSource === 'mock' && (
          <Pressable style={styles.locationNotice} onPress={refreshLocation} hitSlop={4}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.locationNoticeText}>
              {locationError ?? 'Showing a sample location.'} Tap to retry.
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
          <Pressable
            onPress={() => setSortMode((prev) => (prev === 'distance' ? 'rating' : 'distance'))}
            style={styles.sortToggle}
          >
            <Text style={styles.sortToggleText}>
              {sortMode === 'distance' ? 'Nearest' : 'Top rated'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
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
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
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
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
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