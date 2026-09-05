import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

/**
 * Navigation handle for code that runs outside the React tree.
 *
 * Notification taps arrive from the native side — including on a cold
 * start, before any screen has mounted — so there is no `navigation` prop
 * to reach for. Always guard with `navigationRef.isReady()`: a tap that
 * launched the app fires before the container exists.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();