import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { RoleProvider } from './RoleContext';
import { UserProfileProvider } from './UserProfileContext';
import { MainNavigator } from './MainNavigator';
import {
  SplashScreen,
  OnboardingScreen,
  SignUpEmailScreen,
  EmailOTPScreen,
} from '../screens/auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <UserProfileProvider>
      <RoleProvider>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
          <Stack.Screen name="EmailOTP" component={EmailOTPScreen} />
          <Stack.Screen name="Main" component={MainNavigator} />
        </Stack.Navigator>
      </RoleProvider>
    </UserProfileProvider>
  );
}