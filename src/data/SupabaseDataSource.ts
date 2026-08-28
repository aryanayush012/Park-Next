import { supabase } from './supabaseClient';
import {
  AmenityKey,
  Booking,
  BookingStatus,
  BookingType,
  CreateBookingInput,
  CreateListingInput,
  Listing,
  PricingModel,
  RecurringSchedule,
  VehicleType,
} from '../types';
import type { DataSource } from './dataSource';

/**
 * Real-backend implementation of `DataSource`, talking to the Supabase
 * project set up by `supabase/migrations/`. Implements the exact same
 * interface `MockDataSource` does, so no screen needs to know which one is
 * active — see the factory at the bottom of `dataSource.ts`.
 *
 * A couple of PostGIS/PostgREST specifics worth knowing when reading this
 * file (also documented inline at each call site):
 * - `location` is a `geography(Point,4326)` column. Reading it back as a
 *   plain `{latitude, longitude}` uses the `latitude`/`longitude` computed
 *   columns defined in `0006_nearby_listings.sql`, not the raw column.
 * - Writing it accepts a WKT string (`POINT(lng lat)`), which Postgres's
 *   geography type parses natively — no need for a `st_makepoint` RPC.
 * - `amount_owed` doubles as "the total price" for both pricing models: it's
 *   set to the estimated total at booking time, and recomputed from actual
 *   check-in/out timestamps for metered listings when the renter checks out.
 */

const LISTING_COLUMNS =
  'id, owner_id, title, description, address, vehicle_types, amenities, pricing_model, price_per_hour, available_days, available_from, available_until, photos, is_active, ownership_confirmed, created_at, latitude, longitude';

const BOOKING_COLUMNS =
  'id, listing_id, renter_id, booking_type, status, start_at, end_at, recurring_rule, checked_in_at, checked_out_at, amount_owed, verification_code, created_at, listings!inner(price_per_hour, pricing_model, owner_id)';

interface ListingRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  address: string;
  vehicle_types: string[];
  amenities: string[];
  pricing_model: PricingModel;
  price_per_hour: number;
  available_days: number[];
  available_from: string;
  available_until: string;
  photos: string[];
  is_active: boolean;
  ownership_confirmed: boolean;
  created_at: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
}

interface BookingRow {
  id: string;
  listing_id: string;
  renter_id: string;
  booking_type: BookingType;
  status: string;
  start_at: string;
  end_at: string;
  recurring_rule: RecurringSchedule | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  amount_owed: number | null;
  verification_code: string;
  created_at: string;
  listings: { price_per_hour: number; pricing_model: PricingModel; owner_id: string } | null;
}

/** The DB enum allows `accepted` as an intermediate state; this app's flows never write it, but read it defensively as `booked` just in case something else does. */
function normalizeBookingStatus(status: string): BookingStatus {
  if (status === 'accepted') return 'booked';
  return status as BookingStatus;
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    photoUrl: row.photos[0] ?? '',
    photos: row.photos ?? [],
    distanceKm: row.distance_meters !== undefined ? row.distance_meters / 1000 : 0,
    pricePerHour: row.price_per_hour,
    currency: '₹',
    pricingModel: row.pricing_model,
    // Ratings aggregation from `reviews` isn't part of this migration set —
    // a follow-up view (e.g. `listings_with_rating`) would compute this.
    rating: 0,
    ratingCount: 0,
    amenities: (row.amenities ?? []) as AmenityKey[],
    vehicleTypes: (row.vehicle_types ?? []) as VehicleType[],
    // Live status (booked/in_progress from an active booking) isn't
    // computed here — that needs a join against `bookings`, left for a
    // later phase. New/idle listings are always `available`.
    status: 'available',
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    ownerId: row.owner_id,
    isActive: row.is_active,
    availableDays: row.available_days,
    // Postgres `time` comes back as "HH:MM:SS" — trim to the app's "HH:mm".
    availableFrom: row.available_from?.slice(0, 5),
    availableUntil: row.available_until?.slice(0, 5),
  };
}

