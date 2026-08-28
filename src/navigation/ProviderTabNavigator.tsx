import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '../components/BottomTabBar';
import { ProviderTabParamList } from './types';
import { DashboardScreen } from '../screens/provider/DashboardScreen';
import { ProviderListingsStackNavigator } from './ProviderListingsStackNavigator';
import { ProviderBookingsStackNavigator } from './ProviderBookingsStackNavigator';
import { ProfileScreen } from '../screens/common/ProfileScreen';

const Tab = createBottomTabNavigator<ProviderTabParamList>();

export function ProviderTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Listings" component={ProviderListingsStackNavigator} />
      <Tab.Screen name="Bookings" component={ProviderBookingsStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
