import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '../components/BottomTabBar';
import { RenterTabParamList } from './types';
import { RenterHomeStackNavigator } from './RenterHomeStackNavigator';
import { RenterBookingsStackNavigator } from './RenterBookingsStackNavigator';
import { ProfileScreen } from '../screens/common/ProfileScreen';

const Tab = createBottomTabNavigator<RenterTabParamList>();

export function RenterTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={RenterHomeStackNavigator} />
      <Tab.Screen name="Bookings" component={RenterBookingsStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
