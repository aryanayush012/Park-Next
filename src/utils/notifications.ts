import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Booking } from '../types';

/** How far ahead of the booking's end time to fire the "ending soon" reminder. */
const REMINDER_LEAD_MINUTES = 10;
const ANDROID_CHANNEL_ID = 'booking-ending-soon';

/**
 * Expo Go's Android client had its expo-notifications native code path
 * stripped down starting with SDK 53 — not just push tokens, but touching
 * the module *at all* there (even just importing it, or a permission/
 * channel-setup call) throws a fatal, uncatchable "[runtime not ready]"
 * error rather than a normal rejected promise. A real dev-client/standalone
 * build, Expo Go on iOS, and the web build are all unaffected.
 *
 * Detected via `appOwnership` — it's soft-deprecated in Expo's docs in
 * favor of `executionEnvironment`, but that newer field can't tell classic
 * Expo Go apart from a proper dev-client build (which *does* support this
 * fine), so `appOwnership === 'expo'` is still the only signal precise
 * enough for exactly this case.
 */
const isUnsupportedExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';

type NotificationsApi = typeof import('expo-notifications');
let cachedModule: NotificationsApi | null | undefined;

/**
 * Lazily — and only when safe — loads expo-notifications and wires up the
 * foreground notification handler. Crucially, the module is never even
 * `import()`-ed on web or on Expo Go for Android, so the native side effects
 * that actually crash there never run. Every exported function below routes
 * through this, so nothing in this file touches expo-notifications outside
 * of it.
 */
async function loadNotifications(): Promise<NotificationsApi | null> {
  if (Platform.OS === 'web' || isUnsupportedExpoGoAndroid) return null;
  if (cachedModule !== undefined) return cachedModule;

  try {
    const mod = await import('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cachedModule = mod;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

let setupDone = false;

/**
 * Requests notification permission and creates the Android channel (with a
 * vibration pattern + sound) the first time it's needed. Safe to call
 * repeatedly — only does real work once per app session. Resolves `false`
 * (rather than throwing) anywhere this feature isn't supported.
 */
export async function ensureNotificationSetup(): Promise<boolean> {
  if (setupDone) return true;

  const Notifications = await loadNotifications();
  if (!Notifications) return false;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Booking reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 400, 250, 400],
        sound: 'default',
      });
    }
    setupDone = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Schedules a local "your booking ends in 10 minutes" notification (sound +
 * vibration on Android, sound on iOS) for `booking.endTime` minus the lead
 * time above. Cancels any previously-scheduled reminder for this same
 * booking first, so extending the booking (which pushes `endTime` out)
 * reschedules instead of leaving a stale, too-early notification behind.
 * If the booking is already inside (or past) the reminder window when this
 * is called, it still fires — just as soon as possible instead of being
 * silently skipped. No-ops wherever this isn't supported (web, Expo Go on
 * Android) — the in-app "ending soon" banner, computed from the screen's
 * own live countdown, still works there regardless.
 */
export async function scheduleBookingEndingSoonReminder(
  booking: Booking,
  listingTitle: string
): Promise<void> {
  const ok = await ensureNotificationSetup();
  if (!ok) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  await cancelBookingEndingSoonReminder(booking.id);

  const fireAt = new Date(booking.endTime).getTime() - REMINDER_LEAD_MINUTES * 60 * 1000;
  const triggerDate = new Date(Math.max(fireAt, Date.now() + 2000));

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your booking ends soon',
        body: `${REMINDER_LEAD_MINUTES} minutes left at ${listingTitle} — extend it right from the app if you need more time.`,
        sound: true,
        data: { bookingId: booking.id },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
  } catch {
    // Best-effort — see the module-level comment above.
  }
}

/**
 * Fires an immediate local notification telling the owner a new booking
 * request just came in. Called from the Booking Requests screen the moment
 * its realtime subscription (or poll) notices a brand-new `pending` row —
 * see `BookingRequestsScreen.tsx`. This is a same-device local notification,
 * not a true server push: it only fires while this device's app process is
 * alive (foregrounded, or backgrounded with its realtime socket still
 * connected) — an owner whose app is fully closed won't be notified until
 * they reopen it. A true "notified even when the app is killed" push would
 * need server-side infrastructure (a Supabase Edge Function triggered on
 * insert, calling the Expo Push API with a stored push token) that this app
 * doesn't have yet — same category of gap as the rest of this file's
 * reminder, just one step further (that one still fires on a schedule set
 * from this same device; this one depends on a live connection to notice
 * the event at all).
 */
export async function notifyNewBookingRequest(listingTitle: string): Promise<void> {
  const ok = await ensureNotificationSetup();
  if (!ok) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New booking request',
        body: `Someone wants to book ${listingTitle} — respond before their request expires.`,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch {
    // Best-effort — see the module-level comment above.
  }
}

/**
 * Cancels any scheduled "ending soon" reminder for this booking. Looks the
 * notification up by the `bookingId` stamped into its `data` (rather than
 * tracking identifiers in a JS-side map), so this stays correct even across
 * a dev-reload that would otherwise lose an in-memory identifier.
 */
export async function cancelBookingEndingSoonReminder(bookingId: string): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const matches = scheduled.filter((n) => n.content.data?.bookingId === bookingId);
    await Promise.all(matches.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // Best-effort cleanup — nothing user-visible depends on this succeeding.
  }
}