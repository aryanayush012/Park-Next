import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { AmenityBadge } from '../../components/AmenityBadge';
import { StarRating } from '../../components/StarRating';
import { MapView } from '../../components/MapView';
import { colors, radius, spacing, typography } from '../../theme';
import { RenterHomeStackParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { AMENITIES, VEHICLE_TYPE_LABELS } from '../../data/mockData';
import { formatDurationLabel, minutesToTimeLabel, nextDays } from '../../utils/scheduling';
import { Listing } from '../../types';

type Props = NativeStackScreenProps<RenterHomeStackParamList, 'ListingDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 320;

export function ListingDetailScreen({ navigation, route }: Props) {
  const { listingId, defaultBookingType, schedule } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  // Already decided on the Home/Map search before this spot was picked — no
  // picker here, just a read-only summary of what was chosen.
  const bookingType = defaultBookingType ?? 'advance';

  useEffect(() => {
    dataSource.getListingById(listingId).then((result) => {
      if (result) setListing(result);
    });
  }, [listingId]);

  const amenities = useMemo(
    () => listing?.amenities.map((key) => AMENITIES[key]) ?? [],
    [listing]
  );

  const days = useMemo(() => nextDays(7), []);

  const scheduleSummary = useMemo(() => {
    if (bookingType === 'instant') return 'Starts now';
    if (!schedule) return 'Pick a date & time on the next step';
    const date = days[schedule.dateOffset]?.date;
    const dayLabel = date
      ? date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
      : '';
    return `${dayLabel} · ${minutesToTimeLabel(schedule.startMinutes)} · ${formatDurationLabel(
      schedule.durationMinutes
    )}`;
  }, [bookingType, schedule, days]);

  if (!listing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading spot…</Text>
      </SafeAreaView>
    );
  }

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPhotoIndex(index);
  };

  const handleBookNow = () => {
    navigation.navigate('BookingFlow', { listingId: listing.id, bookingType, schedule });
  };

  return (
    <View style={styles.container}>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {listing.photos.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={{ width: SCREEN_WIDTH, height: GALLERY_HEIGHT }}
              />
            ))}
          </ScrollView>

          <SafeAreaView style={styles.galleryOverlay} edges={['top']}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.pageBadge}>
              <Text style={styles.pageBadgeText}>
                {photoIndex + 1} / {listing.photos.length}
              </Text>
            </View>
          </SafeAreaView>

          <View style={styles.dots}>
            {listing.photos.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === photoIndex ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.address}>{listing.address}</Text>

          <View style={styles.ratingRow}>
            <StarRating rating={listing.rating} ratingCount={listing.ratingCount} size={16} />
          </View>

          <Text style={styles.price}>
            {listing.currency}
            {listing.pricePerHour}
            <Text style={styles.priceUnit}>
              /hr {listing.pricingModel === 'metered' ? '· metered' : '· flat rate'}
            </Text>
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.badgeRow}>
            {amenities.map((amenity) => (
              <AmenityBadge key={amenity.key} icon={amenity.icon as any} label={amenity.label} />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Vehicle Types Supported</Text>
          <View style={styles.badgeRow}>
            {listing.vehicleTypes.map((type) => (
              <View key={type} style={styles.vehiclePill}>
                <Text style={styles.vehiclePillText}>{VEHICLE_TYPE_LABELS[type]}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>About this spot</Text>
          <Text style={styles.description}>{listing.description}</Text>

          <Text style={styles.sectionTitle}>Location</Text>
          <MapView
            latitude={listing.latitude}
            longitude={listing.longitude}
            zoom={15}
            interactive={false}
            markers={[
              {
                id: listing.id,
                latitude: listing.latitude,
                longitude: listing.longitude,
                label: `${listing.currency}${listing.pricePerHour}`,
                selected: true,
              },
            ]}
            style={styles.mapPreview}
          />

          <Text style={styles.sectionTitle}>Booking</Text>
          <View style={styles.bookingSummary}>
            <Ionicons
              name={bookingType === 'instant' ? 'flash' : 'calendar-outline'}
              size={16}
              color={colors.primary}
            />
            <View style={styles.bookingSummaryTextWrap}>
              <Text style={styles.bookingSummaryType}>
                {bookingType === 'instant' ? 'Instant Booking' : 'Advance Booking'}
              </Text>
              <Text style={styles.bookingSummaryDetail}>{scheduleSummary}</Text>
            </View>
          </View>

          <View style={{ height: spacing.xxl }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={`Book Now · ${listing.currency}${listing.pricePerHour}/hr`}
          onPress={handleBookNow}
        />
      </View>
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
  gallery: {
    height: GALLERY_HEIGHT,
    backgroundColor: colors.surfaceElevated,
  },
  galleryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,13,18,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  pageBadge: {
    backgroundColor: 'rgba(11,13,18,0.6)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    height: 36,
    justifyContent: 'center',
  },
  pageBadgeText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  dot: {
    height: 6,
    borderRadius: radius.full,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  address: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  ratingRow: {
    marginBottom: spacing.sm,
  },
  price: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  priceUnit: {
    ...typography.body,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceBorder,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  vehiclePill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  vehiclePillText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  mapPreview: {
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  bookingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bookingSummaryTextWrap: {
    flex: 1,
  },
  bookingSummaryType: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  bookingSummaryDetail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.background,
  },
});