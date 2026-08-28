import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RenterHomeStackParamList } from './types';
import { HomeMapScreen } from '../screens/renter/HomeMapScreen';
import { ListingDetailScreen } from '../screens/renter/ListingDetailScreen';
import { BookingFlowScreen } from '../screens/renter/BookingFlowScreen';
import { BookingConfirmationScreen } from '../screens/renter/BookingConfirmationScreen';
import { ActiveBookingScreen } from '../screens/renter/ActiveBookingScreen';

const Stack = createNativeStackNavigator<RenterHomeStackParamList>();

/** Home tab stack: map search → listing detail → booking flow → confirmation → active booking. */
export function RenterHomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMap" component={HomeMapScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
    </Stack.Navigator>
  );
}
