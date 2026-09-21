import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
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
import { EmptyState } from '../../components/EmptyState';
import { NoSpotsArt } from '../../components/NoSpotsArt';
import { ListingCard } from '../../components/ListingCard';
import { MapLayer, MapMarker, MapView } from '../../components/MapView';
import { Slider } from '../../components/Slider';
import { Stepper } from '../../components/Stepper';
import { TranslationKey, useTranslation } from '../../i18n';
import { colors, elevation, radius, spacing, typography } from '../../theme';
import { RenterHomeStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { AMENITIES, AMENITY_SELECTOR_KEYS } from '../../data/mockData';
import { AddressSuggestion, useAddressSuggestions } from '../../hooks/useaddresssuggestions';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { formatTimeFromISO, haversineDistanceKm } from '../../utils/format';
import { getAvailableOverlap, isListingAvailableForWindow } from '../../utils/listingAvailability';
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
import { AmenityKey, BookingType, GeoPoint, Listing, VehicleType } from '../../types';

type Props = NativeStackScreenProps<RenterHomeStackParamList, 'HomeMap'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED_HEIGHT = 148;
const SHEET_EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.62);
const CARD_HEIGHT = 258;
// Caps the Filters sheet's scrollable body so its "Show N Spots" button stays
// on screen even with every section (Sort/Budget/Amenities/Vehicle Type)
// visible at once, on a shorter device.
const FILTERS_SCROLL_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.5);

/**
 * The budget slider is a fixed 0–500/hr rather than being derived from the
 * listings on screen: a range that moves as you search is disorienting, and
 * a filter that silently reshapes itself is hard to trust. The top of the
 * track means "no ceiling", so spots above 500 are still reachable there.
 */
const BUDGET_MIN = 0;
const BUDGET_MAX = 500;
// 10 keeps the stops far enough apart to hit with a thumb: 50 of them across
// the track, rather than 100 at 3px each.
const BUDGET_STEP = 10;
// Product-wide search radius for "find spots near me" / a searched address —
// wider than the RPC's own 5km default because renters are expected to
// search a whole city, not just their immediate neighbourhood.
const SEARCH_RADIUS_METERS = 50000;
interface Filters {
  /**
   * Highest acceptable per-hour price, or null for no ceiling — which is
   * what the slider sitting at its top end means. There's deliberately no
   * "Any" option: the slider already expresses it.
   */
  maxPricePerHour: number | null;
  /** A listing must have every amenity in this set — empty set = no amenity requirement. */
  amenities: AmenityKey[];
  /** null = any vehicle type. */
  vehicleType: VehicleType | null;
}

const EMPTY_FILTERS: Filters = { maxPricePerHour: null, amenities: [], vehicleType: null };

/** Whether the renter is looking for a spot right now, or planning ahead for a later date/time. */
type SearchMode = 'now' | 'later';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const MAP_LAYERS: {
  value: MapLayer;
  labelKey: TranslationKey;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'standard', labelKey: 'home.layerStandard', icon: 'map-outline' },
  { value: 'satellite', labelKey: 'home.layerSatellite', icon: 'globe-outline' },
  { value: 'terrain', labelKey: 'home.layerTerrain', icon: 'triangle-outline' },
];

const VEHICLE_OPTIONS: { key: VehicleType | null; labelKey: TranslationKey }[] = [
  { key: null, labelKey: 'home.all' },
  { key: 'car', labelKey: 'vehicle.car' },
  { key: 'suv', labelKey: 'vehicle.suv' },
  { key: 'two_wheeler', labelKey: 'vehicle.two_wheeler' },
];

