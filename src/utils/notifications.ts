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

/** Category the Accept / Decline buttons hang off. Must match what the Edge
 * Function sends as `categoryId`, or the push arrives with no buttons. */
export const BOOKING_REQUEST_CATEGORY = 'booking-request';
export const BOOKING_REQUEST_ACCEPT = 'accept';
export const BOOKING_REQUEST_DECLINE = 'decline';

const REQUEST_CHANNEL_ID = 'booking-requests';

let categoryDone = false;

/**
 * Registers the Accept / Decline buttons that appear on a booking-request
 * notification, plus the Android channel it arrives on.
 *
 * Both actions use `opensAppToForeground: true`. Handling a button *without*
 * the app coming forward needs a background task — `expo-notifications`'
 * `registerTaskAsync`, which requires `expo-task-manager` (not installed) and
 * a native rebuild. With no task registered, a background action would be
 * queued silently until the next launch, which is worse than a visible
 * half-second app open: the owner would think they had responded when they
 * had not, and the request would quietly expire.
 */
export async function ensureBookingRequestCategory(): Promise<void> {
  if (categoryDone) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REQUEST_CHANNEL_ID, {
        name: 'Booking requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 250, 400],
        sound: 'default',
      });
    }

    await Notifications.setNotificationCategoryAsync(BOOKING_REQUEST_CATEGORY, [
      {
        identifier: BOOKING_REQUEST_ACCEPT,
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
      {
        identifier: BOOKING_REQUEST_DECLINE,
        buttonTitle: 'Decline',
        options: { opensAppToForeground: true, isDestructive: true },
      },
    ]);
    categoryDone = true;
  } catch {
    // Best-effort — see the module-level comment.
  }
}

/**
 * The device's Expo push token, or null where push isn't available.
 *
 * Needs the EAS project id, which `expo-constants` exposes from `app.json`.
 * On Android this only resolves in a build carrying FCM credentials — Expo's
 * push service delivers Android notifications through Firebase, so without
 * them this returns null and the app falls back to the same-device local
 * notification below.
 */
export async function getPushToken(): Promise<string | null> {
  const ok = await ensureNotificationSetup();
  if (!ok) return null;
  const Notifications = await loadNotifications();
  if (!Notifications) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch {
    return null;
  }
}

/**
 * What the owner did with the notification. `open` is a tap on the body
 * rather than a button — it should take them to the request, not answer it
 * on their behalf.
 */
export type BookingRequestAction =
  | { kind: 'respond'; bookingId: string; accept: boolean }
  | { kind: 'open'; bookingId: string };

/**
 * Calls `handler` when the owner taps Accept or Decline on a booking-request
 * notification — including the tap that launched the app, which arrives
 * through `getLastNotificationResponseAsync` rather than the live listener.
 *
 * Returns a teardown function, or a no-op where notifications aren't
 * supported.
 */
export async function addBookingRequestActionListener(
  handler: (action: BookingRequestAction) => void
): Promise<() => void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return () => {};

  const toAction = (response: {
    actionIdentifier: string;
    notification: { request: { content: { data?: Record<string, unknown> | null } } };
  }): BookingRequestAction | null => {
    const bookingId = response.notification.request.content.data?.bookingId;
    if (typeof bookingId !== 'string' || !bookingId) return null;

    const { actionIdentifier } = response;
    if (actionIdentifier === BOOKING_REQUEST_ACCEPT) {
      return { kind: 'respond', bookingId, accept: true };
    }
    if (actionIdentifier === BOOKING_REQUEST_DECLINE) {
      return { kind: 'respond', bookingId, accept: false };
    }
    // Anything else is a tap on the notification itself — on both platforms
    // that arrives as expo-notifications' DEFAULT_ACTION_IDENTIFIER.
    return { kind: 'open', bookingId };
  };

  // A cold start from a notification button: the response is waiting, not
  // emitted, so the live listener alone would miss it entirely.
  try {
    const initial = await Notifications.getLastNotificationResponseAsync();
    if (initial) {
      const action = toAction(initial);
      if (action) handler(action);
    }
  } catch {
    // Nothing to replay.
  }

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const action = toAction(response);
    if (action) handler(action);
  });

  return () => subscription.remove();
}
