import { Booking, CreateBookingInput, CreateListingInput, Listing } from '../types';
import { CURRENT_USER_ID, MOCK_BOOKINGS, MOCK_LISTINGS } from './mockData';
import { isSupabaseConfigured } from './supabaseClient';
import { SupabaseDataSource } from './SupabaseDataSource';
import { generateVerificationCode } from '../utils/verificationCode';

/**
 * Data-access interface. A mock, in-memory implementation backs the app for
 * now; a later phase swaps this for a real Supabase-backed implementation
 * without screens needing to change.
 */
export interface DataSource {
  /** Renter-facing browse — excludes listings the owner has switched off. */
  getListings(): Promise<Listing[]>;
  getListingById(id: string): Promise<Listing | undefined>;
  /**
   * Real geospatial "find spots near me" — the mock implementation just
   * reuses its fixed `distanceKm` sample data, sorted; the Supabase
   * implementation calls the `nearby_listings` Postgres function over
   * `supabase.rpc(...)`.
   */
  getNearbyListings(latitude: number, longitude: number, radiusMeters?: number): Promise<Listing[]>;
  /** All of an owner's listings, active or not — used by the provider's own screens. */
  getListingsByOwner(ownerId: string): Promise<Listing[]>;
  createListing(input: CreateListingInput): Promise<Listing>;
  updateListing(id: string, updates: Partial<CreateListingInput>): Promise<Listing>;
  setListingActive(id: string, isActive: boolean): Promise<Listing>;

  getBookingsForUser(userId: string): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  createBooking(input: CreateBookingInput): Promise<Booking>;
  checkIn(bookingId: string): Promise<Booking>;
  checkOut(bookingId: string): Promise<Booking>;
  /**
   * Owner-side arrival confirmation — the owner enters the code shown on the
   * renter's Active Booking screen. Matching it transitions the booking to
   * `in_progress` (same effect as `checkIn`); a mismatch throws so the
   * screen can show an inline error without changing anything.
   */
  verifyArrivalCode(bookingId: string, code: string): Promise<Booking>;
  /**
   * Pushes `endTime` out by `extraMinutes` — the renter's "+15 min"/"+30 min"
   * actions on the Active Booking screen once their reminder fires. For a
   * flat-rate booking, adds the pro-rated extra cost onto `totalPrice`; for
   * metered, `totalPrice` is left alone since it's already computed from
   * actual check-in/out time regardless of the planned end time.
   */
  extendBooking(bookingId: string, extraMinutes: number): Promise<Booking>;

  /** All bookings (any status) across an owner's listings — dashboard stats, booking detail. */
  getBookingsForOwner(ownerId: string): Promise<Booking[]>;
  /** Just the `pending` ones awaiting Accept/Decline. */
  getBookingRequestsForOwner(ownerId: string): Promise<Booking[]>;
  respondToBookingRequest(bookingId: string, accept: boolean): Promise<Booking>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let bookingSeq = MOCK_BOOKINGS.length + 1;
let listingSeq = MOCK_LISTINGS.length + 1;

class MockDataSource implements DataSource {
  private listings: Listing[] = [...MOCK_LISTINGS];
  private bookings: Booking[] = [...MOCK_BOOKINGS];

  async getListings(): Promise<Listing[]> {
    await delay(200);
    return this.listings.filter((listing) => listing.isActive !== false);
  }

  async getListingById(id: string): Promise<Listing | undefined> {
    await delay(150);
    return this.listings.find((listing) => listing.id === id);
  }