export function HomeMapScreen({ navigation }: Props) {
  const { t } = useTranslation();
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
  // Set once a place is picked from the search suggestions — the search bar
  // is a destination search ("where you are headed"), not a text/keyword
  // filter over listings already near you. Null means "search near me".
  const [searchLocation, setSearchLocation] = useState<GeoPoint | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // Lets the "no spots" empty state hand focus straight to the search box,
  // rather than telling someone to go and tap it themselves.
  const searchInputRef = useRef<TextInput>(null);
  const { suggestions: searchSuggestions } = useAddressSuggestions(query);
  // Clearing the box back to empty is how you say "never mind, near me again".
  useEffect(() => {
    if (query.trim().length === 0) setSearchLocation(null);
  }, [query]);
  const handleSelectSearchLocation = (suggestion: AddressSuggestion) => {
    setQuery(suggestion.label);
    setSearchLocation({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setIsSearchFocused(false);
    Keyboard.dismiss();
  };
  // What listings are actually searched around — the picked place if there
  // is one, your real position otherwise. Never `currentLocation` directly
  // once a place is picked, so a search for "Hinjewadi" while sitting in a
  // different city still centers on Hinjewadi, not on you.
  const queryCenter = searchLocation ?? currentLocation;
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'distance' | 'rating'>('distance');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [filtersModalVisible, setFiltersModalVisible] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>('standard');
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  // Incrementing token rather than a boolean: the ask is "recentre now",
  // and the same ask has to be expressible twice in a row.
  const [recenterSignal, setRecenterSignal] = useState(0);
  // Where the map itself is looking. Only the map knows — it reports back
  // whenever a pan or zoom settles.
  const [mapCenter, setMapCenter] = useState<GeoPoint | null>(null);

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

  // Guards against an out-of-order response: `currentLocation` starts on the
  // mock fallback and this re-fires once real GPS resolves (or once a place
  // is searched), so there are genuinely multiple requests in flight close
  // together. Without this, a slow response from an *earlier* request
  // landing after a newer one would silently overwrite every listing's
  // correct distance with one measured from the wrong point — the map marker
  // stays right either way (it's just the listing's own stored position),
  // only `distanceKm` would quietly revert.
  const listingsRequestId = useRef(0);
  const loadListings = useCallback(() => {
    const requestId = ++listingsRequestId.current;
    dataSource
      .getNearbyListings(queryCenter.latitude, queryCenter.longitude, SEARCH_RADIUS_METERS)
      .then((result) => {
        if (requestId === listingsRequestId.current) setListings(result);
      });
  }, [queryCenter.latitude, queryCenter.longitude]);

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

  const budgetValue = filters.maxPricePerHour ?? BUDGET_MAX;

  // `query` narrows down WHERE to search (via queryCenter, above) rather than
  // filtering listings by keyword — `listings` here is already scoped to
  // queryCenter's radius, so nothing here needs to re-check the search text.
  const filteredListings = useMemo(() => {
    const result = listings.filter((listing) => {
      if (filters.maxPricePerHour !== null && listing.pricePerHour > filters.maxPricePerHour) {
        return false;
      }
      if (filters.amenities.some((key) => !listing.amenities.includes(key))) return false;
      if (filters.vehicleType && !listing.vehicleTypes.includes(filters.vehicleType)) return false;
      if (!isListingAvailableForWindow(listing, availabilityWindow)) return false;
      return true;
    });

    return [...result].sort((a, b) =>
      sortMode === 'distance' ? a.distanceKm - b.distanceKm : b.rating - a.rating
    );
  }, [listings, filters, sortMode, availabilityWindow]);

  // Drives the little count badge on the "Filters" button — sort isn't
  // counted here since it's an ordering preference, not something that
  // narrows the list down.
  const activeFilterCount =
    (filters.maxPricePerHour !== null ? 1 : 0) +
    filters.amenities.length +
    (filters.vehicleType ? 1 : 0);

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

  /**
   * Whether the map is still framed on the person using it.
   *
   * 60m rather than an exact match: GPS drifts, Leaflet's centre comes back
   * with float error, and a recentre animation lands a hair off. Too tight
   * and the dot flickers while standing still; too loose and a real pan
   * down the street would not clear it.
   *
   * Null centre means the map has not reported in yet — it opens on the
   * user's location, so treat that as centred rather than flashing hollow
   * on first paint.
   */
  const isOnMyLocation =
    !mapCenter || haversineDistanceKm(mapCenter, currentLocation) * 1000 < 60;

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

  /**
   * A line for spots that can only take part of the requested window, e.g.
   * asking 4–6pm at a spot that closes at 5. Blank for a full match, and for
   * an instant search, which is a point in time with nothing to trim.
   */
  const partialNote = (listing: Listing): string | undefined => {
    if (searchMode !== 'later') return undefined;
    const overlap = getAvailableOverlap(listing, availabilityWindow);
    if (!overlap) return undefined;
    if (
      overlap.startMinutes === availabilityWindow.startMinutes &&
      overlap.endMinutes === availabilityWindow.endMinutes
    ) {
      return undefined;
    }
    return t('home.partialMatch', {
      start: minutesToTimeLabel(overlap.startMinutes),
      end: minutesToTimeLabel(overlap.endMinutes),
    });
  };

  // A live booking (someone else's instant book, most likely) already covers
  // this exact moment — an instant book here would be rejected server-side
  // by the `bookings_no_overlap` constraint, so say so up front instead of
  // letting a renter find out only after tapping through. Only meaningful
  // for "now": a "later" search asks about a different, specific window,
  // which `partialNote`/`isListingAvailableForWindow` above already handle
  // against the listing's own opening hours (just not other people's
  // bookings within that future window yet — a separate, smaller gap).
  const isOccupiedNow = (listing: Listing) => searchMode === 'now' && !!listing.occupiedUntil;
  const occupiedNote = (listing: Listing): string | undefined =>
    isOccupiedNow(listing)
      ? t('card.occupiedUntil', { time: formatTimeFromISO(listing.occupiedUntil as string) })
      : undefined;

  const goToDetail = (listingId: string) => {
    // Trim the requested window to what this particular spot can take, so
    // Listing Detail and Booking Flow are pre-filled with a window that can
    // actually be booked rather than one that will be rejected.
    const listing = listings.find((item) => item.id === listingId);
    const overlap = listing ? getAvailableOverlap(listing, availabilityWindow) : null;
    // An instant book on an occupied-right-now listing would just be
    // rejected server-side (`bookings_no_overlap`) — go straight to Advance
    // Booking instead of the dead-end "Book Now" a plain 'now' search would
    // otherwise default to.
    const defaultBookingType: BookingType =
      searchMode === 'now' && !(listing && isOccupiedNow(listing)) ? 'instant' : 'advance';
    // Carries the exact date/time already chosen in the "Schedule for later"
    // modal forward, so neither ListingDetail nor BookingFlow ask for it
    // again — only relevant for 'later', since 'now' always means "starts now".
    const schedule =
      searchMode === 'later'
        ? {
            dateOffset: scheduleDateOffset,
            startMinutes: overlap?.startMinutes ?? scheduleStartMinutes,
            durationMinutes: overlap
              ? overlap.endMinutes - overlap.startMinutes
              : scheduleDurationMinutes,
          }
        : undefined;
    navigation.navigate('ListingDetail', { listingId, defaultBookingType, schedule });
  };

  const setMaxPrice = (next: number) => {
    setFilters((prev) => ({
      ...prev,
      // At the top of the track there is no ceiling at all, so store null
      // rather than 500 — that keeps the filter count honest and still
      // shows spots priced above the slider maximum.
      maxPricePerHour: next >= BUDGET_MAX ? null : next,
    }));
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
        latitude={queryCenter.latitude}
        longitude={queryCenter.longitude}
        zoom={14}
        markers={markers}
        userLocation={currentLocation}
        mapLayer={mapLayer}
        recenterSignal={recenterSignal}
        onCenterChanged={setMapCenter}
        onMarkerPress={handleMarkerPress}
        style={StyleSheet.absoluteFill}
      />

      {/* Map controls sit just above the listings sheet and ride with it:
          `sheetHeight` is the same Animated.Value that drives the sheet, so
          they track it through a drag rather than jumping once it settles.
          Anchored from the bottom, so the layer picker opens upward into
          free map instead of underneath the sheet. */}
      <Animated.View
        style={[styles.mapControls, { bottom: Animated.add(sheetHeight, spacing.sm) }]}
        pointerEvents="box-none"
      >
        {layerPickerOpen ? (
          <View style={styles.layerPicker}>
            {MAP_LAYERS.map((option) => {
              const isActive = option.value === mapLayer;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setMapLayer(option.value);
                    setLayerPickerOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [
                    styles.layerOption,
                    isActive && styles.layerOptionActive,
                    pressed && styles.layerOptionPressed,
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.layerLabel, isActive && styles.layerLabelActive]}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Pressable
          onPress={() => setLayerPickerOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={t('home.mapLayers')}
          accessibilityState={{ expanded: layerPickerOpen }}
          style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}
        >
          <Ionicons
            name="layers-outline"
            size={20}
            color={layerPickerOpen ? colors.primary : colors.textPrimary}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            // Clear a searched destination too: "my location" means mine,
            // not the last place that was looked up.
            setSearchLocation(null);
            setQuery('');
            setLayerPickerOpen(false);
            if (locationSource === 'mock') refreshLocation();
            setRecenterSignal((n) => n + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('home.myLocation')}
          style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}
        >
          {/* The crosshair is always the outline glyph and the centre dot is
              drawn on top, rather than swapping to Ionicons' filled
              `locate`: the two glyphs are near-identical, so the filled one
              reads as no change at all. An explicit dot appearing inside
              the ring is the unmistakable signal. */}
          <View style={styles.locateIcon}>
            <Ionicons
              name="locate-outline"
              size={20}
              color={isOnMyLocation ? colors.primary : colors.textPrimary}
            />
            {isOnMyLocation ? <View style={styles.locateDot} /> : null}
          </View>
        </Pressable>
      </Animated.View>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                // A suggestion tap blurs the input a beat before its own
                // onPress fires — hiding the list immediately would unmount
                // the row out from under that tap. Same pattern as the
                // address field in AddListingDetailsScreen.
                setTimeout(() => setIsSearchFocused(false), 150);
              }}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>
          {isSearchFocused && searchSuggestions.length > 0 ? (
            <View style={styles.searchSuggestionsBox}>
              {searchSuggestions.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectSearchLocation(item)}
                  style={({ pressed }) => [
                    styles.searchSuggestionRow,
                    pressed && styles.searchSuggestionRowPressed,
                  ]}
                >
                  <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.searchSuggestionText} numberOfLines={2}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
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
              {t('home.now')}
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
                : t('home.scheduleLater')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFiltersModalVisible(true)}
            style={[styles.modeChip, styles.filtersChip]}
          >
            <Ionicons name="options-outline" size={20} color={colors.textSecondary} />
            {/* <Text style={styles.modeChipText}>{t('home.filters')}</Text> */}
            {activeFilterCount > 0 && (
              <View style={styles.filtersBadge}>
                <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {!locationLoading && locationSource === 'mock' && (
          <Pressable
            style={({ pressed }) => [
              styles.locationNotice,
              pressed && styles.locationNoticePressed,
            ]}
            onPress={locationNeedsSettings ? openLocationSettings : refreshLocation}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.locationUnavailable')} ${
              locationNeedsSettings ? t('home.tapToFetch') : t('home.tapRetry')
            }`}
            hitSlop={4}
          >
            <View style={styles.locationNoticeIcon}>
              <Ionicons name="location-sharp" size={22} color={colors.primary} />
            </View>
            <View style={styles.locationNoticeText}>
              <Text style={styles.locationNoticeTitle}>{t('home.locationUnavailable')}</Text>
              <Text style={styles.locationNoticeBody}>
                {locationNeedsSettings ? t('home.tapToFetch') : t('home.tapRetry')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
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
              {t(
                searchMode === 'now' ? 'home.spotsAvailableNow' : 'home.spotsAvailableThen',
                { count: filteredListings.length }
              )}
            </Text>
          </View>
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
                note={isOccupiedNow(item) ? occupiedNote(item) : partialNote(item)}
                occupied={isOccupiedNow(item)}
                onScheduleInstead={() => goToDetail(item.id)}
                onPress={() => goToDetail(item.id)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              compact
              icon="search-outline"
              art={<NoSpotsArt size={132} />}
              title={t('home.noSpots')}
              body={t('home.noSpotsBody')}
              action={{
                label: t('home.tryAnotherLocation'),
                onPress: () => {
                  // Drop the sheet first: expanded it covers most of the
                  // screen, and the keyboard is about to want that space.
                  setSheetExpanded(false);
                  searchInputRef.current?.focus();
                },
              }}
            />
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
          <Text style={styles.modalTitle}>{t('home.whenNeeded')}</Text>

          <Text style={styles.modalSectionLabel}>{t('home.date')}</Text>
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

          <Text style={styles.modalSectionLabel}>{t('home.startTime')}</Text>
          <Stepper
            label={t('common.startsAt')}
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
            edit={{
              kind: 'time',
              minutes: scheduleStartMinutes,
              min: MIN_MINUTES_OF_DAY,
              max: MAX_MINUTES_OF_DAY,
              onChange: setScheduleStartMinutes,
            }}
          />

          <View style={{ height: spacing.sm }} />

          <Stepper
            label={t('common.duration')}
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
            edit={{
              kind: 'duration',
              minutes: scheduleDurationMinutes,
              min: MIN_DURATION_MINUTES,
              max: MAX_DURATION_MINUTES,
              onChange: setScheduleDurationMinutes,
            }}
          />

          <View style={{ height: spacing.md }} />

          <Button label={t('home.showSpots')} onPress={() => setScheduleModalVisible(false)} />

          <Pressable
            style={styles.modalNowLink}
            onPress={() => {
              setSearchMode('now');
              setScheduleModalVisible(false);
            }}
          >
            <Text style={styles.modalNowLinkText}>{t('home.needItNow')}</Text>
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
            <Text style={styles.modalTitle}>{t('home.filters')}</Text>
            {activeFilterCount > 0 && (
              <Pressable onPress={clearAllFilters} hitSlop={8}>
                <Text style={styles.clearAllText}>{t('home.clearAll')}</Text>
              </Pressable>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.filtersScroll}>
            <Text style={styles.modalSectionLabel}>{t('home.sortBy')}</Text>
            <View style={styles.optionRow}>
              <SelectableChip
                label={t('home.nearest')}
                active={sortMode === 'distance'}
                onPress={() => setSortMode('distance')}
              />
              <SelectableChip
                label={t('home.topRated')}
                active={sortMode === 'rating'}
                onPress={() => setSortMode('rating')}
              />
            </View>

            <View style={styles.budgetHeader}>
              <Text style={styles.modalSectionLabel}>{t('home.budget')}</Text>
              <Text style={styles.budgetValue}>
                {t('home.upTo', { currency: '₹', price: budgetValue })}
              </Text>
            </View>
            <Slider
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              value={budgetValue}
              onChange={setMaxPrice}
              accessibilityLabel={t('home.budget')}
            />

            <Text style={styles.modalSectionLabel}>{t('detail.amenities')}</Text>
            <View style={styles.optionRow}>
              {AMENITY_SELECTOR_KEYS.map((key) => (
                <SelectableChip
                  key={key}
                  label={t(`amenity.${key}`)}
                  icon={AMENITIES[key].icon}
                  active={filters.amenities.includes(key)}
                  onPress={() => toggleAmenity(key)}
                />
              ))}
            </View>

            <Text style={styles.modalSectionLabel}>{t('home.vehicleType')}</Text>
            <View style={styles.optionRow}>
              {VEHICLE_OPTIONS.map((option) => (
                <SelectableChip
                  key={option.labelKey}
                  label={t(option.labelKey)}
                  active={filters.vehicleType === option.key}
                  onPress={() => setVehicleType(option.key)}
                />
              ))}
            </View>

            <View style={{ height: spacing.md }} />
          </ScrollView>

          <Button
            label={t('home.showSpotsCount', { count: filteredListings.length })}
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
  mapControls: {
    position: 'absolute',
    // `bottom` is supplied at render time from the sheet's animated height.
    right: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  locateIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Sits inside the crosshair's own ring, so it reads as the ring filling
   *  in rather than as a separate badge stuck on the icon. */
  locateDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  mapButtonPressed: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary,
  },
  layerPicker: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xxs,
    gap: 2,
    ...elevation.card,
  },
  layerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  layerOptionActive: {
    backgroundColor: colors.primaryMuted,
  },
  layerOptionPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  layerLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  layerLabelActive: {
    color: colors.primary,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  searchBarWrap: {
    position: 'relative',
    zIndex: 20,
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
  searchSuggestionsBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 8,
  },
  searchSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  searchSuggestionRowPressed: {
    backgroundColor: colors.surface,
  },
  searchSuggestionText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  filtersChip: {
    // Pushed to the end of the row, so the date pill can grow without
    // shunting it around.
    marginLeft: 'auto',
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
  /* Without a location this screen cannot do its one job, so this stops
     being a status chip and becomes the screen's primary action. Dark fill
     rather than an amber wash: the amber is spent on the border, the icon
     and the glow, which leaves the white headline as the brightest thing
     in it — an amber-on-amber card buries its own text. */
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
    ...elevation.glowAmbient,
  },
  locationNoticePressed: {
    backgroundColor: colors.surfaceElevated,
  },
  locationNoticeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 166, 35, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationNoticeText: {
    // Takes the middle so the disc and the chevron stay pinned to the ends.
    flex: 1,
  },
  locationNoticeTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  locationNoticeBody: {
    // A step below `body`: this is the explanation under the headline, and
    // at the same size the two lines competed instead of reading as one
    // title-and-detail pair. It also keeps the line from wrapping to three
    // on a narrow screen.
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
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
  filtersBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
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
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  budgetValue: {
    ...typography.bodyMedium,
    color: colors.primary,
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