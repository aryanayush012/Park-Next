import { Amenity, AmenityKey, Booking, GeoPoint, Listing, RenterProfile, VehicleType } from '../types';

/** The signed-in mock user id — replaced by real auth state in a later phase. Used as both the renter id and, when the role toggle is switched to provider, the listing owner id — one account, two hats. */
export const CURRENT_USER_ID = 'u9';

/** Amenity keys shown in the provider "Amenities" picker — excludes vehicle-type keys, which have their own selector. */
export const AMENITY_SELECTOR_KEYS: AmenityKey[] = ['ev_charging', 'covered', 'cctv', 'guarded'];

/**
 * A single directory of {id, name, rating, phone} covering both renters
 * (shown on the provider's Booking Requests / Booking Detail screens) and
 * listing owners (shown to the renter as "Contact Host" once a booking is
 * confirmed — see `ActiveBookingScreen`/`BookingConfirmationScreen`). One
 * flat map since, in this app's single-account "one account, two hats"
 * model, the same id can appear on either side depending on the listing.
 * `u9`'s own entry is mutated in place by `UserProfileContext` when the
 * signed-in user edits their name/phone on the Profile screen, so anyone
 * looking them up here (as a renter or as a listing owner) always sees
 * their latest self-reported details.
 */
export const MOCK_RENTERS: Record<string, RenterProfile> = {
  u9: { id: 'u9', name: 'You', rating: 4.8, phone: '+919876500009' },
  u10: { id: 'u10', name: 'Rohit Verma', rating: 4.5, phone: '+919876500010' },
  u11: { id: 'u11', name: 'Sneha Iyer', rating: 4.6, phone: '+919876500011' },
  u12: { id: 'u12', name: 'Ananya Rao', rating: 4.9, phone: '+919876500012' },
  u13: { id: 'u13', name: 'Vikram Singh', rating: 4.6, phone: '+919876500013' },
  u14: { id: 'u14', name: 'Priya Menon', rating: 4.8, phone: '+919876500014' },
  u15: { id: 'u15', name: 'Farhan Khan', rating: 4.7, phone: '+919876500015' },
  // Owners of the listings that belong to someone other than the current
  // user (l2, l4, l6) — needed so a renter booking one of those spots has
  // someone to look up for the "Contact Host" card.
  u2: { id: 'u2', name: 'Anil Kumar', rating: 4.7, phone: '+919876500002' },
  u4: { id: 'u4', name: 'Deepa Nair', rating: 4.6, phone: '+919876500004' },
  u6: { id: 'u6', name: 'Karthik Reddy', rating: 4.5, phone: '+919876500006' },
};

export const AMENITIES: Record<AmenityKey, Amenity> = {
  ev_charging: { key: 'ev_charging', label: 'EV Charging', icon: 'flash-outline' },
  covered: { key: 'covered', label: 'Covered', icon: 'shield-checkmark-outline' },
  cctv: { key: 'cctv', label: 'CCTV', icon: 'videocam-outline' },
  guarded: { key: 'guarded', label: 'Guarded', icon: 'lock-closed-outline' },
  car: { key: 'car', label: 'Car', icon: 'car-outline' },
  two_wheeler: { key: 'two_wheeler', label: 'Two-Wheeler', icon: 'bicycle-outline' },
  suv: { key: 'suv', label: 'SUV', icon: 'car-sport-outline' },
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  two_wheeler: 'Two-Wheeler',
  car: 'Car',
  suv: 'SUV',
};

/** Mock "current location" used as the map center / directions origin — Koramangala, Bengaluru. */
export const MOCK_CURRENT_LOCATION: GeoPoint = {
  latitude: 12.9352,
  longitude: 77.6146,
};

const galleryFor = (seed: string) =>
  [1, 2, 3, 4].map((n) => `https://picsum.photos/seed/parknext-${seed}-${n}/800/600`);

