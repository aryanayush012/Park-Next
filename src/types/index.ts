/** Core domain types shared across the app. Expanded in later phases. */

export type UserRole = 'renter' | 'provider';

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  activeRole: UserRole;
  createdAt: string;
}

export type AmenityKey =
  | 'ev_charging'
  | 'covered'
  | 'cctv'
  | 'guarded'
  | 'car'
  | 'two_wheeler'
  | 'suv';

export interface Amenity {
  key: AmenityKey;
  label: string;
  /** Ionicons glyph name, e.g. "flash-outline". */
  icon: string;
}

export type VehicleType = 'two_wheeler' | 'car' | 'suv';

/** Listing-level state — whether the spot itself currently has an active booking. */
export type ListingStatus = 'available' | 'booked' | 'in_progress' | 'completed';

/** Flat = fixed price for the whole slot. Metered = price computed from actual check-in/out time. */
export type PricingModel = 'flat' | 'metered';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  /** Primary/cover photo — used by ListingCard. */
  photoUrl: string;
  /** Full gallery shown on Listing Detail. */
  photos: string[];
  distanceKm: number;
  pricePerHour: number;
  currency: string;
  pricingModel: PricingModel;
  rating: number;
  ratingCount: number;
  amenities: AmenityKey[];
  vehicleTypes: VehicleType[];
  status: ListingStatus;
  address: string;
  latitude: number;
  longitude: number;
  ownerId: string;
  /** Provider-controlled on/off switch — separate from the live `status` above. Renter search hides inactive listings. */
  isActive: boolean;
  /** 0 = Sunday ... 6 = Saturday. */
  availableDays?: number[];
  /** "HH:mm" 24-hour local time. */
  availableFrom?: string;
  /** "HH:mm" 24-hour local time. */
  availableUntil?: string;
}

export type BookingType = 'instant' | 'advance' | 'recurring';

/**
 * A booking's own lifecycle — distinct from a listing's overall status.
 * `pending` = a request awaiting the owner's Accept/Decline; renter-initiated
 * bookings created directly (this app's current flow) skip straight to `booked`.
 */
export type BookingStatus =
  | 'pending'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'declined';

export interface RecurringSchedule {
  /** 0 = Sunday ... 6 = Saturday, matches Date#getDay(). */
  days: number[];
  /** "HH:mm" 24-hour local time. */
  startTime: string;
  /** "HH:mm" 24-hour local time. */
  endTime: string;
}

export interface Booking {
  id: string;
  listingId: string;
  renterId: string;
  type: BookingType;
  status: BookingStatus;
  /** ISO timestamp of the (first, for recurring) occurrence start. */
  startTime: string;
  /** ISO timestamp of the (first, for recurring) occurrence end. */
  endTime: string;
  /** Estimated or final total, in the listing's currency. */
  totalPrice: number;
  pricingModel: PricingModel;
  recurring?: RecurringSchedule;
  /** Set once the renter taps "I've Arrived". */
  checkInAt?: string;
  /** Set once the renter taps "I'm Leaving / Confirm Vacated". */
  checkOutAt?: string;
  /** Shown on the owner's Booking Detail screen when known. */
  renterVehiclePlate?: string;
  renterVehicleType?: VehicleType;
  /**
   * 4-digit code shown to the renter and entered by the owner to confirm
   * arrival — replaces renter self-service "I've Arrived". Matching it
   * transitions the booking straight to `in_progress` (see
   * `DataSource.verifyArrivalCode`).
   */
  verificationCode: string;
}

export interface CreateBookingInput {
  listingId: string;
  renterId: string;
  type: BookingType;
  startTime: string;
  endTime: string;
  totalPrice: number;
  pricingModel: PricingModel;
  recurring?: RecurringSchedule;
  renterVehiclePlate?: string;
  renterVehicleType?: VehicleType;
}

/** A trimmed-down renter profile used only for display (Booking Requests / Booking Detail). */
export interface RenterProfile {
  id: string;
  name: string;
  rating: number;
  phone: string;
}

/** In-progress form state threaded through the multi-step Add Listing flow. */
export interface AddListingDraft {
  title: string;
  description: string;
  vehicleTypes: VehicleType[];
  address: string;
  latitude: number | null;
  longitude: number | null;
  amenities: AmenityKey[];
  /** Local device URIs from the image picker — no backend upload yet. */
  photos: string[];
  pricingModel: PricingModel;
  pricePerHour: number;
  availableDays: number[];
  availableFrom: string;
  availableUntil: string;
}

export interface CreateListingInput {
  title: string;
  description: string;
  photos: string[];
  pricePerHour: number;
  pricingModel: PricingModel;
  amenities: AmenityKey[];
  vehicleTypes: VehicleType[];
  address: string;
  latitude: number;
  longitude: number;
  ownerId: string;
  availableDays: number[];
  availableFrom: string;
  availableUntil: string;
}