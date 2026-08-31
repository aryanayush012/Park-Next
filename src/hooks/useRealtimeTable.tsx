import { useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../data/supabaseClient';

type RealtimeTable = 'listings' | 'bookings';

/**
 * Subscribes to Postgres Changes on `table` for as long as the calling
 * component stays mounted, calling `onChange` (typically a screen's
 * existing `load()`/refetch function) whenever a matching row is
 * inserted, updated, or deleted. A no-op entirely in mock mode — there's
 * no live backend to subscribe to, so nothing runs and `onChange` is
 * never called from here.
 *
 * Realtime enforces each table's own RLS `select` policy per subscriber
 * (see `supabase/migrations/0008_enable_realtime.sql`), so even an
 * unfiltered subscription is still correctly scoped: a renter's channel
 * only ever receives events for bookings they could already `select`
 * (their own), a provider's only for bookings on listings they own, etc.
 * — no cross-account data ever reaches a client it doesn't belong to.
 *
 * `filter` (optional) narrows further using Supabase's realtime filter
 * syntax, e.g. `` `id=eq.${bookingId}` `` to watch one specific row instead
 * of the whole table.
 *
 * Deliberately calls `onChange()` — a full refetch through the normal
 * `DataSource` — rather than hand-patching local state from the raw change
 * payload. Simpler, and correct regardless of which columns a given event
 * type does or doesn't echo back (an `UPDATE` payload's `old` record, for
 * instance, only includes changed columns unless `REPLICA IDENTITY FULL`
 * is set, which this app doesn't need since it never reads the payload).
 */
export function useRealtimeTable(table: RealtimeTable, onChange: () => void, filter?: string): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel(`realtime-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => onChangeRef.current()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}