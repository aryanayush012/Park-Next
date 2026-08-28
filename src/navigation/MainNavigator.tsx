import React from 'react';
import { useRole } from './RoleContext';
import { RenterTabNavigator } from './RenterTabNavigator';
import { ProviderTabNavigator } from './ProviderTabNavigator';

/**
 * Renders the renter (3-tab) or provider (4-tab) tab navigator depending on
 * the active role. The switch lives on the Profile screen for now.
 */
export function MainNavigator() {
  const { activeRole } = useRole();
  return activeRole === 'provider' ? <ProviderTabNavigator /> : <RenterTabNavigator />;
}