export const MOCK_LISTINGS: Listing[] = [
  {
    id: 'l1',
    title: 'Koramangala 5th Block Covered Spot',
    description:
      'Shaded covered spot right off 80 Feet Road, five minutes from Forum Mall. Easy in-out access, no gate restrictions after 8pm.',
    photoUrl: 'https://picsum.photos/seed/parknext-l1-1/800/600',
    photos: galleryFor('l1'),
    distanceKm: 0.6,
    pricePerHour: 40,
    currency: '₹',
    pricingModel: 'metered',
    rating: 4.8,
    ratingCount: 128,
    amenities: ['ev_charging', 'covered', 'cctv'],
    vehicleTypes: ['car', 'suv', 'two_wheeler'],
    status: 'available',
    address: '80 Feet Road, Koramangala 5th Block, Bengaluru 560095',
    latitude: 12.9352,
    longitude: 77.6146,
    ownerId: CURRENT_USER_ID,
    isActive: true,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    availableFrom: '06:00',
    availableUntil: '23:00',
  },
  {
    id: 'l2',
    title: 'Indiranagar Society Basement Spot',
    description:
      'Secure basement parking inside a gated society, guard on duty round the clock. Great for overnight or full-day parking.',
    photoUrl: 'https://picsum.photos/seed/parknext-l2-1/800/600',
    photos: galleryFor('l2'),
    distanceKm: 1.2,
    pricePerHour: 35,
    currency: '₹',
    pricingModel: 'flat',
    rating: 4.6,
    ratingCount: 84,
    amenities: ['cctv', 'guarded', 'covered'],
    vehicleTypes: ['car', 'suv'],
    status: 'booked',
    address: '12th Main, Indiranagar, Bengaluru 560038',
    latitude: 12.9719,
    longitude: 77.6412,
    ownerId: 'u2',
    isActive: true,
  },
  {
    id: 'l3',
    title: 'HSR Layout Sector 2 Driveway',
    description:
      'Open driveway spot with room for one car. Owner works from home so the spot is available most of the day.',
    photoUrl: 'https://picsum.photos/seed/parknext-l3-1/800/600',
    photos: galleryFor('l3'),
    distanceKm: 1.9,
    pricePerHour: 25,
    currency: '₹',
    pricingModel: 'metered',
    rating: 4.3,
    ratingCount: 41,
    amenities: ['car'],
    vehicleTypes: ['car', 'two_wheeler'],
    status: 'available',
    address: '27th Main, HSR Layout Sector 2, Bengaluru 560102',
    latitude: 12.9121,
    longitude: 77.6446,
    ownerId: CURRENT_USER_ID,
    isActive: true,
    availableDays: [1, 2, 3, 4, 5],
    availableFrom: '06:00',
    availableUntil: '22:00',
  },
  {
    id: 'l4',
    title: 'Whitefield ITPL Main Road Spot',
    description:
      'Covered spot with EV charging point, two minutes’ walk from ITPL main gate. Popular with commuters on weekdays.',
    photoUrl: 'https://picsum.photos/seed/parknext-l4-1/800/600',
    photos: galleryFor('l4'),
    distanceKm: 3.4,
    pricePerHour: 30,
    currency: '₹',
    pricingModel: 'flat',
    rating: 4.5,
    ratingCount: 63,
    amenities: ['ev_charging', 'covered'],
    vehicleTypes: ['car', 'suv', 'two_wheeler'],
    status: 'available',
    address: 'ITPL Main Road, Whitefield, Bengaluru 560066',
    latitude: 12.9698,
    longitude: 77.7500,
    ownerId: 'u4',
    isActive: true,
  },
  {
    id: 'l5',
    title: 'Koramangala 80 Feet Road Corner Spot',
    description:
      'Street-adjacent private spot with CCTV coverage. Fits an SUV comfortably.',
    photoUrl: 'https://picsum.photos/seed/parknext-l5-1/800/600',
    photos: galleryFor('l5'),
    distanceKm: 0.9,
    pricePerHour: 45,
    currency: '₹',
    pricingModel: 'metered',
    rating: 4.7,
    ratingCount: 96,
    amenities: ['cctv', 'guarded'],
    vehicleTypes: ['car', 'suv'],
    status: 'available',
    address: '80 Feet Road, Koramangala 4th Block, Bengaluru 560034',
    latitude: 12.9301,
    longitude: 77.6203,
    ownerId: CURRENT_USER_ID,
    isActive: false,
    availableDays: [0, 6],
    availableFrom: '08:00',
    availableUntil: '20:00',
  },
  {
    id: 'l6',
    title: 'Indiranagar 100ft Road Spot',
    description: 'Compact spot, best suited for two-wheelers and hatchbacks.',
    photoUrl: 'https://picsum.photos/seed/parknext-l6-1/800/600',
    photos: galleryFor('l6'),
    distanceKm: 2.1,
    pricePerHour: 20,
    currency: '₹',
    pricingModel: 'flat',
    rating: 4.4,
    ratingCount: 57,
    amenities: ['covered'],
    vehicleTypes: ['two_wheeler', 'car'],
    status: 'available',
    address: '100 Feet Road, Indiranagar, Bengaluru 560038',
    latitude: 12.9783,
    longitude: 77.6408,
    ownerId: 'u6',
    isActive: true,
  },
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'b1',
    listingId: 'l2',
    renterId: 'u9',
    type: 'advance',
    status: 'booked',
    startTime: todayAt(10, 0),
    endTime: todayAt(13, 0),
    totalPrice: 120,
    pricingModel: 'flat',
    verificationCode: '4821',
  },
  {
    id: 'b2',
    listingId: 'l4',
    renterId: 'u9',
    type: 'advance',
    status: 'booked',
    startTime: tomorrowAt(18, 0),
    endTime: tomorrowAt(21, 0),
    totalPrice: 90,
    pricingModel: 'flat',
    verificationCode: '7734',
  },
  {
    id: 'b3',
    listingId: 'l6',
    renterId: 'u9',
    type: 'instant',
    status: 'completed',
    startTime: daysAgoAt(1, 14, 0),
    endTime: daysAgoAt(1, 16, 0),
    totalPrice: 40,
    pricingModel: 'flat',
    checkInAt: daysAgoAt(1, 14, 4),
    checkOutAt: daysAgoAt(1, 16, 2),
    verificationCode: '1092',
  },
  {
    id: 'b4',
    listingId: 'l4',
    renterId: 'u9',
    type: 'advance',
    status: 'completed',
    startTime: daysAgoAt(6, 9, 0),
    endTime: daysAgoAt(6, 12, 0),
    totalPrice: 90,
    pricingModel: 'flat',
    checkInAt: daysAgoAt(6, 9, 5),
    checkOutAt: daysAgoAt(6, 12, 10),
    verificationCode: '5567',
  },

  // --- Owner-side bookings, already accepted, on the current user's own provider listings (l1, l3, l5) ---
  {
    id: 'ob1',
    listingId: 'l1',
    renterId: 'u10',
    type: 'advance',
    status: 'booked',
    startTime: todayAt(16, 0),
    endTime: todayAt(19, 0),
    totalPrice: 120,
    pricingModel: 'metered',
    renterVehiclePlate: 'KA 05 MN 4471',
    renterVehicleType: 'car',
    verificationCode: '3390',
  },
  {
    id: 'ob2',
    listingId: 'l3',
    renterId: 'u11',
    type: 'recurring',
    status: 'booked',
    startTime: tomorrowAt(9, 0),
    endTime: tomorrowAt(18, 0),
    totalPrice: 225,
    pricingModel: 'metered',
    recurring: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
    renterVehiclePlate: 'KA 03 JK 8821',
    renterVehicleType: 'car',
    verificationCode: '8146',
  },

  // --- Pending booking requests awaiting the owner's Accept/Decline (Booking Requests screen) ---
  {
    id: 'req1',
    listingId: 'l1',
    renterId: 'u12',
    type: 'instant',
    status: 'pending',
    startTime: todayAt(14, 0),
    endTime: todayAt(16, 0),
    totalPrice: 80,
    pricingModel: 'metered',
    renterVehiclePlate: 'KA 01 QW 3345',
    renterVehicleType: 'car',
    verificationCode: '2278',
  },
  {
    id: 'req2',
    listingId: 'l3',
    renterId: 'u13',
    type: 'advance',
    status: 'pending',
    startTime: tomorrowAt(9, 0),
    endTime: tomorrowAt(11, 0),
    totalPrice: 50,
    pricingModel: 'metered',
    renterVehiclePlate: 'KA 09 XY 7712',
    renterVehicleType: 'two_wheeler',
    verificationCode: '6603',
  },
  {
    id: 'req3',
    listingId: 'l1',
    renterId: 'u14',
    type: 'recurring',
    status: 'pending',
    startTime: nextWeekdayAt(1, 9, 0),
    endTime: nextWeekdayAt(1, 18, 0),
    totalPrice: 360,
    pricingModel: 'metered',
    recurring: { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
    renterVehiclePlate: 'KA 02 LM 5567',
    renterVehicleType: 'car',
    verificationCode: '9915',
  },
  {
    id: 'req4',
    listingId: 'l5',
    renterId: 'u15',
    type: 'recurring',
    status: 'pending',
    startTime: nextWeekdayAt(6, 8, 0),
    endTime: nextWeekdayAt(6, 20, 0),
    totalPrice: 540,
    pricingModel: 'metered',
    recurring: { days: [0, 6], startTime: '08:00', endTime: '20:00' },
    renterVehiclePlate: 'KA 41 AB 9090',
    renterVehicleType: 'suv',
    verificationCode: '0487',
  },
];

function todayAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function tomorrowAt(hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function daysAgoAt(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Next upcoming date (today included) matching `targetDay` (0=Sun..6=Sat), at the given time. */
function nextWeekdayAt(targetDay: number, hour: number, minute: number): string {
  const d = new Date();
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}