  async getNearbyListings(
    latitude: number,
    longitude: number,
    _radiusMeters = 5000
  ): Promise<Listing[]> {
    await delay(200);
    // Mock data doesn't have a real coordinate index to query — it already
    // ships with plausible per-listing `distanceKm` values, so "nearby" here
    // just means "the active listings, nearest first".
    void latitude;
    void longitude;
    return [...(await this.getListings())].sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getListingsByOwner(ownerId: string): Promise<Listing[]> {
    await delay(150);
    return this.listings.filter((listing) => listing.ownerId === ownerId);
  }

  async createListing(input: CreateListingInput): Promise<Listing> {
    await delay(400);
    const listing: Listing = {
      id: `pl${listingSeq++}`,
      currency: '₹',
      distanceKm: 0,
      rating: 0,
      ratingCount: 0,
      status: 'available',
      isActive: true,
      photoUrl: input.photos[0] ?? '',
      ...input,
    };
    this.listings = [listing, ...this.listings];
    return listing;
  }

  async updateListing(id: string, updates: Partial<CreateListingInput>): Promise<Listing> {
    await delay(300);
    const listing = this.requireListing(id);
    Object.assign(listing, updates);
    if (updates.photos && updates.photos.length > 0) {
      listing.photoUrl = updates.photos[0];
    }
    return listing;
  }

  async setListingActive(id: string, isActive: boolean): Promise<Listing> {
    await delay(150);
    const listing = this.requireListing(id);
    listing.isActive = isActive;
    return listing;
  }

  async getBookingsForUser(_userId: string): Promise<Booking[]> {
    await delay(150);
    return [...this.bookings].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    await delay(100);
    return this.bookings.find((booking) => booking.id === id);
  }

  async createBooking(input: CreateBookingInput): Promise<Booking> {
    await delay(400);
    const booking: Booking = {
      id: `b${bookingSeq++}`,
      status: 'booked',
      verificationCode: generateVerificationCode(),
      ...input,
    };
    this.bookings = [booking, ...this.bookings];
    return booking;
  }

  async checkIn(bookingId: string): Promise<Booking> {
    await delay(200);
    const booking = this.requireBooking(bookingId);
    booking.status = 'in_progress';
    booking.checkInAt = new Date().toISOString();
    return booking;
  }

  async verifyArrivalCode(bookingId: string, code: string): Promise<Booking> {
    await delay(300);
    const booking = this.requireBooking(bookingId);
    if (booking.verificationCode !== code.trim()) {
      throw new Error("That code doesn't match — ask the renter to double-check it.");
    }
    booking.status = 'in_progress';
    booking.checkInAt = new Date().toISOString();
    return booking;
  }

  async checkOut(bookingId: string): Promise<Booking> {
    await delay(200);
    const booking = this.requireBooking(bookingId);
    booking.status = 'completed';
    booking.checkOutAt = new Date().toISOString();
    return booking;
  }

  async extendBooking(bookingId: string, extraMinutes: number): Promise<Booking> {
    await delay(300);
    const booking = this.requireBooking(bookingId);
    const listing = this.requireListing(booking.listingId);
    const newEnd = new Date(new Date(booking.endTime).getTime() + extraMinutes * 60000);
    booking.endTime = newEnd.toISOString();
    if (booking.pricingModel === 'flat') {
      booking.totalPrice += Math.round(listing.pricePerHour * (extraMinutes / 60));
    }
    return booking;
  }

  async getBookingsForOwner(ownerId: string): Promise<Booking[]> {
    await delay(150);
    const ownedListingIds = new Set(
      this.listings.filter((listing) => listing.ownerId === ownerId).map((listing) => listing.id)
    );
    return this.bookings
      .filter((booking) => ownedListingIds.has(booking.listingId))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  async getBookingRequestsForOwner(ownerId: string): Promise<Booking[]> {
    const all = await this.getBookingsForOwner(ownerId);
    return all.filter((booking) => booking.status === 'pending');
  }

  async respondToBookingRequest(bookingId: string, accept: boolean): Promise<Booking> {
    await delay(300);
    const booking = this.requireBooking(bookingId);
    booking.status = accept ? 'booked' : 'declined';
    return booking;
  }

  private requireBooking(id: string): Booking {
    const booking = this.bookings.find((b) => b.id === id);
    if (!booking) throw new Error(`Booking ${id} not found`);
    return booking;
  }

  private requireListing(id: string): Listing {
    const listing = this.listings.find((l) => l.id === id);
    if (!listing) throw new Error(`Listing ${id} not found`);
    return listing;
  }
}

// The one switch that decides which backend the whole app talks to. See
// `supabaseClient.ts` for the `isSupabaseConfigured` flag's definition and
// the dev-only console.log announcing which mode is active — this file
// deliberately doesn't log again to avoid duplicate noise.
export const dataSource: DataSource = isSupabaseConfigured
  ? new SupabaseDataSource()
  : new MockDataSource();

export { CURRENT_USER_ID };