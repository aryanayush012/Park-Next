import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../data/supabaseClient';
import { dataSource } from '../data/dataSource';
import { useAuth } from '../navigation/AuthContext';
import { useRole } from '../navigation/RoleContext';
import { navigationRef } from '../navigation/navigationRef';
import {
  addBookingRequestActionListener,
  ensureBookingRequestCategory,
  getPushToken,
} from '../utils/notifications';

/**
 * Wires up owner-side push for booking requests. Mounted once, at the root.
 *
 * Three jobs:
 *
 * - Registers this device's Expo push token against the signed-in profile, so
 *   the Edge Function has somewhere to send. Done on every launch rather than
 *   once, because a token can be reassigned after a reinstall or a restore.
 * - Performs Accept / Decline straight from the notification buttons. The
 *   write is guarded on `status = 'pending'` in `respondToBookingRequest`, so
 *   a stale notification — expired, cancelled, or already answered in-app —
 *   resolves to no change rather than reviving a dead request.
 * - Opens the request itself when the notification body is tapped.
 */
export function usePushBookingRequests(): void {
  const { userId, isSignedIn } = useAuth();
  const { activeRole, setActiveRole } = useRole();

  /** Set by a notification tap, cleared once we have actually navigated. */
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;

    (async () => {
      await ensureBookingRequestCategory();

      if (!isSupabaseConfigured || !userId) return;
      const token = await getPushToken();
      if (cancelled) return;
      if (!token) {
        // getPushToken() already logs the specific reason (permission,
        // missing project id, or the native call itself failing) — this is
        // just the confirmation that registration was skipped this launch,
        // so "no push ever arrives" doesn't read as an unexplained silence.
        console.warn('[ParkNext] No push token to register this launch.');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[ParkNext] Failed to save push token:', error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  useEffect(() => {
    let teardown: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const unsubscribe = await addBookingRequestActionListener((action) => {
        if (action.kind === 'open') {
          // Only recorded here. Navigating from this callback would race the
          // tab switch below — the Requests tab does not exist while the app
          // is in renter mode, and React Navigation drops a `navigate` to a
          // route it cannot see.
          setPendingBookingId(action.bookingId);
          setActiveRole('provider');
          return;
        }

        dataSource.respondToBookingRequest(action.bookingId, action.accept).catch((error: unknown) => {
          // Nothing to show: the tap may have happened while the app was
          // closed, with no screen mounted to surface an error on. The
          // Requests list is the source of truth either way.
          // eslint-disable-next-line no-console
          console.warn(
            '[ParkNext] Could not respond from notification:',
            error instanceof Error ? error.message : error
          );
        });
      });
      if (cancelled) unsubscribe();
      else teardown = unsubscribe;
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [setActiveRole]);

  /**
   * Deferred navigation.
   *
   * Waits for two things the tap itself cannot guarantee: the navigator being
   * mounted (a cold start from a notification runs this before the tree
   * exists) and provider mode being active (so the Requests tab is actually
   * registered). Driven by state rather than a timer, so it lands as soon as
   * both are true instead of guessing at a delay.
   */
  useEffect(() => {
    if (!pendingBookingId) return;
    if (activeRole !== 'provider') return;
    if (!navigationRef.isReady()) return;

    navigationRef.navigate('Main', {
      screen: 'Requests',
      params: {
        screen: 'BookingDetailOwner',
        params: { bookingId: pendingBookingId },
      },
    });
    setPendingBookingId(null);
  }, [pendingBookingId, activeRole]);
}
