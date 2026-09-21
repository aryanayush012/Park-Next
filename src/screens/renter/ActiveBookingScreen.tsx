import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { BrandFooter } from '../../components/BrandFooter';
import { BookingConfirmedOverlay } from '../../components/BookingConfirmedOverlay';
import { PinLoader } from '../../components/PinLoader';
import { WaitingPinArt } from '../../components/WaitingPinArt';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrivalCode } from '../../components/ArrivalCode';
import { Button } from '../../components/Button';
import { DataColumns } from '../../components/DataColumns';
import { GoogleMapsIcon } from '../../components/GoogleMapsIcon';
import { MapView } from '../../components/MapView';
import { StarRating } from '../../components/StarRating';
import { StarRatingInput } from '../../components/StarRatingInput';
import { StatusBadge } from '../../components/StatusBadge';
import { useTranslation } from '../../i18n';
import { colors, fontFamily, radius, spacing, typography } from '../../theme';
import { SharedBookingParamList } from '../../navigation/types';
import { dataSource } from '../../data/dataSource';
import { useAuth } from '../../navigation/AuthContext';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import {
  bookingStatusToBadgeStatus,
  formatDateTimeRange,
  formatElapsedClock,
  formatRelativeDate,
  formatTimeFromISO,
  formatTimeRangeShort,
  haversineDistanceKm,
  estimateDrivingMinutes,
} from '../../utils/format';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';
import { openDirectionsInMaps } from '../../utils/maps';
import { expireIfNoShow } from '../../utils/noShow';
import { autoCheckoutIfOverLimit, isOverOvertimeCap } from '../../utils/overtimeAutoCheckout';
import { computeOvertimeBilling, OVERTIME_RATE_MULTIPLIER } from '../../utils/overtimeBilling';
import {
  cancelBookingEndingSoonReminder,
  scheduleBookingEndingSoonReminder,
} from '../../utils/notifications';
import { Booking, Listing, RenterProfile, Review } from '../../types';
import { IconActionButton } from '../../components/IconActionButton';

type Props = NativeStackScreenProps<SharedBookingParamList, 'ActiveBooking'>;

// How often to re-check the booking while waiting for the host to enter the
// arrival code — cheap enough to poll, and this is the only signal the
// renter's screen has that the host has confirmed (see mock-data-source
// caveat: on two separate physical devices this only works once a real
// backend is connected, since the in-memory mock store is per app instance).
const ARRIVAL_POLL_MS = 3000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
// Comfortably shorter than `renewOverdueBooking`'s own 15-minute buffer, so
// each re-check renews well before the previous buffer would actually run
// out — the two numbers live in different files (this is the UI's polling
// cadence, that's the server-side grace period) on purpose, matching every
// other poll-interval/deadline pair already in this file. Also what this
// screen checks the overtime cap on — 1 minute rather than something closer
// to the 15-minute buffer margin, since crossing the cap should flip the
// booking to `completed` promptly, not up to several minutes late (billing
// itself is capped regardless via `computeOvertimeBilling`, so this is
// purely about how quickly the status visibly catches up).
const RENEWAL_CHECK_MS = 60 * 1000;
// An advance booking's arrival code is deliberately hidden until close to
// the booking's own start time — showing it the instant the booking is
// confirmed (which could be hours or days early) would let a renter show up
// and check in well before their actual slot. A short grace window before
// the literal start time is allowed so someone arriving a few minutes early
// isn't blocked from checking in right at the door.
const EARLY_ARRIVAL_CODE_REVEAL_MS = 15 * 60 * 1000;

/**
 * A zoom level that keeps both the car and the spot roughly in frame,
 * chosen from how far apart they are.
 *
 * Deliberately a lookup table rather than Leaflet's own fitBounds. Fitting
 * needs the map container's real pixel size, which only exists inside the
 * WebView, and driving the camera from out here through that boundary was
 * the source of a long tail of framing bugs. A booking is nearly always a
 * few kilometres away, so a handful of distance bands is both predictable
 * and good enough — and it cannot silently collapse the way a fit can.
 */
function zoomForDistance(km: number): number {
  if (km < 1) return 14;
  if (km < 3) return 13;
  if (km < 7) return 12;
  if (km < 15) return 11;
  if (km < 40) return 10;
  if (km < 120) return 8;
  return 6;
}

