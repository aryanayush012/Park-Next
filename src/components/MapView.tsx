import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors, spacing, typography } from '../theme';
import { GeoPoint } from '../types';
import { LEAFLET_CSS, LEAFLET_JS } from '../../assets/leafletAssets';

/**
 * If the map hasn't signaled `ready` within this window, we stop waiting.
 * Root cause this guards against: the map WebView used to load Leaflet from
 * a CDN (`<script src="https://unpkg.com/...">`) at runtime — on a flaky or
 * filtered network, that request could hang or fail silently, the inline
 * script that constructs `L.map(...)` would then throw a ReferenceError, and
 * `map.whenReady()` — the only thing that ever posts the `ready` message —
 * was never reached. Nothing timed out, so the loading spinner spun forever.
 * Leaflet is now bundled locally (see `src/assets/leafletAssets.ts`), so
 * that specific failure shouldn't happen anymore, but a hard timeout stays
 * here as a safety net against any other reason the page fails to report in.
 */
const READY_TIMEOUT_MS = 8000;

export interface MapMarker extends GeoPoint {
  id: string;
  /** Short text shown on the pin, e.g. "₹40". */
  label?: string;
  selected?: boolean;
}

export interface MapRouteDestination extends GeoPoint {
  label?: string;
}

export interface MapRoute {
  origin: GeoPoint;
  destination: MapRouteDestination;
}

export type RouteSource = 'osrm' | 'straight';

export interface RouteResolvedInfo {
  source: RouteSource;
  distanceMeters?: number;
  durationSeconds?: number;
}

export interface MapViewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: MapMarker[];
  route?: MapRoute;
  /** Renders a plain glowing dot (not a price pin) at this point, e.g. "your location". */
  userLocation?: GeoPoint;
  /** When true, tapping the map reports the tapped lat/lng via `onLocationSelect` — used by Add Listing's "pin your exact location" step. */
  pickable?: boolean;
  /** The currently chosen point in pickable mode — rendered as a drop-pin marker. */
  pickedLocation?: GeoPoint | null;
  onLocationSelect?: (point: GeoPoint) => void;
  onMarkerPress?: (id: string) => void;
  onRouteResolved?: (info: RouteResolvedInfo) => void;
  /** When false, panning/zooming/tapping the map is disabled — used for small preview maps. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ZOOM = 14;

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'markerPress'; id: string }
  | { type: 'mapPress'; latitude: number; longitude: number }
  | { type: 'routeReady'; source: RouteSource; distanceMeters?: number; durationSeconds?: number };

/**
 * Reusable map surface built on react-native-webview, rendering Leaflet.js +
 * OpenStreetMap tiles. Leaflet's JS/CSS are bundled locally (no CDN fetch
 * needed just to draw the map chrome — only the actual tile images need a
 * network request, and Leaflet degrades to a blank grid rather than hanging
 * if those are slow/unavailable). Markers/route/center are pushed into the
 * page after it reports `ready`, via `injectJavaScript`, so the WebView
 * itself never needs to reload when props change.
 */
