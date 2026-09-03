import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { GeoPoint } from '../types';
import { MOCK_CURRENT_LOCATION } from '../data/mockData';

export type LocationSource = 'gps' | 'mock';

/**
 * Why the mock fallback is currently in effect — lets the UI decide what a
 * "fix it" tap should actually do. `'settings_needed'` covers the two cases
 * an in-app retry can never resolve by itself (system location services
 * switched off, or a permission the OS won't prompt for again) — those need
 * a trip to the device's Settings app, not another call to the same API that
 * already failed. Everything else is worth a plain in-app retry.
 */
export type LocationFailureReason = 'services_disabled' | 'permission_needs_settings' | 'permission_denied' | 'fix_failed' | null;

interface CurrentLocationState {
  /** The device's real GPS position, or the fixed Bengaluru mock point as a fallback. */
  location: GeoPoint;
  /** 'gps' once a real fix has been obtained; 'mock' before that / on any failure. */
  source: LocationSource;
  /** True only during the very first resolution attempt (and any manual refresh()). */
  loading: boolean;
  /** Set when we fell back to the mock point — null once/if a real fix succeeds. */
  error: string | null;
  /** Why we're on the mock point — drives whether a "fix it" tap should retry in-app or open Settings. */
  reason: LocationFailureReason;
  /** Re-run permission + fix resolution, e.g. from a "Use my location" retry button. */
  refresh: () => void;
  /**
   * Opens the device's location settings — the only thing an app is actually
   * allowed to do when services are off or a permission is permanently
   * denied; nothing in `expo-location` (or any app) can flip either of those
   * switches directly, by OS design, on either platform. Android has a
   * direct deep link to the system Location Settings screen (with the GPS
   * toggle itself); iOS has no such deep link at all — the closest available
   * is this app's own Settings page, which still requires the person to flip
   * Location Services on manually elsewhere in Settings if it's off
   * system-wide. Once they come back to the app, the foreground listener
   * below re-checks automatically — no second tap needed.
   */
  openLocationSettings: () => void;
}

/**
 * `getCurrentPositionAsync` has no built-in timeout — on a device with a weak
 * or absent GPS signal (indoors, basement parking, an emulator with no
 * location fed in) it can hang indefinitely, which without this guard would
 * leave the hook spinning forever instead of ever falling back.
 */
const FRESH_FIX_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Location request timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Real device GPS location, with a same-shaped fallback to the fixed
 * Bengaluru mock location whenever GPS isn't available — permission denied,
 * location services turned off system-wide, running on web (no native
 * module there), or a fix that never arrives. The rest of the app never
 * needs to branch on which one it got: it always reads a plain
 * { latitude, longitude } GeoPoint.
 *
 * Resolution order once permission is granted:
 * 1. `getLastKnownPositionAsync` — a cached fix, near-instant when available,
 *    so the map shows a real position right away instead of sitting on the
 *    loading/mock state while waiting for a fresh GPS lock.
 * 2. `getCurrentPositionAsync` — a fresh fix, raced against a timeout so a
 *    weak/no signal can't hang the hook forever. If step 1 already produced
 *    a real fix, a step-2 timeout is treated as "keep what we have", not as
 *    a reason to fall back to the mock point.
 */
export function useCurrentLocation(): CurrentLocationState {
  const [location, setLocation] = useState<GeoPoint>(MOCK_CURRENT_LOCATION);
  const [source, setSource] = useState<LocationSource>('mock');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<LocationFailureReason>(null);
  const mounted = useRef(true);
  // Read inside the AppState listener below without needing to re-subscribe
  // it every time `source` changes.
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resolve = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReason(null);
    let gotGpsFix = false;

    // expo-location's native module isn't available on web — stay on the
    // mock location there instead of calling into APIs that don't exist.
    if (Platform.OS === 'web') {
      if (mounted.current) {
        setLocation(MOCK_CURRENT_LOCATION);
        setSource('mock');
        setLoading(false);
      }
      return;
    }

    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mounted.current) {
          setLocation(MOCK_CURRENT_LOCATION);
          setSource('mock');
          // `canAskAgain === false` means the OS won't show its permission
          // dialog again (e.g. Android's "Don't ask again", or a previous
          // iOS denial) — a second call to requestForegroundPermissionsAsync
          // would just silently return 'denied' again with no UI at all, so
          // that case needs Settings, not another in-app retry.
          setReason(canAskAgain ? 'permission_denied' : 'permission_needs_settings');
          setError(
            canAskAgain
              ? 'Location permission denied '
              : 'Location permission denied — enable it in Settings to use your real location.'
          );
          setLoading(false);
        }
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (mounted.current) {
          setLocation(MOCK_CURRENT_LOCATION);
          setSource('mock');
          setReason('services_disabled');
          setError('Location');
          setLoading(false);
        }
        return;
      }

      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
        if (lastKnown && mounted.current) {
          gotGpsFix = true;
          setLocation({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
          setSource('gps');
          setError(null);
          setLoading(false);
        }
      } catch {
        // No cached fix available — not fatal, the fresh-fix attempt below still runs.
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        FRESH_FIX_TIMEOUT_MS
      );

      if (mounted.current) {
        gotGpsFix = true;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setSource('gps');
        setError(null);
        setLoading(false);
      }
    } catch {
      if (mounted.current) {
        setLoading(false);
        // A last-known fix from the step above already put a real position
        // on screen — a timed-out/failed *fresh* fix shouldn't yank that
        // away back to the mock point.
        if (!gotGpsFix) {
          setLocation(MOCK_CURRENT_LOCATION);
          setSource('mock');
          setReason('fix_failed');
          setError('Could not get a GPS fix — showing a sample location instead.');
        }
      }
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  // Re-check automatically when the app comes back to the foreground while
  // still on the mock fallback — covers the exact "went to Settings, turned
  // location on, switched back" flow `openLocationSettings` sends someone
  // through, so the map corrects itself without needing a second manual tap.
  // Only fires while still on the mock point, so it never re-triggers a
  // network/GPS round-trip on every app resume once a real fix already
  // succeeded.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && sourceRef.current === 'mock') {
        resolve();
      }
    });
    return () => subscription.remove();
  }, [resolve]);

  const openLocationSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      try {
        // Deep-links straight to the system Location Settings screen (the
        // one with the actual GPS/location-services toggle) — this is an
        // Android-only API (`Linking.openSettings()` only reaches this
        // app's own settings page, not the system-wide one), so it's tried
        // first and only falls back on a device/ROM that doesn't support it.
        Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
        return;
      } catch {
        // Fall through to the generic settings link below.
      }
    }
    // iOS has no public deep link to the system Location Services toggle —
    // Apple doesn't expose one to third-party apps — so this is the closest
    // available: this app's own Settings page. If location services are off
    // system-wide, the person still has to find Settings → Privacy &
    // Security → Location Services themselves from there; there's no way
    // around that platform limitation from inside the app.
    Linking.openSettings();
  }, []);

  return { location, source, loading, error, reason, refresh: resolve, openLocationSettings };
}