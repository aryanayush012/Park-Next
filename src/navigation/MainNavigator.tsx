import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '../components/BottomTabBar';
import { MainTabParamList } from './types';
import { useRole } from './RoleContext';
import { useTranslation } from '../i18n';
import { RenterHomeStackNavigator } from './RenterHomeStackNavigator';
import { RenterBookingsStackNavigator } from './RenterBookingsStackNavigator';
import { DashboardScreen } from '../screens/provider/DashboardScreen';
import { ProviderListingsStackNavigator } from './ProviderListingsStackNavigator';
import { ProviderBookingsStackNavigator } from './ProviderBookingsStackNavigator';
import { ProfileScreen } from '../screens/common/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * One tab navigator for both modes, with the role-specific tabs swapped in
 * and out around a Profile tab that is always present.
 *
 * Deliberately *not* two separate navigators picked between. Swapping those
 * unmounts the entire tree, so flipping the Provider mode switch — which
 * lives on Profile — threw you out of the screen you were standing on and
 * back to Home every time. With a single navigator and one route name
 * (`Profile`) common to both modes, React Navigation carries the focused tab
 * across the change, so the toggle leaves you exactly where you were and only
 * the tabs around you change.
 *
 * Renter and provider route names are kept distinct for the matching reason:
 * reusing one name for two different components would hand the new tab the
 * old one's leftover nested stack state.
 */
export function MainNavigator() {
  const { activeRole } = useRole();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      {activeRole === 'provider' ? (
        <>
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ tabBarLabel: t('tabs.home') }}
          />
          <Tab.Screen
            name="Listings"
            component={ProviderListingsStackNavigator}
            options={{ tabBarLabel: t('tabs.listings') }}
          />
          {/* Not "Bookings": a provider has no bookings of their own, these
              are other people's requests to use their spots. */}
          <Tab.Screen
            name="Requests"
            component={ProviderBookingsStackNavigator}
            options={{ tabBarLabel: t('tabs.requests') }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="Home"
            component={RenterHomeStackNavigator}
            options={{ tabBarLabel: t('tabs.home') }}
          />
          <Tab.Screen
            name="Bookings"
            component={RenterBookingsStackNavigator}
            options={{ tabBarLabel: t('tabs.bookings') }}
          />
        </>
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t('tabs.profile') }}
      />
    </Tab.Navigator>
  );
}
