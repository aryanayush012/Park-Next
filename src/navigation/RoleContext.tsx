import React, { createContext, useContext, useMemo, useState } from 'react';
import { UserRole } from '../types';

interface RoleContextValue {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  toggleRole: () => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

/**
 * Tracks which mode (renter/provider) the current user is browsing in.
 * A real user can be both; this is just a lightweight UI-level switch for
 * now (see Profile screen), full role-based routing is refined later.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState<UserRole>('renter');

  const value = useMemo<RoleContextValue>(
    () => ({
      activeRole,
      setActiveRole,
      toggleRole: () => setActiveRole((prev) => (prev === 'renter' ? 'provider' : 'renter')),
    }),
    [activeRole]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
