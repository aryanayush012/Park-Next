import { AddListingDraft, CreateListingInput, Listing } from '../../types';

export const DEFAULT_ADD_LISTING_DRAFT: AddListingDraft = {
  title: '',
  description: '',
  vehicleTypes: [],
  address: '',
  latitude: null,
  longitude: null,
  amenities: [],
  photos: [],
  pricingModel: 'flat',
  pricePerHour: 30,
  availableDays: [1, 2, 3, 4, 5],
  availableFrom: '06:00',
  availableUntil: '23:00',
};

/** Builds an edit draft pre-filled from an existing listing — best-effort pre-fill for the Edit action. */
export function mapListingToDraft(listing: Listing): AddListingDraft {
  return {
    title: listing.title,
    description: listing.description,
    vehicleTypes: listing.vehicleTypes,
    address: listing.address,
    latitude: listing.latitude,
    longitude: listing.longitude,
    amenities: listing.amenities.filter((key) =>
      ['ev_charging', 'covered', 'cctv', 'guarded'].includes(key)
    ),
    photos: listing.photos.length > 0 ? listing.photos : [listing.photoUrl].filter(Boolean),
    pricingModel: listing.pricingModel,
    pricePerHour: listing.pricePerHour,
    availableDays: listing.availableDays ?? [1, 2, 3, 4, 5],
    availableFrom: listing.availableFrom ?? '06:00',
    availableUntil: listing.availableUntil ?? '23:00',
  };
}

/** Converts a completed draft into the shape `DataSource.createListing`/`updateListing` expect. */
export function mapDraftToCreateInput(draft: AddListingDraft, ownerId: string): CreateListingInput {
  if (draft.latitude === null || draft.longitude === null) {
    throw new Error('A location must be picked before publishing.');
  }
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    photos: draft.photos,
    pricePerHour: draft.pricePerHour,
    pricingModel: draft.pricingModel,
    amenities: draft.amenities,
    vehicleTypes: draft.vehicleTypes,
    address: draft.address.trim(),
    latitude: draft.latitude,
    longitude: draft.longitude,
    ownerId,
    availableDays: draft.availableDays,
    availableFrom: draft.availableFrom,
    availableUntil: draft.availableUntil,
  };
}
