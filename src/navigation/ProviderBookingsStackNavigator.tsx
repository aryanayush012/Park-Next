import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProviderBookingsStackParamList } from './types';
import { BookingRequestsScreen } from '../screens/provider/BookingRequestsScreen';
import { BookingDetailOwnerScreen } from '../screens/provider/BookingDetailOwnerScreen';

const Stack = createNativeStackNavigator<ProviderBookingsStackParamList>();

/** Bookings tab: incoming requests → a single booking's owner-side detail. */
export function ProviderBookingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingRequests" component={BookingRequestsScreen} />
      <Stack.Screen name="BookingDetailOwner" component={BookingDetailOwnerScreen} />
    </Stack.Navigator>
  );
}
