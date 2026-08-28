import { Linking } from 'react-native';
import { GeoPoint } from '../types';

/**
 * Hands off turn-by-turn driving directions to the device's own maps app.
 * The in-app Leaflet/OSM map is a static "here's roughly the route" preview —
 * it has no live GPS-follow or voice guidance — so actually getting the
 * renter to the spot goes through Google/Apple Maps instead. A universal
 * `google.com/maps` link (rather than an app-specific URL scheme like
 * `maps://` or `google.navigation:`) is used deliberately: it opens the
 * Google Maps app directly when installed on both iOS and Android, and falls
 * back to the browser when it isn't, with no permission/entitlement setup
 * needed on our end (custom schemes need extra allow-listing to query
 * reliably, e.g. Android's package-visibility rules).
 */
export async function openDirectionsInMaps(destination: GeoPoint): Promise<boolean> {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}