export function MapView({
  latitude,
  longitude,
  zoom = DEFAULT_ZOOM,
  markers = [],
  route,
  userLocation,
  pickable = false,
  pickedLocation,
  onLocationSelect,
  onMarkerPress,
  onRouteResolved,
  interactive = true,
  style,
}: MapViewProps) {
  const webviewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Tracks the last route JSON actually injected into the current WebView
  // instance — see the route effect below for why this needs a value
  // comparison rather than relying on the `route` prop's object identity.
  const lastRouteJsonRef = useRef<string | null>(null);

  // Built once per reload; the initial center/zoom only matter before `ready`
  // fires, after which __setView drives the camera without a page reload.
  const html = useMemo(() => buildMapHtml(latitude, longitude, zoom), [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setIsReady(false);
    setTimedOut(false);
    setLoadFailed(false);
    // A fresh WebView instance has nothing drawn yet, so the route-diff
    // guard below must not assume "unchanged" just because the same route
    // value was already injected into the previous (now-discarded) instance.
    lastRouteJsonRef.current = null;
    const timer = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [reloadKey]);

  const retry = () => {
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (!isReady) return;
    webviewRef.current?.injectJavaScript(
      `window.__setMarkers(${JSON.stringify(markers)}); true;`
    );
  }, [isReady, markers]);

  // `route` is an object literal most callers rebuild fresh on every render
  // (e.g. `route={{ origin, destination }}`), so its reference changes even
  // when its actual values don't. Re-injecting on every reference change was
  // re-running `drawRoute()` (which re-fetches OSRM and re-fits the map's
  // bounds) on every unrelated re-render — including the ones `onRouteResolved`
  // itself triggers, causing a redraw loop: refit bounds -> onRouteResolved ->
  // parent re-renders -> new route object -> refit bounds again. That loop is
  // what showed up as visible flicker and the map snapping back to its fitted
  // zoom right after a manual pinch-zoom. Comparing the *value* (via a JSON
  // snapshot) rather than the reference breaks the loop while still picking
  // up real route changes (a different listing/origin).
  useEffect(() => {
    if (!isReady) return;
    const nextJson = route ? JSON.stringify(route) : null;
    if (nextJson === lastRouteJsonRef.current) return;
    lastRouteJsonRef.current = nextJson;
    webviewRef.current?.injectJavaScript(`window.__setRoute(${nextJson ?? 'null'}); true;`);
  }, [isReady, route]);

  useEffect(() => {
    if (!isReady) return;
    webviewRef.current?.injectJavaScript(
      `window.__setUserLocation(${userLocation ? JSON.stringify(userLocation) : 'null'}); true;`
    );
  }, [isReady, userLocation]);

  useEffect(() => {
    if (!isReady) return;
    webviewRef.current?.injectJavaScript(
      `window.__setView(${latitude}, ${longitude}, ${zoom}); true;`
    );
  }, [isReady, latitude, longitude, zoom]);

  useEffect(() => {
    if (!isReady) return;
    webviewRef.current?.injectJavaScript(`window.__setInteractive(${interactive}); true;`);
  }, [isReady, interactive]);

  useEffect(() => {
    if (!isReady) return;
    webviewRef.current?.injectJavaScript(`window.__setPickable(${pickable}); true;`);
  }, [isReady, pickable]);

  useEffect(() => {
    if (!isReady) return;
    webviewRef.current?.injectJavaScript(
      `window.__setPickedLocation(${pickedLocation ? JSON.stringify(pickedLocation) : 'null'}); true;`
    );
  }, [isReady, pickedLocation]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as BridgeMessage;
      if (message.type === 'ready') {
        setIsReady(true);
      } else if (message.type === 'error') {
        setLoadFailed(true);
      } else if (message.type === 'markerPress') {
        onMarkerPress?.(message.id);
      } else if (message.type === 'mapPress') {
        onLocationSelect?.({ latitude: message.latitude, longitude: message.longitude });
      } else if (message.type === 'routeReady') {
        onRouteResolved?.({
          source: message.source,
          distanceMeters: message.distanceMeters,
          durationSeconds: message.durationSeconds,
        });
      }
    } catch {
      // Ignore malformed bridge messages.
    }
  };

  const showError = loadFailed || (timedOut && !isReady);

  return (
    <View style={[styles.container, style]}>
      <WebView
        key={reloadKey}
        ref={webviewRef}
        source={{ html }}
        onMessage={handleMessage}
        onError={() => setLoadFailed(true)}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
      />
      {!isReady && !showError ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {showError ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.errorText}>Map couldn't load. Check your connection.</Text>
          <Pressable onPress={retry} style={styles.retryButton} hitSlop={8}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  retryButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});

