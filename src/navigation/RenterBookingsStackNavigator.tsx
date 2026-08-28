import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RenterBookingsStackParamList } from './types';
import { MyBookingsScreen } from '../screens/renter/MyBookingsScreen';
import { BookingConfirmationScreen } from '../screens/renter/BookingConfirmationScreen';
import { ActiveBookingScreen } from '../screens/renter/ActiveBookingScreen';
import { BookingDetailScreen } from '../screens/renter/BookingDetailScreen';

const Stack = createNativeStackNavigator<RenterBookingsStackParamList>();

/** Bookings tab stack: My Bookings → a booking's own confirmation/active/detail view. */
export function RenterBookingsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="ActiveBooking" component={ActiveBookingScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
    </Stack.Navigator>
  );
}
