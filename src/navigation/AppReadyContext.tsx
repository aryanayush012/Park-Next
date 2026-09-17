import React, { createContext, useContext } from 'react';

/**
 * Whether the animated splash has finished. `App.tsx` renders the splash as
 * an overlay ABOVE the navigator so the whole app can mount and boot
 * underneath it at no cost to startup time (see AnimatedSplash's own header
 * comment) — but that means every screen is already mounted, with its own
 * effects already firing, while the splash animation is still playing on top
 * of them. `useCurrentLocation` reads this to hold off requesting the
 * location permission (which pops a system dialog) until the splash is out
 * of the way, rather than the two competing for the screen at once.
 *
 * Defaults to `true` so anything that reads this outside the real provider
 * (a test, a Storybook-style preview) behaves as "ready" rather than
 * silently freezing forever.
 */
const AppReadyContext = createContext(true);

export function AppReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  return <AppReadyContext.Provider value={ready}>{children}</AppReadyContext.Provider>;
}

export function useAppReady(): boolean {
  return useContext(AppReadyContext);
}
