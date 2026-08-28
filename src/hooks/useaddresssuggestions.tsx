import { useEffect, useRef, useState } from 'react';

export interface AddressSuggestion {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 5;

/**
 * Free-tier "type an address, get suggestions" autocomplete, backed by
 * OpenStreetMap's Nominatim search API — no card, no API key, same free
 * source as the app's Leaflet/OSM map tiles (Google Places Autocomplete is
 * the usual choice for this, but it needs a billing-enabled API key, which
 * conflicts with the app's zero-cost requirement). Debounced and
 * request-cancelled so fast typing doesn't spam Nominatim or let a stale
 * response for an earlier keystroke land after a newer one.
 */
export function useAddressSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    abortRef.current?.abort();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      const url =
        'https://nominatim.openstreetmap.org/search?format=json&addressdetails=0' +
        `&limit=${RESULT_LIMIT}&countrycodes=in&q=${encodeURIComponent(trimmed)}`;

      fetch(url, {
        signal: controller.signal,
        headers: {
          // Nominatim's usage policy asks every client to identify itself.
          'User-Agent': 'ParkNext/1.0 (parking marketplace app)',
          'Accept-Language': 'en',
        },
      })
        .then((response) => {
          if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
          return response.json();
        })
        .then((data: any[]) => {
          setSuggestions(
            (data || []).map((item) => ({
              id: String(item.place_id),
              label: item.display_name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
            }))
          );
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') {
            setSuggestions([]);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return { suggestions, loading };
}