export function ActiveBookingScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { bookingId, justBooked = false } = route.params;
  const { userId } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [host, setHost] = useState<RenterProfile | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [myReview, setMyReview] = useState<Review | null | undefined>(undefined);
  const [ratingInput, setRatingInput] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  // While a finger is down on the map, the page stops scrolling so the map
  // can pan — see `MapView`'s `onTouchActiveChange`.
  const [mapPanning, setMapPanning] = useState(false);
  // Held in state, not read from the route param directly, so the
  // celebration plays exactly once — a re-render (or coming back to this
  // screen) must not replay it.
  const [celebrating, setCelebrating] = useState(justBooked);
  const { location: currentLocation } = useCurrentLocation();

  useEffect(() => {
    dataSource.getBookingById(bookingId).then(async (result) => {
      if (!result) return;
      // Lazily flips a missed booking to `no_show` the moment this screen
      // (re)loads it past the booking's own end time with no check-in —
      // see utils/noShow.ts. A no-op on anything else.
      const settled = await expireIfNoShow(result);
      setBooking(settled);
      const relatedListing = await dataSource.getListingById(settled.listingId);
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

  // Keeps `endTime` from falling behind reality while checked in and running
  // over the originally booked time — see `DataSource.renewOverdueBooking`'s
  // own doc comment for why this matters (both the DB's overlap guard and
  // the listing-search "occupied right now" check key off `endTime`, and
  // neither one otherwise knows the renter is still actually there). Checks
  // immediately whenever the booking becomes overdue (covers reopening this
  // screen on an already-overdue booking, not just staying on it live), then
  // re-checks every few minutes for as long as it remains overdue — UNLESS
  // it's run over `OVERTIME_CAP_MINUTES`, in which case this auto-closes the
  // booking instead of renewing it any further (`autoCheckoutIfOverLimit`).
  // A delay isn't allowed to run forever just because grace keeps renewing.
  useEffect(() => {
    if (!booking || booking.status !== 'in_progress') return;
    let cancelled = false;
    const renewOrAutoCheckout = async () => {
      if (cancelled) return;
      if (Date.now() <= new Date(booking.endTime).getTime()) return;
      const updated = isOverOvertimeCap(booking)
        ? await autoCheckoutIfOverLimit(booking).catch(() => null)
        : await dataSource.renewOverdueBooking(booking.id).catch((error) => {
            // Was silent — same "indistinguishable from not having run yet"
            // gap `autoCheckoutIfOverLimit` had until a real 23P01 conflict
            // turned up hidden behind it.
            console.warn('[ActiveBookingScreen] renewOverdueBooking failed', error);
            return null;
          });
      if (updated && !cancelled) setBooking(updated);
    };
    renewOrAutoCheckout();
    const interval = setInterval(renewOrAutoCheckout, RENEWAL_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [booking?.status, booking?.id, booking?.endTime]);

  // Waiting for the host to enter the renter's arrival code on their own
  // Booking Detail screen — poll for the status flip instead of a
  // self-service "I've Arrived" button.
  useEffect(() => {
    if (booking?.status !== 'booked') return;
    const poll = setInterval(async () => {
      const latest = await dataSource.getBookingById(bookingId);
      if (!latest) return;
      // Catches a no-show even if this screen is just sitting open past the
      // booking's end time — same lazy transition as the initial fetch.
      const settled = await expireIfNoShow(latest);
      if (settled.status !== 'booked') {
        setBooking(settled);
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
    dataSource.getBookingById(bookingId).then(async (latest) => {
      if (!latest) return;
      setBooking(await expireIfNoShow(latest));
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
      setReviewSubmitError(err instanceof Error ? err.message : t('common.tryAgain'));
    } finally {
      setSubmittingReview(false);
    }
  };

  // Same object-identity care as Booking Confirmation: MapView re-fits its
  // bounds whenever `route` changes by reference, and an inline literal
  // would hand it a new one on every render — including the renders
  // `onRouteResolved` itself causes.

  const handleCancelRequest = async () => {
    setIsCancelling(true);
    try {
      const updated = await dataSource.cancelBooking(bookingId);
      setBooking(updated);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleBrowseOtherSpots = () => {
    navigation.popToTop();
  };

  if (!booking || !listing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <PinLoader label={t('common.loadingBooking')} />
      </SafeAreaView>
    );
  }

  const canGoBack = navigation.canGoBack();

  // Ported from the old Booking Confirmation screen, which this screen
  // replaced: a booking's whole life now lives in one place, so the states
  // before it is accepted have to live here too.
  if (booking.status === 'pending') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader onBack={canGoBack ? () => navigation.goBack() : undefined} />
        <ScrollView
          contentContainerStyle={styles.centeredStateContent}
          showsVerticalScrollIndicator={false}
        >
          <WaitingPinArt />

          {/* Two-tone: the plain half states the situation, the amber half
              names what is actually being waited on. */}
          <Text style={styles.waitingTitle}>
            {t('confirm.waitingFor')} <Text style={styles.waitingTitleAccent}>{t('confirm.hostApproval')}</Text>
          </Text>
          <Text style={styles.waitingBody}>{t('confirm.requestSent')}</Text>
          <Text style={styles.waitingBody}>
            {t('confirm.hostRespondsBy')}{' '}
            <Text style={styles.waitingBodyAccent}>
              {formatTimeFromISO(booking.responseDeadline)}
            </Text>
          </Text>

          <View style={[styles.card, styles.stretchCard]}>
            <View style={styles.spotRow}>
              {listing.photos[0] ? (
                <Image source={{ uri: listing.photos[0] }} style={styles.pendingThumb} />
              ) : (
                <View style={[styles.pendingThumb, styles.spotThumbEmpty]}>
                  <Ionicons name="car-outline" size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.spotTextBlock}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {listing.title}
                </Text>
                <View style={styles.spotAddressRow}>
                  <Ionicons name="location-sharp" size={13} color={colors.textSecondary} style={{marginTop: 3}}/>
                  <Text style={styles.spotAddress} numberOfLines={2}>
                    {listing.address}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Label stacked over value: a date range is too long to sit
                opposite its own label on one line. */}
            <View style={styles.pendingFactRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <View style={styles.pendingFactText}>
                <Text style={styles.pendingFactLabel}>{t('common.dateTime')}</Text>
                <Text style={styles.pendingFactValue}>
                  {formatDateTimeRange(booking.startTime, booking.endTime)}
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <SummaryRow
              icon="card-outline"
              label={
                booking.pricingModel === 'metered'
                  ? t('common.estimatedTotal')
                  : t('common.totalPrice')
              }
              value={`${listing.currency}${booking.totalPrice}`}
              highlight
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={t('confirm.cancelRequest')}
            variant="secondary"
            onPress={handleCancelRequest}
            loading={isCancelling}
          />
        </View>
        <BrandFooter height={84} />
      </SafeAreaView>
    );
  }

  if (
    booking.status === 'declined' ||
    booking.status === 'expired' ||
    booking.status === 'cancelled'
  ) {
    const isCancelledByMe = booking.status === 'cancelled';
    const isDeclined = booking.status === 'declined';
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader onBack={canGoBack ? () => navigation.goBack() : undefined} />
        <View style={styles.centeredStateContent}>
          <View style={styles.declinedIconWrap}>
            <Ionicons name="close" size={26} color={colors.error} />
          </View>
          <Text style={styles.stateTitle}>
            {isCancelledByMe
              ? t('confirm.requestCancelled')
              : isDeclined
              ? t('confirm.requestDeclined')
              : "Host didn't respond in time"}
          </Text>
          <Text style={styles.stateSubtitle}>
            {isCancelledByMe
              ? `You cancelled your request for ${listing.title}.`
              : isDeclined
              ? `The host isn't able to accept your request for ${listing.title}. You haven't been charged — try another spot.`
              : `The host for ${listing.title} didn't respond to your request in time. You haven't been charged — try another spot.`}
          </Text>
        </View>

        <View style={styles.footer}>
          <Button label={t('confirm.browseOther')} onPress={handleBrowseOtherSpots} />
        </View>
        <BrandFooter height={84} />
      </SafeAreaView>
    );
  }

  const scheduledEndMs = new Date(booking.endTime).getTime();
  const remainingMs = Math.max(0, scheduledEndMs - now);
  // Counts UP once overdue, instead of the countdown just sitting at 0:00
  // with nothing to show for however long the renter's actually stayed over.
  const overtimeElapsedMs = Math.max(0, now - scheduledEndMs);
  const isOverdue = now > scheduledEndMs;
  const isEndingSoon = remainingMs <= TEN_MINUTES_MS;

  // Live running total while still checked in — same formula `checkOut`
  // bills the final charge with (utils/overtimeBilling.ts), just evaluated
  // "as of right now" instead of the real checkout moment, so the estimate
  // already reflects the 2x overtime rate the instant it starts accruing
  // rather than jumping only once the renter actually leaves.
  const liveBilling = booking.checkInAt
    ? computeOvertimeBilling({
        pricingModel: booking.pricingModel,
        pricePerHour: listing.pricePerHour,
        checkInAt: booking.checkInAt,
        scheduledEndTime: booking.endTime,
        flatTotal: booking.totalPrice,
        asOf: now,
      })
    : null;
  // Once `completed`, `booking.totalPrice`/`overtimeMinutes` are the
  // authoritative, already-final figures `checkOut` stored — recomputing
  // "as of now" here would be wrong, since real time has kept moving past
  // the actual checkout moment.
  const currentEstimate = booking.status === 'completed' ? booking.totalPrice : liveBilling?.total ?? booking.totalPrice;
  const overtimeMinutes =
    booking.status === 'completed' ? booking.overtimeMinutes ?? 0 : liveBilling?.overtimeMinutes ?? 0;
  const overtimeCost = Math.round((overtimeMinutes / 60) * listing.pricePerHour * OVERTIME_RATE_MULTIPLIER);

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
    setExtendError(null);
    try {
      const updated = await dataSource.extendBooking(booking.id, extraMinutes);
      setBooking({ ...updated });
      // A successful extension is also the next thing a listing search
      // picks up automatically — `occupied_until` (0020/0022) is computed
      // live from `end_at`, so nothing else here needs to change for that.
    } catch (err) {
      // Most likely the `bookings_no_overlap` conflict — the DB/mock layer
      // already turns that into the friendly message below rather than a
      // raw constraint error; anything else falls back to a generic one.
      setExtendError(err instanceof Error ? err.message : t('common.tryAgain'));
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

  // Prefer the real routed numbers once OSRM answers; fall back to a
  // straight-line estimate so the row isn't blank while that's in flight.
  // Straight-line distance and a rough drive time from it. Previously this
  // preferred a routing service's own numbers; with no route drawn there is
  // nothing to ask, and an as-the-crow-flies figure is honest for a "how
  // far is it" line.
  const distanceKm = listing ? haversineDistanceKm(currentLocation, listing) : 0;
  const distanceMinutes = estimateDrivingMinutes(distanceKm);

  const handleShare = () => {
    if (!listing) return;
    // Best-effort: a dismissed sheet rejects on some Android builds, and a
    // cancelled share is not an error worth surfacing.
    Share.share({
      message: t('confirm.shareMessage', {
        title: listing.title,
        address: listing.address,
        code: booking?.verificationCode ?? '—',
        time: formatDateTimeRange(booking?.startTime ?? '', booking?.endTime ?? ''),
      }),
    }).catch(() => {});
  };

  const handleContactHost = () => {
    if (host?.phone) {
      Linking.openURL(`tel:${host.phone}`).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        action={
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel={t('confirm.share')}
            style={({ pressed }) => [styles.sharePill, pressed && styles.sharePillPressed]}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.shareLabel}>{t('confirm.share')}</Text>
          </Pressable>
        }
      />
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!mapPanning}
      >
        <View style={styles.badgeRow}>
          <StatusBadge status={bookingStatusToBadgeStatus(booking.status)} />
        </View>

        {booking.status === 'booked' ? (
          canRevealArrivalCode ? (
            <View style={styles.centerBlock}>
              <Text style={styles.stateTitle}>{t('active.onYourWay')}</Text>
              <Text style={styles.stateSubtitle}>
                Show this code to the host when you arrive at {listing.title}. 
              </Text>
              <ArrivalCode
                code={booking.verificationCode}
                label={t('active.arrivalCode')}
                hint={t('confirm.showAtEntry')}
                copyLabel={t('confirm.copyCode')}
                style={styles.arrivalCode}
              />
              {/* <View style={styles.waitingRow}>
                <ActivityIndicator color={colors.secondary} />
                <Text style={styles.waitingText}>{t('active.waitingHost')}</Text>
              </View> */}
            </View>
          ) : (
            <View style={styles.centerBlock}>
              <Ionicons name="time-outline" size={40} color={colors.secondary} />
              <Text style={styles.stateTitle}>{t('active.notStarted')}</Text>
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
            <Text style={[styles.timerLabel, isOverdue && styles.timerLabelOverdue]}>
              {isOverdue ? t('active.timesUp') : t('active.timeRemaining')}
            </Text>
            <View style={[styles.timerRing, isOverdue && styles.timerRingOverdue]}>
              <Text style={[styles.timerText, isOverdue && styles.timerTextOverdue]}>
                {isOverdue ? `+${formatElapsedClock(overtimeElapsedMs)}` : formatElapsedClock(remainingMs)}
              </Text>
            </View>
            {isOverdue ? (
              <Text style={styles.overtimeCostNote}>
                {t('active.overtimeAccruing', { cost: `${listing.currency}${overtimeCost}` })}
              </Text>
            ) : null}
            {isEndingSoon ? (
              <View style={[styles.endingSoonCard, isOverdue && styles.endingSoonCardOverdue]}>
                <View style={styles.endingSoonHeader}>
                  <Ionicons
                    name="notifications"
                    size={16}
                    color={isOverdue ? colors.error : colors.secondary}
                  />
                  <Text style={styles.endingSoonTitle}>
                    {isOverdue ? t('active.pastBookedTime') : t('active.endingSoon')}
                  </Text>
                </View>
                <Text style={styles.endingSoonSubtitle}>
                  We've sent you a reminder — need more time? Extend right from here, or confirm
                  vacated below once you leave.
                </Text>
                <View style={styles.extendRow}>
                  <Button
                    label={t('active.extend15')}
                    variant="secondary"
                    onPress={() => handleExtend(15)}
                    loading={isExtending}
                    style={styles.extendButton}
                  />
                  <Button
                    label={t('active.extend30')}
                    variant="secondary"
                    onPress={() => handleExtend(30)}
                    loading={isExtending}
                    style={styles.extendButton}
                  />
                </View>
                {extendError ? <Text style={styles.extendErrorText}>{extendError}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {booking.status === 'no_show' ? (
          <View style={styles.centerBlock}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
            <Text style={styles.stateTitle}>{t('active.noShowTitle')}</Text>
            <Text style={styles.stateSubtitle}>
              {t('active.noShowBody', { title: listing.title })}
            </Text>
          </View>
        ) : null}

        {booking.status === 'completed' ? (
          <View style={styles.centerBlock}>
            <Text style={styles.stateTitle}>{t('active.completed')}</Text>
            <Text style={styles.stateSubtitle}>
              Thanks for parking with ParkNext. Settle up directly with the host.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.spotRow}>
            {listing.photos[0] ? (
              <Image source={{ uri: listing.photos[0] }} style={styles.spotThumb} />
            ) : (
              <View style={[styles.spotThumb, styles.spotThumbEmpty]}>
                <Ionicons name="car-outline" size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.spotTextBlock}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {listing.title}
              </Text>
              <View style={styles.spotAddressRow}>
                <Ionicons name="location" size={13} color={colors.textSecondary} style={{marginTop: 3}}/>
                <Text style={styles.spotAddress} numberOfLines={2}>
                  {listing.address}
                </Text>
              </View>
              {listing.ratingCount > 0 ? (
                <View style={styles.spotRatingRow}>
                  <StarRating rating={listing.rating} size={13} />
                  <Text style={styles.spotRatingText}>
                    {listing.rating.toFixed(1)} ({listing.ratingCount})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.cardDivider} />

          <DataColumns
            columns={[
              {
                icon: 'calendar-outline',
                label: t('common.date'),
                value: formatRelativeDate(booking.startTime),
              },
              {
                icon: 'time-outline',
                label: t('common.time'),
                value: formatTimeRangeShort(booking.startTime, booking.endTime),
              },
            ]}
            style={styles.dataColumns}
          />

          <View style={styles.cardDivider} />

          {booking.checkInAt ? (
            <SummaryRow label={t('active.checkedInAt')} value={formatTimeFromISO(booking.checkInAt)} />
          ) : null}
          {booking.checkOutAt ? (
            <SummaryRow label={t('active.checkedOutAt')} value={formatTimeFromISO(booking.checkOutAt)} />
          ) : null}

          {booking.status !== 'no_show' ? (
            <>
            

              {overtimeMinutes > 0 ? (
                <SummaryRow
                  label={t('active.overtimeStayed', { minutes: overtimeMinutes })}
                  value={`+${listing.currency}${overtimeCost}`}
                />
              ) : null}

              <SummaryRow
                icon="card-outline"
                label={booking.status === 'completed' ? t('active.amountOwed') : t('active.currentEstimate')}
                value={`${listing.currency}${currentEstimate}`}
                highlight
              />
            </>
          ) : (
            // Never checked in — nothing was actually used, so showing a
            // price here (the full flat rate, or a metered $0) would either
            // overstate or just be noise. Say plainly that nothing's owed
            // instead of a number that needs its own explanation.
            <Text style={styles.paymentNote}>{t('active.noShowNoCharge')}</Text>
          )}

          {booking.status === 'completed' ? (
            <Text style={styles.paymentNote}>
              Pay the host directly (cash/UPI) — ParkNext doesn't process payments in-app.
            </Text>
          ) : null}
        </View>

        {/* Only while still on the way: once checked in you are standing on
            the spot, and a route to where you already are is noise. */}
        {/* Where the spot is. No route drawn: navigating there is Google
            Maps' job, and the button below hands off to it. */}
        {booking.status === 'booked' ? (
          <View style={styles.mapCard}>
            <MapView
              latitude={(currentLocation.latitude + listing.latitude) / 2}
              longitude={(currentLocation.longitude + listing.longitude) / 2}
              zoom={zoomForDistance(distanceKm)}
              markers={[
                {
                  id: listing.id,
                  latitude: listing.latitude,
                  longitude: listing.longitude,
                  label: `${listing.currency}${listing.pricePerHour}`,
                },
              ]}
              userLocation={currentLocation}
              onTouchActiveChange={setMapPanning}
              style={styles.map}
            />
            <View style={styles.routeRow}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <View style={styles.routeText}>
                <Text style={styles.routeDistance}>
                  {distanceMinutes} mins · {distanceKm.toFixed(1)} km {t('active.away')}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {host ? (
          <View style={styles.hostCard}>
            {host.avatarUrl ? (
              <Image source={{ uri: host.avatarUrl }} style={styles.hostAvatar} />
            ) : (
              <View style={[styles.hostAvatar, styles.hostAvatarEmpty]}>
                <Ionicons name="person" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.hostTextBlock}>
              <Text style={styles.hostLabel}>{t('confirm.parkingHost')}</Text>
              <Text style={styles.hostName}>{host.name}</Text>
              {/* A rating of 0 across 0 reviews is not a bad score, it's no
                  score — so the row is dropped rather than shown as zero. */}
              {host.ratingCount > 0 ? (
                <View style={styles.hostRatingRow}>
                  <StarRating rating={host.rating} size={13} />
                  <Text style={styles.hostRatingText}>
                    {host.rating.toFixed(1)} ({host.ratingCount})
                  </Text>
                </View>
              ) : null}
              <Text style={styles.hostPhone}>{host.phone}</Text>
            </View>
            <IconActionButton icon="call" onPress={handleContactHost} style={styles.callButton} accessibilityLabel={t('common.call')}/>
          </View>
        ) : null}

        {booking.status === 'completed' ? (
          <>
            <Text style={styles.sectionTitle}>{t('common.yourReview')}</Text>
            <View style={styles.card}>
              {myReview === undefined ? (
                <ActivityIndicator color={colors.secondary} />
              ) : myReview ? (
                <>
                  <StarRating rating={myReview.rating} size={18} />
                  {myReview.comment ? (
                    <Text style={styles.reviewComment}>{myReview.comment}</Text>
                  ) : null}
                  <Text style={styles.reviewSubmittedNote}>{t('common.thanksHost')}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.reviewPrompt}>{t('common.reviewHostPrompt')}</Text>
                  <StarRatingInput value={ratingInput} onChange={setRatingInput} />
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder={t('common.addComment')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  {reviewSubmitError ? (
                    <Text style={styles.reviewErrorText}>{reviewSubmitError}</Text>
                  ) : null}
                  <Button
                    label={t('common.submitReview')}
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
        {/* While still on the way this is the only thing to do, so it takes
            the amber — same treatment it gets on Booking Confirmation. */}
        {booking.status === 'booked' ? (
          <Button
            label={t('common.navigateMaps')}
            leadingNode={<GoogleMapsIcon size={30} />}
            trailingIcon="arrow-forward"
            onPress={handleNavigate}
            style={styles.navigateButton}
          />
        ) : null}
        {booking.status === 'in_progress' ? (
          <>
            <Button label={t('active.leaving')} onPress={handleVacated} loading={isUpdating} />
            <Text style={styles.footerNote}>{t('active.leavingNote')}</Text>
          </>
        ) : null}
        {booking.status === 'completed' || booking.status === 'no_show' ? (
          <Button label={t('common.done')} onPress={handleDone} />
        ) : null}
      </View>

      {/* Last child so it covers the screen it is celebrating. Plays once
          and dismisses itself; arriving here any other way never sets
          `justBooked`, so the plain screen is what you get on a revisit. */}
      {celebrating ? (
        <BookingConfirmedOverlay
          title={t('confirm.confirmed')}
          subtitle={t('confirm.reserved')}
          onDone={() => setCelebrating(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  /** Optional glyph ahead of the label, for the rows worth picking out. */
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryRow}>
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={highlight ? colors.primary : colors.textSecondary}
          style={styles.summaryIcon}
        />
      ) : null}
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
  arrivalCode: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
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
  timerLabelOverdue: {
    color: colors.error,
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
  timerRingOverdue: {
    borderColor: colors.error,
    shadowColor: colors.error,
  },
  timerText: {
    ...typography.h1,
    fontSize: 34,
    lineHeight: 44,
    color: colors.textPrimary,
  },
  timerTextOverdue: {
    color: colors.error,
  },
  overtimeCostNote: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
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
  endingSoonCardOverdue: {
    borderColor: colors.error,
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
  extendErrorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
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
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  summaryIcon: {
    marginRight: spacing.xxs,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textSecondary,
    // Takes the space between the icon and the value rather than relying on
    // `justifyContent: 'space-between'`. With an icon present that made
    // three children, and space-between pushed the label into the middle of
    // the row — floating away from the icon it belongs to.
    flex: 1,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    // Long values wrap rather than shove the label out of the row.
    flexShrink: 1,
    textAlign: 'right',
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
  /** Shared by the pending and declined states — a centred column that
   *  fills the viewport but still scrolls when it outgrows it. */
  centeredStateContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  /** The centred column shrinks children to content width; a card wants the
   *  whole column. */
  stretchCard: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
  waitingTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  waitingTitleAccent: {
    color: colors.primary,
  },
  waitingBody: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  waitingBodyAccent: {
    color: colors.primary,
    fontFamily: fontFamily.semiBold,
  },
  pendingThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  /** Label stacked over value, beside the icon — a date range is too long
   *  to sit opposite its own label on a single line. */
  pendingFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingFactText: {
    flex: 1,
  },
  pendingFactLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  pendingFactValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  declinedIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  sharePillPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  shareLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  spotRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  spotThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  spotThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  spotTextBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  spotAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xxs,
  },
  spotAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  spotRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: 2,
  },
  spotRatingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.md,
  },
  dataColumns: {
    marginBottom: spacing.xxs,
  },
  hostAvatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: 1,
  },
  hostRatingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  hostLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  mapCard: {
    marginTop: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
    // Clips the map to the card's rounded corners.
    overflow: 'hidden',
  },
  map: {
    height: 148,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  routeText: {
    flex: 1,
  },
  routeDistance: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
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