function listingInputToRow(input: CreateListingInput) {
  return {
    owner_id: input.ownerId,
    title: input.title,
    description: input.description,
    // Postgres's geography input parser accepts WKT text directly.
    location: `POINT(${input.longitude} ${input.latitude})`,
    address: input.address,
    vehicle_types: input.vehicleTypes,
    amenities: input.amenities,
    pricing_model: input.pricingModel,
    price_per_hour: input.pricePerHour,
    available_days: input.availableDays,
    available_from: input.availableFrom,
    available_until: input.availableUntil,
    photos: input.photos,
  };
}

function rowToBooking(row: BookingRow): Booking {
  const pricePerHour = row.listings?.price_per_hour ?? 0;
  const pricingModel: PricingModel = row.listings?.pricing_model ?? 'flat';
  const durationHours =
    (new Date(row.end_at).getTime() - new Date(row.start_at).getTime()) / 3600000;
  const estimatedTotal = Math.round(pricePerHour * Math.max(0, durationHours));

  return {
    id: row.id,
    listingId: row.listing_id,
    renterId: row.renter_id,
    type: row.booking_type,
    status: normalizeBookingStatus(row.status),
    startTime: row.start_at,
    endTime: row.end_at,
    totalPrice: row.amount_owed ?? estimatedTotal,
    pricingModel,
    recurring: row.recurring_rule ?? undefined,
    checkInAt: row.checked_in_at ?? undefined,
    checkOutAt: row.checked_out_at ?? undefined,
    verificationCode: row.verification_code,
  };
}

export class SupabaseDataSource implements DataSource {
  async getListings(): Promise<Listing[]> {
    const { data, error } = await supabase
      .from('listings')
      .select(LISTING_COLUMNS)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as ListingRow[]).map(rowToListing);
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    const { data, error } = await supabase
      .from('listings')
      .select(LISTING_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToListing(data as unknown as ListingRow) : undefined;
  }

  async getNearbyListings(
    latitude: number,
    longitude: number,
    radiusMeters = 5000
  ): Promise<Listing[]> {
    const { data, error } = await supabase.rpc('nearby_listings', {
      lat: latitude,
      lng: longitude,
      radius_meters: radiusMeters,
    });
    if (error) throw error;
    return ((data ?? []) as unknown as ListingRow[]).map(rowToListing);
  }

