// Supabase Edge Function: notify-booking-request
//
// Sends the spot's owner a real push notification — one that arrives with the
// app closed — carrying who is booking, what it pays, when it runs, plus
// Accept and Decline buttons.
//
// Invoked by the renter's app immediately after `createBooking` succeeds,
// rather than from a database trigger. A trigger would also cover bookings
// created outside the app, but it needs `pg_net` plus the function URL and a
// service key stashed in database settings; invoking it from the client that
// just created the booking needs none of that, and that client is by
// definition awake at exactly that moment.
//
// Deploy:  supabase functions deploy notify-booking-request
//
// Runs with the service role key (injected automatically as
// SUPABASE_SERVICE_ROLE_KEY) because it must read the *owner's* push token,
// which RLS deliberately does not expose to the renter making the request.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// Bookings are stored in UTC; the people reading this notification are not.
const DISPLAY_TIMEZONE = 'Asia/Kolkata';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let bookingId: unknown;
  try {
    ({ bookingId } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Body must be JSON' }), { status: 400 });
  }
  if (typeof bookingId !== 'string' || !bookingId) {
    return new Response(JSON.stringify({ error: 'bookingId is required' }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status, listing_id, renter_id, amount_owed, start_at, end_at')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    return new Response(JSON.stringify({ error: bookingError.message }), { status: 500 });
  }
  // Only a request still awaiting a response is worth a notification with
  // Accept/Decline on it — anything else and the buttons would be a lie.
  if (!booking || booking.status !== 'pending') {
    return new Response(JSON.stringify({ skipped: 'not a pending request' }), { status: 200 });
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('title, owner_id')
    .eq('id', booking.listing_id)
    .maybeSingle();

  if (!listing) {
    return new Response(JSON.stringify({ error: 'listing not found' }), { status: 404 });
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', listing.owner_id)
    .maybeSingle();

  const token = owner?.push_token;
  if (!token) {
    // The owner has never opened the app on a push-capable build. The
    // in-app list still shows the request.
    return new Response(JSON.stringify({ skipped: 'owner has no push token' }), { status: 200 });
  }

  const { data: renter } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', booking.renter_id)
    .maybeSingle();

  // A brand-new account may not have set a name yet, and "undefined wants
  // your spot" is worse than saying nothing about who.
  const renterName = (renter?.name ?? '').trim() || 'Someone';
  const amount = `₹${Math.round(Number(booking.amount_owed ?? 0))}`;
  const when = formatWhen(booking.start_at, booking.end_at);

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: `New request · ${listing.title}`,
      // Everything the owner needs to decide, without opening anything.
      body: `${renterName} · ${amount} · ${when}`,
      sound: 'default',
      priority: 'high',
      // Both are needed: `categoryId` attaches the Accept/Decline buttons,
      // `channelId` is what makes Android show it as a heads-up notification.
      categoryId: 'booking-request',
      channelId: 'booking-requests',
      data: { bookingId: booking.id, type: 'booking-request' },
    }),
  });

  const result = await response.json();
  return new Response(JSON.stringify(result), {
    status: response.ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json' },
  });
});

/**
 * "Today 2:30 – 6:30 PM", or "5 Sep, 2:30 – 6:30 PM" when it isn't today.
 *
 * The date is only shown when it isn't obvious, because a notification body
 * is a few words wide and "Today" is the common case for an instant booking.
 */
function formatWhen(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const time = (d: Date) =>
    d
      .toLocaleTimeString('en-IN', {
        timeZone: DISPLAY_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      .toUpperCase();

  const day = (d: Date) =>
    d.toLocaleDateString('en-IN', {
      timeZone: DISPLAY_TIMEZONE,
      day: 'numeric',
      month: 'short',
    });

  const today = day(new Date());
  const prefix = day(start) === today ? 'Today' : day(start);

  const startText = time(start);
  const endText = time(end);
  // Print the meridiem once when both ends share it: "2:30 – 6:30 PM" rather
  // than "2:30 PM – 6:30 PM", which is wide enough to get truncated.
  const shared = startText.slice(-2) === endText.slice(-2);
  const range = shared ? `${startText.slice(0, -3)} – ${endText}` : `${startText} – ${endText}`;

  return `${prefix} ${range}`;
}
