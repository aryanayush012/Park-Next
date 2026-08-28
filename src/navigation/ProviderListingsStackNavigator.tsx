import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProviderListingsStackParamList } from './types';
import { MyListingsScreen } from '../screens/provider/MyListingsScreen';
import { AddListingDetailsScreen } from '../screens/provider/AddListingDetailsScreen';
import { AddListingAmenitiesPhotosScreen } from '../screens/provider/AddListingAmenitiesPhotosScreen';
import { AddListingPricingAvailabilityScreen } from '../screens/provider/AddListingPricingAvailabilityScreen';
import { ListingReviewPublishScreen } from '../screens/provider/ListingReviewPublishScreen';

const Stack = createNativeStackNavigator<ProviderListingsStackParamList>();

/** Listings tab: My Listings → the full Add/Edit Listing flow. */
export function ProviderListingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyListings" component={MyListingsScreen} />
      <Stack.Screen name="AddListingDetails" component={AddListingDetailsScreen} />
      <Stack.Screen name="AddListingAmenitiesPhotos" component={AddListingAmenitiesPhotosScreen} />
      <Stack.Screen
        name="AddListingPricingAvailability"
        component={AddListingPricingAvailabilityScreen}
      />
      <Stack.Screen name="ListingReviewPublish" component={ListingReviewPublishScreen} />
    </Stack.Navigator>
  );
}