  async getListingsByOwner(ownerId: string): Promise<Listing[]> {
    const { data, error } = await supabase
      .from('listings')
      .select(LISTING_COLUMNS)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as ListingRow[]).map(rowToListing);
  }

  async createListing(input: CreateListingInput): Promise<Listing> {
    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...listingInputToRow(input),
        is_active: true,
        // Only reachable after the Review & Publish screen's required
        // confirmation checkbox has been checked — see ListingReviewPublishScreen.
        ownership_confirmed: true,
      })
      .select(LISTING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToListing(data as unknown as ListingRow);
  }

  async updateListing(id: string, updates: Partial<CreateListingInput>): Promise<Listing> {
    const patch: Record<string, unknown> = { ...listingInputToRow(updates as CreateListingInput) };
    // `listingInputToRow` assumes every field is present (full create); for a
    // partial update, only forward fields the caller actually provided.
    Object.keys(patch).forEach((key) => {
      const inputKey = rowKeyToInputKey(key);
      if (inputKey && !(inputKey in updates)) delete patch[key];
    });
    if (updates.latitude === undefined || updates.longitude === undefined) {
      delete patch.location;
    }

    const { data, error } = await supabase
      .from('listings')
      .update(patch)
      .eq('id', id)
      .select(LISTING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToListing(data as unknown as ListingRow);
  }

  async setListingActive(id: string, isActive: boolean): Promise<Listing> {
    const { data, error } = await supabase
      .from('listings')
      .update({ is_active: isActive })
      .eq('id', id)
      .select(LISTING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToListing(data as unknown as ListingRow);
  }

  async getBookingsForUser(userId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('renter_id', userId)
      .order('start_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as BookingRow[]).map(rowToBooking);
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToBooking(data as unknown as BookingRow) : undefined;
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        listing_id: input.listingId,
        renter_id: input.renterId,
        booking_type: input.type,
        // This app's renter flow always confirms instantly today (no
        // owner-approval step in the UI yet) — see BookingFlowScreen.
        status: 'booked',
        start_at: input.startTime,
        end_at: input.endTime,
        recurring_rule: input.recurring ?? null,
        amount_owed: input.totalPrice,
      })
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToBooking(data as unknown as BookingRow);
  }

  async checkIn(bookingId: string): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'in_progress', checked_in_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToBooking(data as unknown as BookingRow);
  }

  async verifyArrivalCode(bookingId: string, code: string): Promise<Booking> {
    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('id', bookingId)
      .single();
    if (fetchError) throw fetchError;

    const existingRow = existing as unknown as BookingRow;
    if (existingRow.verification_code !== code.trim()) {
      throw new Error("That code doesn't match — ask the renter to double-check it.");
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'in_progress', checked_in_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToBooking(data as unknown as BookingRow);
  }

  async extendBooking(bookingId: string, extraMinutes: number): Promise<Booking> {
    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('id', bookingId)
      .single();
    if (fetchError) throw fetchError;

    const existingRow = existing as unknown as BookingRow;
    const newEnd = new Date(new Date(existingRow.end_at).getTime() + extraMinutes * 60000);
    let amountOwed = existingRow.amount_owed;
    if (existingRow.listings?.pricing_model === 'flat') {
      const extra = Math.round((existingRow.listings.price_per_hour ?? 0) * (extraMinutes / 60));
      amountOwed = (amountOwed ?? 0) + extra;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ end_at: newEnd.toISOString(), amount_owed: amountOwed })
      .eq('id', bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToBooking(data as unknown as BookingRow);
  }

  async checkOut(bookingId: string): Promise<Booking> {
    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('id', bookingId)
      .single();
    if (fetchError) throw fetchError;

    const existingRow = existing as unknown as BookingRow;
    const checkedOutAt = new Date();
    let amountOwed = existingRow.amount_owed;

    if (existingRow.listings?.pricing_model === 'metered' && existingRow.checked_in_at) {
      const elapsedHours =
        (checkedOutAt.getTime() - new Date(existingRow.checked_in_at).getTime()) / 3600000;
      amountOwed = Math.round((existingRow.listings.price_per_hour ?? 0) * Math.max(0, elapsedHours));
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'completed',
        checked_out_at: checkedOutAt.toISOString(),
        amount_owed: amountOwed,
      })
      .eq('id', bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToBooking(data as unknown as BookingRow);
  }

  async getBookingsForOwner(ownerId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('listings.owner_id', ownerId)
      .order('start_at', { ascending: true });
    if (error) throw error;
    return (data as unknown as BookingRow[]).map(rowToBooking);
  }

  async getBookingRequestsForOwner(ownerId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('listings.owner_id', ownerId)
      .eq('status', 'pending')
      .order('start_at', { ascending: true });
    if (error) throw error;
    return (data as unknown as BookingRow[]).map(rowToBooking);
  }

  async respondToBookingRequest(bookingId: string, accept: boolean): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: accept ? 'booked' : 'declined' })
      .eq('id', bookingId)
      .select(BOOKING_COLUMNS)
      .single();
    if (error) throw error;
    return rowToBooking(data as unknown as BookingRow);
  }
}

/** Maps a `listings` row/column name back to the `CreateListingInput` key that produced it, for trimming partial updates. */
function rowKeyToInputKey(rowKey: string): keyof CreateListingInput | null {
  const map: Record<string, keyof CreateListingInput> = {
    owner_id: 'ownerId',
    title: 'title',
    description: 'description',
    address: 'address',
    vehicle_types: 'vehicleTypes',
    amenities: 'amenities',
    pricing_model: 'pricingModel',
    price_per_hour: 'pricePerHour',
    available_days: 'availableDays',
    available_from: 'availableFrom',
    available_until: 'availableUntil',
    photos: 'photos',
  };
  return map[rowKey] ?? null;
}