function buildMapHtml(lat: number, lng: number, zoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>${LEAFLET_CSS}</style>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: ${colors.background}; }
  .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.6); }
  .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
  .price-pin {
    background: ${colors.primary};
    color: ${colors.textOnPrimary};
    font-weight: 700;
    font-size: 12px;
    font-family: -apple-system, Roboto, sans-serif;
    padding: 5px 9px;
    border-radius: 14px;
    box-shadow: 0 2px 10px rgba(245, 166, 35, 0.55);
    white-space: nowrap;
    text-align: center;
    display: inline-block;
  }
  .price-pin.selected {
    background: ${colors.secondary};
    color: ${colors.textOnSecondary};
    box-shadow: 0 2px 10px rgba(45, 212, 191, 0.55);
  }
  .price-pin-wrap { position: relative; display: inline-block; }
  .price-pin-wrap:after {
    content: '';
    position: absolute;
    left: 50%;
    margin-left: -5px;
    bottom: -6px;
    border-width: 6px 5px 0 5px;
    border-style: solid;
    border-color: ${colors.primary} transparent transparent transparent;
  }
  .price-pin-wrap.selected:after {
    border-color: ${colors.secondary} transparent transparent transparent;
  }
  .dot-outer {
    width: 22px; height: 22px; border-radius: 11px;
    background: rgba(245, 166, 35, 0.25);
    display: flex; align-items: center; justify-content: center;
  }
  .dot-inner {
    width: 12px; height: 12px; border-radius: 6px;
    background: ${colors.primary};
    border: 2px solid ${colors.background};
  }
  .drop-pin-wrap { width: 30px; height: 30px; position: relative; }
  .drop-pin {
    position: absolute;
    top: 2px; left: 4px;
    width: 22px; height: 22px;
    border-radius: 50% 50% 50% 0;
    background: ${colors.primary};
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(245, 166, 35, 0.6);
  }
  .drop-pin:after {
    content: '';
    position: absolute;
    width: 8px; height: 8px;
    top: 7px; left: 7px;
    border-radius: 50%;
    background: ${colors.background};
  }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  // Belt-and-suspenders: if anything below throws (e.g. a future edit
  // reintroduces an external dependency that fails to load), report it
  // instead of leaving the React Native side waiting on a "ready" message
  // that will never come.
  window.onerror = function (message) {
    post({ type: 'error', message: String(message) });
    return false;
  };

  try {
    initMap();
  } catch (e) {
    post({ type: 'error', message: e && e.message ? e.message : String(e) });
  }

  function initMap() {
  var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var routeLayer = null;
  var userLocationMarker = null;
  var pickedMarker = null;
  var isPickable = false;

  function priceIcon(label, selected) {
    var cls = 'price-pin-wrap' + (selected ? ' selected' : '');
    var pinCls = 'price-pin' + (selected ? ' selected' : '');
    return L.divIcon({
      html: '<div class="' + cls + '"><div class="' + pinCls + '">' + (label || '') + '</div></div>',
      className: '',
      iconSize: [64, 30],
      iconAnchor: [32, 36],
    });
  }

  function dotIcon() {
    return L.divIcon({
      html: '<div class="dot-outer"><div class="dot-inner"></div></div>',
      className: '',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  function dropPinIcon() {
    return L.divIcon({
      html: '<div class="drop-pin-wrap"><div class="drop-pin"></div></div>',
      className: '',
      iconSize: [30, 30],
      iconAnchor: [15, 28],
    });
  }

  window.__setPickable = function (enabled) {
    isPickable = !!enabled;
  };

  window.__setPickedLocation = function (loc) {
    if (pickedMarker) { map.removeLayer(pickedMarker); pickedMarker = null; }
    if (!loc) return;
    pickedMarker = L.marker([loc.latitude, loc.longitude], { icon: dropPinIcon(), zIndexOffset: 1500 }).addTo(map);
  };

  map.on('click', function (e) {
    if (!isPickable) return;
    post({ type: 'mapPress', latitude: e.latlng.lat, longitude: e.latlng.lng });
  });

  window.__setMarkers = function (markers) {
    markerLayer.clearLayers();
    (markers || []).forEach(function (m) {
      var marker = L.marker([m.latitude, m.longitude], { icon: priceIcon(m.label, !!m.selected) });
      marker.on('click', function () { post({ type: 'markerPress', id: m.id }); });
      marker.addTo(markerLayer);
    });
  };

  window.__setView = function (lat, lng, zoom) {
    map.setView([lat, lng], zoom, { animate: true });
  };

  window.__setInteractive = function (enabled) {
    if (enabled) {
      map.dragging.enable(); map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable(); map.touchZoom.enable();
    } else {
      map.dragging.disable(); map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable(); map.touchZoom.disable();
    }
  };

  window.__setUserLocation = function (loc) {
    if (userLocationMarker) { map.removeLayer(userLocationMarker); userLocationMarker = null; }
    if (!loc) return;
    userLocationMarker = L.marker([loc.latitude, loc.longitude], { icon: dotIcon(), zIndexOffset: 1000 }).addTo(map);
  };

  window.__setRoute = function (route) {
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (!route) return;
    drawRoute(route.origin, route.destination);
  };

  function drawRoute(origin, destination) {
    var straight = L.polyline(
      [[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]],
      { color: '${colors.secondary}', weight: 3, dashArray: '6,8', opacity: 0.85 }
    );
    var originMarker = L.marker([origin.latitude, origin.longitude], { icon: dotIcon() });
    var destMarker = L.marker([destination.latitude, destination.longitude], {
      icon: priceIcon(destination.label, false),
    });
    routeLayer = L.layerGroup([straight, originMarker, destMarker]).addTo(map);
    try { map.fitBounds(straight.getBounds(), { padding: [50, 80] }); } catch (e) {}

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 4000);
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      origin.longitude + ',' + origin.latitude + ';' +
      destination.longitude + ',' + destination.latitude +
      '?overview=full&geometries=geojson';

    fetch(url, { signal: controller.signal })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('OSRM HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var route0 = data && data.routes && data.routes[0];
        if (!route0) throw new Error('no route in response');
        var coords = route0.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        var real = L.polyline(coords, { color: '${colors.secondary}', weight: 4, opacity: 0.95 });
        routeLayer.removeLayer(straight);
        routeLayer.addLayer(real);
        real.bringToBack();
        try { map.fitBounds(real.getBounds(), { padding: [50, 80] }); } catch (e) {}
        post({ type: 'routeReady', source: 'osrm', distanceMeters: route0.distance, durationSeconds: route0.duration });
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        post({ type: 'routeReady', source: 'straight' });
      });
  }

  // Leaflet computes its internal tile grid from the container's size at the
  // moment it initializes. Inside a WebView, the page's layout can settle a
  // beat after that — the container briefly reports 0x0 or a stale size —
  // which leaves Leaflet showing a blank/grey canvas even though "ready"
  // already fired and no error occurred. invalidateSize() forces it to
  // re-measure and redraw; calling it a few times over the first second
  // (rather than once) covers WebViews that settle their layout slowly.
  function refreshSize() {
    try { map.invalidateSize(false); } catch (e) {}
  }
  window.addEventListener('resize', refreshSize);
  [0, 100, 300, 800, 1500].forEach(function (delay) {
    setTimeout(refreshSize, delay);
  });

  map.whenReady(function () {
    post({ type: 'ready' });
    refreshSize();
  });
  } // end initMap
</script>
</body>
</html>`;
}