import {
  Booking,
  CreateBookingInput,
  CreateListingInput,
  CreateReviewInput,
  Listing,
  RenterProfile,
  Review,
} from '../types';
import { CURRENT_USER_ID, MOCK_BOOKINGS, MOCK_LISTINGS, MOCK_RENTERS } from './mockData';
import { isSupabaseConfigured } from './supabaseClient';
import { SupabaseDataSource } from './SupabaseDataSource';
import { generateVerificationCode } from '../utils/verificationCode';
import { computeResponseDeadline } from '../utils/responseDeadline';

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

  /**
   * The public-facing slice of a user's profile (name/phone/rating) — used
   * for "Contact Host"/"Contact Renter" cards once a booking exists. Never
   * used to gate that reveal itself (screens already only show these cards
   * once a booking is confirmed); this just fetches whichever backend has
   * the data. Returns `undefined` if the user can't be found.
   */
  getPublicProfile(userId: string): Promise<RenterProfile | undefined>;

  /** All bookings (any status) across an owner's listings — dashboard stats, booking detail. */
  getBookingsForOwner(ownerId: string): Promise<Booking[]>;
  /** Just the `pending` ones awaiting Accept/Decline. */
  getBookingRequestsForOwner(ownerId: string): Promise<Booking[]>;
  /**
   * The owner's Accept/Decline action. Throws if the request is no longer
   * `pending` (already responded to, expired, or cancelled by the renter) —
   * a real possibility given the response-deadline window, so the screen
   * calling this should be ready to show that error rather than assume it
   * always succeeds.
   */
  respondToBookingRequest(bookingId: string, accept: boolean): Promise<Booking>;
  /**
   * Flips an overdue `pending` request to `expired` — see
   * `utils/bookingRequest.ts`'s `expireIfOverdue`, the only intended caller.
   * A no-op (returns the booking unchanged) if it's already left `pending`
   * by the time this runs, so it's safe to call from more than one screen.
   */
  expireBookingRequest(bookingId: string): Promise<Booking>;
  /** Lets the renter withdraw their own request while it's still `pending`
   * rather than wait out the full response window. A no-op if it's already
   * left `pending`. */
  cancelBooking(bookingId: string): Promise<Booking>;

  /**
   * Leaves a review for a completed booking — the renter reviewing the
   * host/listing (when `reviewerId` matches the booking's `renterId`), or
   * the host reviewing the renter (any other participant). Throws if the
   * booking isn't `completed` yet, or if this reviewer already left one for
   * it (mirrors the real backend's unique `(booking_id, reviewer_id)`
   * constraint). A listing's/profile's `rating`/`ratingCount` reflect this
   * immediately afterward — see `getListings`/`getPublicProfile`.
   */
  submitReview(input: CreateReviewInput): Promise<Review>;
  /**
   * The review a specific reviewer already left for a booking, if any —
   * lets a screen show "your review" (read-only) instead of the "leave a
   * review" form once one exists.
   */
  getMyReviewForBooking(bookingId: string, reviewerId: string): Promise<Review | undefined>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let bookingSeq = MOCK_BOOKINGS.length + 1;
let listingSeq = MOCK_LISTINGS.length + 1;
let reviewSeq = 1;

class MockDataSource implements DataSource {
  private listings: Listing[] = [...MOCK_LISTINGS];
  private bookings: Booking[] = [...MOCK_BOOKINGS];
  private reviews: Review[] = [];

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
    // Every new booking starts as a request awaiting the owner's
    // Accept/Decline — never straight to `booked` — so the renter flow's
    // "waiting for approval" step (Booking Confirmation) and the owner's
    // Booking Requests screen both apply uniformly, not just to whatever
    // sample `pending` rows happened to already be seeded.
    const booking: Booking = {
      id: `b${bookingSeq++}`,
      status: 'pending',
      responseDeadline: computeResponseDeadline(input.type, input.startTime),
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
    const checkOutTime = new Date();
    booking.status = 'completed';
    booking.checkOutAt = checkOutTime.toISOString();
    // The slot was only actually held until whenever the renter really
    // left — not until whatever end time was originally booked. Shrinking
    // (or, for an overstay, extending) `endTime` to match is what frees the
    // remainder of an early-finished booking for someone else to book,
    // instead of it staying "occupied" for the rest of the original window.
    booking.endTime = checkOutTime.toISOString();
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

  async getPublicProfile(userId: string): Promise<RenterProfile | undefined> {
    await delay(100);
    return MOCK_RENTERS[userId];
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
    if (booking.status !== 'pending') {
      throw new Error(
        booking.status === 'expired'
          ? 'This request already expired — you can no longer respond to it.'
          : 'This request is no longer pending.'
      );
    }
    booking.status = accept ? 'booked' : 'declined';
    return booking;
  }

  async expireBookingRequest(bookingId: string): Promise<Booking> {
    await delay(100);
    const booking = this.requireBooking(bookingId);
    if (booking.status === 'pending') {
      booking.status = 'expired';
    }
    return booking;
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    await delay(200);
    const booking = this.requireBooking(bookingId);
    if (booking.status === 'pending') {
      booking.status = 'cancelled';
    }
    return booking;
  }

  async submitReview(input: CreateReviewInput): Promise<Review> {
    await delay(300);
    const booking = this.requireBooking(input.bookingId);
    if (booking.status !== 'completed') {
      throw new Error('You can only leave a review once the booking is completed.');
    }
    const already = this.reviews.find(
      (r) => r.bookingId === input.bookingId && r.reviewerId === input.reviewerId
    );
    if (already) {
      throw new Error('You already left a review for this booking.');
    }

    const review: Review = {
      id: `rv${reviewSeq++}`,
      createdAt: new Date().toISOString(),
      ...input,
    };
    this.reviews.push(review);

    // Blend the new rating into whichever aggregate it belongs to — same
    // math a real `avg()`/`count()` over the `reviews` table produces,
    // applied incrementally since mock mode has no reviews table to
    // recompute from. A renter reviewing the host updates that listing's
    // rating; anyone reviewing the renter updates the renter's own profile
    // rating (looked up via MOCK_RENTERS, mutated in place like
    // `UserProfileContext` already does elsewhere).
    if (input.reviewerId === booking.renterId) {
      const listing = this.requireListing(booking.listingId);
      const newCount = listing.ratingCount + 1;
      listing.rating = Number(
        ((listing.rating * listing.ratingCount + input.rating) / newCount).toFixed(2)
      );
      listing.ratingCount = newCount;
    }
    const revieweeProfile = MOCK_RENTERS[input.revieweeId];
    if (revieweeProfile) {
      // MOCK_RENTERS has no separate rating-count field to blend against
      // exactly — assume a plausible small prior count so one new review
      // nudges the average visibly instead of swinging it wildly.
      const assumedPriorCount = 12;
      revieweeProfile.rating = Number(
        (
          (revieweeProfile.rating * assumedPriorCount + input.rating) /
          (assumedPriorCount + 1)
        ).toFixed(2)
      );
    }

    return review;
  }

  async getMyReviewForBooking(bookingId: string, reviewerId: string): Promise<Review | undefined> {
    await delay(100);
    return this.reviews.find((r) => r.bookingId === bookingId && r.reviewerId === reviewerId);
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