import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CURRENT_USER_ID, MOCK_RENTERS } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../data/supabaseClient';
import { useAuth } from './AuthContext';

interface ProfileUpdates {
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
}

interface UserProfileContextValue {
  name: string;
  phone: string;
  avatarUrl: string | null;
  /**
   * False right after a brand-new sign-in until name + phone are filled in —
   * `RootNavigator` uses this to show a mandatory "Complete Your Profile"
   * screen before letting anyone reach the main app, per the product
   * requirement that every account (Google or email + password) has a real
   * name and mobile number before use. A returning user whose profile is already
   * filled in (a real `profiles` row with name/phone already saved, or an
   * already-completed mock session) skips straight past it.
   */
  isProfileComplete: boolean;
  updateProfile: (updates: ProfileUpdates) => void;
  /** Called once by the mandatory Complete Your Profile screen — same as
   * `updateProfile`, but also flips `isProfileComplete` to `true`. */
  completeProfile: (details: { name: string; phone: string; avatarUrl?: string | null }) => void;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

/**
 * The signed-in user's own editable name/phone/avatar (see Profile screen
 * and the post-sign-in Complete Your Profile screen).
 *
 * In mock mode, there's no real account record to persist this to, so it's
 * held here for the life of the app session. Unlike the mock renter
 * directory's placeholder entry for `u9`, this deliberately starts blank —
 * every fresh mock sign-in still has to go through Complete Your Profile,
 * same as a real brand-new account would, rather than silently inheriting
 * the sample "You" placeholder. `MOCK_RENTERS[CURRENT_USER_ID]` is kept in
 * sync once completed, so any other screen that looks the current user up
 * by id (as a renter or as a listing owner) sees their real details.
 *
 * Once Supabase is configured, this instead reads/writes the real
 * `profiles` row for whoever `useAuth()` says is signed in — the auto-created
 * row from `handle_new_user()` (0002) only has `email` set, so `name`/`phone`
 * come back null for a genuinely new account, which is exactly what drives
 * `isProfileComplete` to `false` until Complete Your Profile runs once.
 */
export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    let mounted = true;
    supabase
      .from('profiles')
      .select('name, phone, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const fetchedName = data?.name ?? '';
        const fetchedPhone = data?.phone ?? '';
        setName(fetchedName);
        setPhone(fetchedPhone);
        setAvatarUrl(data?.avatar_url ?? null);
        setIsProfileComplete(Boolean(fetchedName.trim() && fetchedPhone.trim()));
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  // Mock mode has no persisted account to check, so a fresh sign-in always
  // needs to go through Complete Your Profile again — mirrors what happens
  // to a genuinely new Supabase account (empty name/phone until completed).
  useEffect(() => {
    if (isSupabaseConfigured || !isSignedIn) return;
    setName('');
    setPhone('');
    setAvatarUrl(null);
    setIsProfileComplete(false);
    // Only re-run when a mock sign-in actually happens — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const value = useMemo<UserProfileContextValue>(
    () => ({
      name,
      phone,
      avatarUrl,
      isProfileComplete,
      updateProfile: (updates) => {
        if (updates.name !== undefined) setName(updates.name);
        if (updates.phone !== undefined) setPhone(updates.phone);
        if (updates.avatarUrl !== undefined) setAvatarUrl(updates.avatarUrl);

        if (isSupabaseConfigured) {
          if (!userId) return;
          const dbUpdates: Record<string, string | null> = {};
          if (updates.name !== undefined) dbUpdates.name = updates.name;
          if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
          if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
          supabase
            .from('profiles')
            .update(dbUpdates)
            .eq('id', userId)
            .then(({ error }) => {
              if (error) {
                // eslint-disable-next-line no-console
                console.warn('[ParkNext] Failed to save profile updates:', error.message);
              }
            });
          return;
        }

        Object.assign(MOCK_RENTERS[CURRENT_USER_ID], {
          ...updates,
          avatarUrl: updates.avatarUrl === undefined ? undefined : updates.avatarUrl ?? undefined,
        });
      },
      completeProfile: (details) => {
        setName(details.name);
        setPhone(details.phone);
        setAvatarUrl(details.avatarUrl ?? null);
        setIsProfileComplete(true);

        if (isSupabaseConfigured) {
          if (!userId) return;
          supabase
            .from('profiles')
            .update({ name: details.name, phone: details.phone, avatar_url: details.avatarUrl ?? null })
            .eq('id', userId)
            .then(({ error }) => {
              if (error) {
                // eslint-disable-next-line no-console
                console.warn('[ParkNext] Failed to save profile:', error.message);
              }
            });
          return;
        }

        Object.assign(MOCK_RENTERS[CURRENT_USER_ID], {
          name: details.name,
          phone: details.phone,
          avatarUrl: details.avatarUrl ?? undefined,
        });
      },
    }),
    [name, phone, avatarUrl, isProfileComplete, userId]
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