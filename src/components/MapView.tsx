import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
// Not re-exported from the package root (only FileDownload/WebViewMessageEvent/
// WebViewNavigation are), so this comes from the internal types module.
import { WebViewRenderProcessGoneEvent } from 'react-native-webview/lib/WebViewTypes';
import { useTranslation } from '../i18n';
import { colors, spacing, typography } from '../theme';
import { GeoPoint } from '../types';
import { CAR_MARKER_SVG } from '../../assets/carMarkerSvg';
import { HOUSE_MARKER_SVG } from '../../assets/houseMarkerSvg';
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

/**
 * How Android composites the map WebView. THE single biggest lever on map
 * performance, and a genuine trade-off — read before changing.
 *
 * 'software' (current): tiles are rasterised on the CPU. Slow, and painfully
 *   so on mid-range hardware, where panning a filtered tile map can miss most
 *   of its frames. It is set this way on purpose: leaving it unset let
 *   Chromium turn on its own hardware-overlay path (confirmed via `adb
 *   logcat`: "WebView overlays are enabled!" on a Samsung Galaxy S24 FE,
 *   never on a Pixel 7), which drove a reload-crash-reload cycle and let the
 *   overlay swallow taps meant for buttons drawn above the map — a
 *   SurfaceControl layer is composited by the OS, so its z-order need not
 *   follow React Native's view tree at all.
 *
 * 'hardware': GPU compositing. Transforms the map's smoothness, and re-opens
 *   the crash above on the devices that exhibited it.
 *
 * Set to 'hardware' deliberately. CPU-rasterising a filtered tile map costs
 * more than any amount of JavaScript tuning on this screen can win back —
 * measured the hard way, by fixing four real JS-side problems here and having
 * none of them be perceptible on a mid-range device.
 *
 * What makes that trade acceptable is that the failure mode is contained:
 * `handleRenderProcessGone` below does NOT auto-reload, so a dying renderer
 * surfaces the ordinary retry UI instead of the endless reload cycle that was
 * the original symptom. The bad case is a map that needs a tap to come back,
 * not a crash and not a flicker loop.
 *
 * Both failures were device-specific — seen on a Samsung Galaxy S24 FE, never
 * on a Pixel 7. If this device is one of the affected ones, the tells are
 * (a) the map going blank or showing its retry card repeatedly, and (b) the
 * layer/locate buttons above the map not responding to taps. Either one means
 * put this back to 'software', and reduce the WebView's drawing work instead.
 */
const ANDROID_LAYER_TYPE: 'software' | 'hardware' | 'none' = 'hardware';

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

