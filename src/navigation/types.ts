import { NavigatorScreenParams } from '@react-navigation/native';
import { AddListingDraft, BookingType } from '../types';

/**
 * The exact "when do you need it" answer from the Home/Map search's
 * Now/Later picker, carried forward so later screens don't ask again.
 * `dateOffset` is relative to "today" (0 = today, matches
 * `utils/scheduling`'s `nextDays`); only meaningful for advance bookings —
 * instant bookings always start now.
 */
export interface ScheduleSelection {
  dateOffset: number;
  startMinutes: number;
  durationMinutes: number;
}

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPasswordEmail: undefined;
  ForgotPasswordOTP: { email: string };
  /** Reachable only while `isPasswordRecovery` is set — see the comment on
   * that flag in `AuthContext.tsx`. Not part of the normal signed-out
   * stack's flow between screens, so it takes no params of its own. */
  ResetPassword: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

/**
 * `BookingConfirmation` and `ActiveBooking` are reachable from both the Home
 * and Bookings tab stacks. They're typed against this minimal shared param
 * list (rather than either full stack's list) so the same screen component
 * can be registered on both stacks without a navigation-prop type mismatch.
 */
export type SharedBookingParamList = {
  BookingConfirmation: { bookingId: string; justBooked?: boolean };
  ActiveBooking: { bookingId: string };
};

/** Home tab — map search through to an active booking, all pushed on one stack. */
export type RenterHomeStackParamList = SharedBookingParamList & {
  HomeMap: undefined;
  /**
   * `defaultBookingType` + `schedule` carry forward the Now/Later + date/time
   * already chosen on the Home/Map search before this spot was picked, so
   * neither ListingDetail nor BookingFlow need to ask again — they just
   * render the instant flow or the advance flow, pre-filled.
   */
  ListingDetail: { listingId: string; defaultBookingType?: BookingType; schedule?: ScheduleSelection };
  BookingFlow: { listingId: string; bookingType: BookingType; schedule?: ScheduleSelection };
};

/** Bookings tab — My Bookings through to a booking's own detail/confirmation. */
export type RenterBookingsStackParamList = SharedBookingParamList & {
  MyBookings: undefined;
  BookingDetail: { bookingId: string };
};

/** Add Listing's 3-step flow + review, threaded via one accumulated draft object. */
export type AddListingParamList = {
  AddListingDetails: { draft?: AddListingDraft; editingListingId?: string };
  AddListingAmenitiesPhotos: { draft: AddListingDraft; editingListingId?: string };
  AddListingPricingAvailability: { draft: AddListingDraft; editingListingId?: string };
  ListingReviewPublish: { draft: AddListingDraft; editingListingId?: string };
};

/** Listings tab — My Listings through the whole Add/Edit Listing flow. */
export type ProviderListingsStackParamList = AddListingParamList & {
  MyListings: undefined;
};

/** Requests tab — incoming requests through to a single booking's owner-side detail. */
export type ProviderBookingsStackParamList = {
  BookingRequests: undefined;
  BookingDetailOwner: { bookingId: string };
};

/**
 * Every tab in the app, across both modes — one list because both modes are
 * served by a single navigator (see `MainNavigator`). Renter and provider
 * route names are deliberately distinct so a tab that changes meaning with
 * the role can't inherit the other role's leftover nested state:
 *
 * - renter: `Home` (map) + `Bookings` (their own bookings)
 * - provider: `Dashboard` + `Listings` + `Requests` (bookings *others*
 *   have made on their spots — not bookings of their own, which is why this
 *   isn't called Bookings)
 * - both: `Profile`
 */
export type MainTabParamList = {
  Home: undefined;
  Bookings: undefined;
  Dashboard: undefined;
  Listings: NavigatorScreenParams<ProviderListingsStackParamList>;
  Requests: NavigatorScreenParams<ProviderBookingsStackParamList>;
  Profile: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}