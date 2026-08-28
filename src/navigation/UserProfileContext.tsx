import React, { createContext, useContext, useMemo, useState } from 'react';
import { CURRENT_USER_ID, MOCK_RENTERS } from '../data/mockData';

interface UserProfileContextValue {
  name: string;
  phone: string;
  updateProfile: (updates: { name?: string; phone?: string }) => void;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

/**
 * The signed-in user's own editable name/phone (see Profile screen). Mocked
 * auth doesn't have a real account record to persist this to, so it's held
 * here for the life of the app session — seeded from, and kept in sync
 * with, `MOCK_RENTERS[CURRENT_USER_ID]` so every other screen that looks the
 * current user up by id (as a renter or as a listing owner, when someone
 * else needs to "Contact Host"/"Contact Renter") sees the latest details.
 */
export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const seed = MOCK_RENTERS[CURRENT_USER_ID];
  const [name, setName] = useState(seed?.name ?? 'You');
  const [phone, setPhone] = useState(seed?.phone ?? '');

  const value = useMemo<UserProfileContextValue>(
    () => ({
      name,
      phone,
      updateProfile: (updates) => {
        if (updates.name !== undefined) setName(updates.name);
        if (updates.phone !== undefined) setPhone(updates.phone);
        Object.assign(MOCK_RENTERS[CURRENT_USER_ID], updates);
      },
    }),
    [name, phone]
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}