/** Which basemap the map draws. Mirrors the choices Google Maps offers. */
export type MapLayer = 'standard' | 'satellite' | 'terrain';

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
  /**
   * Reports the map's centre whenever it settles, so a host can tell
   * whether the view still sits on some point of interest — the "am I
   * looking at my own location" test behind the locate button's filled
   * state. Only the map itself knows where it has been dragged to.
   */
  onCenterChanged?: (point: GeoPoint) => void;
  onRouteResolved?: (info: RouteResolvedInfo) => void;
  /** When false, panning/zooming/tapping the map is disabled — used for small preview maps. */
  interactive?: boolean;
  /** Basemap to draw. Defaults to the standard street map. */
  mapLayer?: MapLayer;
  /**
   * Bump this number to snap the camera back to `latitude`/`longitude`.
   *
   * A plain prop change can't express "go back to where you already are":
   * once someone has panned away by hand, React's centre props haven't
   * changed, so nothing re-fires. An incrementing token is the signal that
   * a recentre was *asked for*, independent of whether the target moved.
   */
  recenterSignal?: number;
  /**
   * Fires true while a finger is down on the map, false when it lifts.
   *
   * A map inside a ScrollView is otherwise unusable: the ScrollView claims
   * every vertical drag for itself, so trying to pan the map scrolls the
   * page instead. Hosts feed this straight into their ScrollView's
   * `scrollEnabled` to hand the gesture over for the duration of the touch.
   * Never fires on a non-interactive map — locking the page to pan a static
   * preview would be the same bug in reverse.
   */
  onTouchActiveChange?: (active: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_ZOOM = 14;

type BridgeMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'markerPress'; id: string }
  | { type: 'mapPress'; latitude: number; longitude: number }
  | { type: 'centerChanged'; latitude: number; longitude: number }
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
  onCenterChanged,
  onRouteResolved,
  interactive = true,
  mapLayer = 'standard',
  recenterSignal = 0,
  onTouchActiveChange,
  style,
}: MapViewProps) {
  const { t } = useTranslation();
  const webviewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Tracks the last route JSON actually injected into the current WebView
  // instance — see the route effect below for why this needs a value
  // comparison rather than relying on the `route` prop's object identity.
  const lastRouteJsonRef = useRef<string | null>(null);
  const lastMarkersJsonRef = useRef<string | null>(null);

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
    lastMarkersJsonRef.current = null;
    const timer = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [reloadKey]);

  const retry = () => {
    setReloadKey((key) => key + 1);
  };

  // Compared by VALUE, for the same reason `route` is below it.
  //
  // `markers` is derived — callers build it with `filteredListings.map(...)`
  // — so it is a new array on every render of the screen, and re-injecting
  // rebuilds every marker on the page. That is cheap once and ruinous in a
  // loop: dragging the budget slider re-derives the array on every touch
  // frame, so the map was serialising and re-creating every pin ~60 times a
  // second. Most of those arrays are identical in content; the reference is
  // the only thing that changed.
  useEffect(() => {
    if (!isReady) return;
    const nextJson = JSON.stringify(markers);
    if (nextJson === lastMarkersJsonRef.current) return;
    lastMarkersJsonRef.current = nextJson;
    webviewRef.current?.injectJavaScript(`window.__setMarkers(${nextJson}); true;`);
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
    webviewRef.current?.injectJavaScript(
      `window.__setLayer(${JSON.stringify(mapLayer)}); true;`
    );
  }, [isReady, mapLayer]);

  useEffect(() => {
    // Skips the initial mount: the page already opens on this centre, and
    // animating to it on load would be a visible twitch.
    if (!isReady || !recenterSignal) return;
    webviewRef.current?.injectJavaScript(
      `window.__recenter(${latitude}, ${longitude}); true;`
    );
    // Deliberately keyed on the signal alone — a change of centre is the
    // other effect's job, this one only answers an explicit request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, recenterSignal]);

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

  const handleRenderProcessGone = (event: WebViewRenderProcessGoneEvent) => {
    // Android's WebView renders in a separate process from the app; on some
    // devices — confirmed via `adb logcat` on a Samsung Galaxy S24 FE, not
    // reproducible on a Pixel 7 — that process dies outright rather than the
    // page just failing to load.
    //
    // Deliberately NOT auto-reloading here (an earlier version of this
    // handler called `retry()` directly). On the S24 FE the renderer dies
    // again within seconds of every fresh instance — confirmed by watching
    // five-plus consecutive reload cycles in the log, each one loading,
    // drawing tiles for a few seconds, then getting torn down — so
    // auto-retrying just re-enters the same failure immediately, forever.
    // That endless reload cycle *was* the reported "flickering": the map
    // never actually crashed the app, it just never stopped restarting.
    // Showing the same error/retry UI as a normal load failure breaks the
    // loop — a person's own tap is what starts the next attempt, so it
    // cannot repeat faster than someone decides to retry it.
    console.warn('[ParkNext] WebView render process gone. didCrash =', event.nativeEvent.didCrash);
    setLoadFailed(true);
  };

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
      } else if (message.type === 'centerChanged') {
        onCenterChanged?.({ latitude: message.latitude, longitude: message.longitude });
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

  // `onTouch*` rather than the responder system: these observe the gesture
  // without claiming it, so the WebView underneath still receives every
  // touch and pans normally.
  const handleTouchActive = (active: boolean) => {
    if (interactive) onTouchActiveChange?.(active);
  };

  return (
    <View
      style={[styles.container, style]}
      onTouchStart={() => handleTouchActive(true)}
      onTouchEnd={() => handleTouchActive(false)}
      onTouchCancel={() => handleTouchActive(false)}
    >
      <WebView
        key={reloadKey}
        ref={webviewRef}
        source={{ html }}
        onMessage={handleMessage}
        onError={() => setLoadFailed(true)}
        onRenderProcessGone={handleRenderProcessGone}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // See ANDROID_LAYER_TYPE at the top of this file.
        androidLayerType={ANDROID_LAYER_TYPE}
      />
      {!isReady && !showError ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {showError ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.errorText}>{t('map.loadFailed')}</Text>
          <Pressable onPress={retry} style={styles.retryButton} hitSlop={8}>
            <Text style={styles.retryButtonText}>{t('common.tryAgainShort')}</Text>
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
  /* Per-layer, set by __setLayer. A single blanket filter here used to
     invert every basemap to fake a dark theme — which turned satellite
     photography into a washed-out negative. Imagery gets left alone. */
  .leaflet-tile-pane { filter: var(--tile-filter, none); }
  .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
  /* The price sits on a raised tablet above its pin. Gradient plus an inset
     top highlight and bottom shade give it a lit face and a thickness,
     rather than the flat chip it used to be. */
  .price-pin {
    background: linear-gradient(180deg, #FFC24A 0%, ${colors.primary} 55%, #E0900F 100%);
    color: ${colors.textOnPrimary};
    font-weight: 800;
    font-size: 10px;
    font-family: -apple-system, Roboto, sans-serif;
    padding: 3px 3px;
    border-radius: 14px;
    margin-bottom: -4px;
    box-shadow:
      0 6px 14px rgba(0, 0, 0, 0.5),
      0 0 10px rgba(245, 166, 35, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.45),
      inset 0 -2px 0 rgba(0, 0, 0, 0.18);
    white-space: nowrap;
    text-align: center;
    display: inline-block;
  }
  .price-pin.selected {
    background: linear-gradient(180deg, #5BF0D8 0%, ${colors.secondary} 55%, #17A08F 100%);
    color: ${colors.textOnSecondary};
    box-shadow:
      0 6px 14px rgba(0, 0, 0, 0.5),
      0 0 12px rgba(45, 212, 191, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.45),
      inset 0 -2px 0 rgba(0, 0, 0, 0.18);
  }
  .price-pin-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  /* The spot itself, as a little house. It floats rather than spins — a
     rotating building reads as broken, where a hover reads as a 3D object
     sitting above the map. Transform-only, so it stays on the compositor
     and a mapful of them costs the GPU rather than the JS thread.
     No backticks in this stylesheet: it is a JS template literal, and one
     would terminate the string. */
  .map-pin {
    width: 34px;
    height: 25px;
    animation: pinFloat 3s ease-in-out infinite;
  }
  .map-pin svg { display: block; width: 100%; height: 100%; }
  /* A pool of lamplight on the ground rather than a grey shadow — the same
     light the whole app is built around, and it lifts the pin off the map
     tiles far better than a dark blur can on a dark basemap.
     Stays amber under the teal selected pin: the ground light is sodium
     lamplight, it doesn't change colour with what's standing in it. */
  .pin-shadow {
    width: 30px;
    height: 11px;
    margin-top: -3px;
    border-radius: 50%;
    background: radial-gradient(
      ellipse at center,
      rgba(245, 166, 35, 0.75) 0%,
      rgba(245, 166, 35, 0.34) 42%,
      rgba(245, 166, 35, 0) 72%
    );
    animation: pinShadow 2.6s linear infinite;
  }
  /* The chosen one turns faster, so selection still reads at a glance now
     that motion alone no longer distinguishes it. */
  .price-pin-wrap.selected .map-pin {
    animation-duration: 1.7s;
  }
  .price-pin-wrap.selected .pin-shadow {
    animation-duration: 1.7s;
  }
  @keyframes pinFloat {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-4px); }
  }
  /* Squashes as the pin goes edge-on. Without this the spin reads as a
     wobble rather than as a solid object turning. */
  @keyframes pinShadow {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(0.82); opacity: 0.75; }
  }
  /* Where you are: a car sitting in a pool of lamplight. The old amber
     dot was indistinguishable from a listing's own marker colour. */
  .me-wrap {
    width: 54px; height: 54px;
    display: flex; align-items: center; justify-content: center;
  }
  .me-pool {
    position: absolute;
    width: 54px; height: 54px; border-radius: 50%;
    background: radial-gradient(
      circle at center,
      rgba(245, 166, 35, 0.40) 0%,
      rgba(245, 166, 35, 0.16) 45%,
      rgba(245, 166, 35, 0) 72%
    );
  }
  /* The artwork points right in its own space; -90deg faces it north.
     We have no heading to steer by, so "up" is the honest default — a car
     pointing an arbitrary direction would imply information we don't have. */
  .me-car {
    position: relative;
    width: 20px;
    height: 35px;
    transform: rotate(-90deg);
  }
  .me-car svg { display: block; width: 100%; height: 100%; }
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
  // Three basemaps, all key-less.
  //
  // Each provider has its own usage policy and all of them want
  // attribution. OSM's in particular asks that heavy or commercial traffic
  // not hit their volunteer-run tile servers — see the note in MapViewProps
  // above the layer switcher on the renter's map. Moving to a paid provider
  // (MapTiler, Thunderforest, Mapbox) is a key swap here, nothing more.
  var LAYERS = {
    // OpenStreetMap, graded to dark.
    //
    // Purpose-built dark basemaps were tried and rejected: CARTO's now
    // serve an "API KEY REQUIRED" watermark, and Esri's Dark Gray Canvas is
    // too sparse to navigate by — it drops most of the road network. This
    // inversion keeps OSM's roads, parks and water legible while sitting
    // correctly in a dark app. A keyed provider (MapTiler, Mapbox) is the
    // upgrade path if a closer match to Google's styling is wanted.
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: { maxZoom: 19, attribution: '(c) OpenStreetMap' },
      // Three functions, not five. Every function here is per-tile work on
      // every pan, so the two that were dropped — brightness(0.95) and
      // contrast(0.9) — were pure cost: close enough to identity to be
      // invisible next to the other three, checked against real tiles.
      filter: 'invert(1) hue-rotate(180deg) saturate(0.6)',
    },
    // Never filtered: it is a photograph. Inversion or heavy grading here
    // is what made this look nothing like the imagery people expect.
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' },
      filter: null,
    },
    // A light topo sheet. Dimmed a little so it does not glare out of a
    // dark app, but not inverted — inverted contour lines are unreadable.
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      options: { maxZoom: 17, attribution: '(c) OpenTopoMap, (c) OpenStreetMap' },
      filter: 'brightness(0.82) saturate(0.85) contrast(1.05)',
    },
  };

  var activeTiles = null;
  var activeLayerName = null;

  window.__setLayer = function (name) {
    var next = LAYERS[name] ? name : 'standard';
    if (next === activeLayerName) return;
    var spec = LAYERS[next];
    var incoming = L.tileLayer(spec.url, spec.options);
    // Added beneath the old one and only then is the old one dropped:
    // removing first leaves the map briefly empty, which reads as a flash
    // of broken map every time the layer changes.
    incoming.addTo(map);
    incoming.bringToBack();
    document.documentElement.style.setProperty('--tile-filter', spec.filter || 'none');
    if (activeTiles) map.removeLayer(activeTiles);
    activeTiles = incoming;
    activeLayerName = next;
  };

  window.__setLayer('standard');

  // Reports where the map is looking once a gesture settles, so the host
  // can tell whether the view is still on the user's own location.
  //
  // 'moveend' rather than 'move': it fires once a pan or zoom finishes,
  // instead of on every frame, keeping this to one bridge message per
  // interaction rather than dozens.
  function reportCenter() {
    var c = map.getCenter();
    post({ type: 'centerChanged', latitude: c.lat, longitude: c.lng });
  }
  map.on('moveend', reportCenter);

  window.__recenter = function (lat, lng) {
    // Keeps whatever zoom the person has chosen — a recentre is "take me
    // back to me", not "start over".
    map.panTo([lat, lng], { animate: true, duration: 0.45 });
  };

  var CAR_ART = ${JSON.stringify(CAR_MARKER_SVG)};
  var HOUSE_ART = ${JSON.stringify(HOUSE_MARKER_SVG)};

  var markerLayer = L.layerGroup().addTo(map);
  var routeLayer = null;
  var userLocationMarker = null;
  var pickedMarker = null;
  var isPickable = false;

  function priceIcon(label, selected) {
    var cls = 'price-pin-wrap' + (selected ? ' selected' : '');
    var pinCls = 'price-pin' + (selected ? ' selected' : '');
    return L.divIcon({
      html:
        '<div class="' + cls + '">' +
          '<div class="' + pinCls + '">' + (label || '') + '</div>' +
          '<div class="map-pin">' + HOUSE_ART + '</div>' +
          '<div class="pin-shadow"></div>' +
        '</div>',
      className: '',
      // Tall enough for tablet + house + pool, anchored at the very bottom
      // so the pool — where the house meets the ground — marks the real
      // coordinate rather than the tablet floating above it.
      iconSize: [74, 72],
      iconAnchor: [37, 70],
    });
  }

  function meIcon() {
    return L.divIcon({
      html:
        '<div class="me-wrap"><div class="me-pool"></div>' +
        '<div class="me-car">' + CAR_ART + '</div></div>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [27, 27],
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
    userLocationMarker = L.marker([loc.latitude, loc.longitude], { icon: meIcon(), zIndexOffset: 1000 }).addTo(map);
  };

  window.__setRoute = function (route) {
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    if (!route) return;
    drawRoute(route.origin, route.destination);
  };

  function drawRoute(origin, destination) {
    var straight = L.polyline(
      [[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]],
      { color: '${colors.primary}', weight: 3, dashArray: '6,8', opacity: 0.85 }
    );
    var originMarker = L.marker([origin.latitude, origin.longitude], { icon: meIcon() });
    var destMarker = L.marker([destination.latitude, destination.longitude], {
      icon: priceIcon(destination.label, false),
    });
    routeLayer = L.layerGroup([straight, originMarker, destMarker]).addTo(map);
    try { map.fitBounds(straight.getBounds(), { padding: [50, 80], maxZoom: 15 }); } catch (e) {}

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
        var real = L.polyline(coords, { color: '${colors.primary}', weight: 5, opacity: 0.95 });
        routeLayer.removeLayer(straight);
        routeLayer.addLayer(real);
        real.bringToBack();
        try { map.fitBounds(real.getBounds(), { padding: [50, 80], maxZoom: 15 }); } catch (e) {}
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