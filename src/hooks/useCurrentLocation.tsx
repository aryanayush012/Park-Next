import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { GeoPoint } from '../types';
import { MOCK_CURRENT_LOCATION } from '../data/mockData';

export type LocationSource = 'gps' | 'mock';

interface CurrentLocationState {
  /** The device's real GPS position, or the fixed Bengaluru mock point as a fallback. */
  location: GeoPoint;
  /** 'gps' once a real fix has been obtained; 'mock' before that / on any failure. */
  source: LocationSource;
  /** True only during the very first resolution attempt (and any manual refresh()). */
  loading: boolean;
  /** Set when we fell back to the mock point — null once/if a real fix succeeds. */
  error: string | null;
  /** Re-run permission + fix resolution, e.g. from a "Use my location" retry button. */
  refresh: () => void;
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
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resolve = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mounted.current) {
          setLocation(MOCK_CURRENT_LOCATION);
          setSource('mock');
          setError('Location permission denied — showing a sample location instead.');
          setLoading(false);
        }
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (mounted.current) {
          setLocation(MOCK_CURRENT_LOCATION);
          setSource('mock');
          setError('Location services are turned off on this device — showing a sample location instead.');
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
          setError('Could not get a GPS fix — showing a sample location instead.');
        }
      }
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { location, source, loading, error, refresh: resolve };
}