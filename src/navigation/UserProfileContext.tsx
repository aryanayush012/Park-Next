import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CURRENT_USER_ID, MOCK_RENTERS } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../data/supabaseClient';
import { uploadAvatarPhoto } from '../utils/photoUpload';
import { useAuth } from './AuthContext';

interface ProfileUpdates {
  name?: string;
  about?: string;
  phone?: string;
  avatarUrl?: string | null;
}

interface UserProfileContextValue {
  name: string;
  /** Short free-text bio. Optional; empty until the person writes one. */
  about: string;
  phone: string;
  avatarUrl: string | null;
  updateProfile: (updates: ProfileUpdates) => void;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

/**
 * The signed-in user's own editable name/phone/avatar (see the Profile
 * screen).
 *
 * Nothing here is mandatory up front any more. Sign-in goes straight to the
 * app, and the one field the app genuinely can't work without — a mobile
 * number — is asked for at the point of use by `PhoneRequiredDialog`, when
 * confirming a booking or publishing a listing.
 *
 * In mock mode there's no account record to persist to, so this is held for
 * the life of the app session and starts blank rather than inheriting the
 * mock renter directory's sample "You" placeholder for `u9`.
 * `MOCK_RENTERS[CURRENT_USER_ID]` is kept in sync on every update, so any
 * screen that looks the current user up by id (as a renter or as a listing
 * owner) sees their real details.
 *
 * Once Supabase is configured this reads/writes the real `profiles` row for
 * whoever `useAuth()` says is signed in. `handle_new_user()` (0002) only sets
 * `email` on that row, so a brand-new account arrives with no name or photo —
 * both are seeded from the identity provider by the fetch below.
 */
export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useAuth();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;
    let mounted = true;

    (async () => {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('name, about, phone, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (!mounted) return;
      if (fetchError) {
        // Most likely cause: a migration in supabase/migrations/ has not been
        // run against this project, so a column selected above does not exist
        // yet. Left unlogged this looks like an account with no details at all.
        // eslint-disable-next-line no-console
        console.warn('[ParkNext] Failed to load profile:', fetchError.message);
        return;
      }

      const savedName = (data?.name ?? '').trim();
      const savedAvatarUrl = data?.avatar_url ?? null;

      setPhone(data?.phone ?? '');
      setAbout(data?.about ?? '');
      setName(savedName);
      setAvatarUrl(savedAvatarUrl);

      if (savedName && savedAvatarUrl) return;

      // Seed whichever of name/avatar the `profiles` row is still missing
      // from the identity provider, via the session's user metadata.
      //
      // `handle_new_user()` (0002) only fills in `email`, and nothing asks
      // for a name at sign-up any more, so without this a Google account
      // would show a blank name and no photo to every host it books from.
      // Google supplies `full_name` and `picture`; this app's own email +
      // password sign-up writes `first_name`/`last_name`/`full_name` into the
      // same place (see `SignUpScreen`), so both paths land here.
      //
      // Written back to `profiles` as well as held locally, so
      // `getPublicProfile` returns them to other people too.
      const { data: sessionData } = await supabase.auth.getSession();
      const metadata = sessionData.session?.user.user_metadata ?? {};
      const patch: { name?: string; avatar_url?: string } = {};

      if (!savedName) {
        const first = String(metadata.given_name ?? metadata.first_name ?? '').trim();
        const last = String(metadata.family_name ?? metadata.last_name ?? '').trim();
        const metadataName =
          String(metadata.full_name ?? metadata.name ?? '').trim() ||
          [first, last].filter(Boolean).join(' ');
        if (metadataName) patch.name = metadataName;
      }

      if (!savedAvatarUrl) {
        // Already a public `https://` URL, so it needs no upload of its own —
        // `uploadAvatarPhoto` only rewrites device-local URIs. Google may
        // rotate this URL eventually; picking a new photo on Profile
        // replaces it with one in our own Storage bucket.
        const metadataAvatar = String(metadata.avatar_url ?? metadata.picture ?? '').trim();
        if (metadataAvatar) patch.avatar_url = metadataAvatar;
      }

      if (!mounted || Object.keys(patch).length === 0) return;

      if (patch.name) setName(patch.name);
      if (patch.avatar_url) setAvatarUrl(patch.avatar_url);

      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[ParkNext] Failed to save sign-in profile details:', error.message);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // Mock mode has nothing persisted, so every fresh sign-in starts blank —
  // mirroring a genuinely new Supabase account, right down to the phone
  // dialog appearing on the first booking or publish.
  useEffect(() => {
    if (isSupabaseConfigured || !isSignedIn) return;
    setName('');
    setAbout('');
    setPhone('');
    setAvatarUrl(null);
    // Only re-run when a mock sign-in actually happens — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  const value = useMemo<UserProfileContextValue>(
    () => ({
      name,
      about,
      phone,
      avatarUrl,
      updateProfile: (updates) => {
        if (updates.name !== undefined) setName(updates.name);
        if (updates.about !== undefined) setAbout(updates.about);
        if (updates.phone !== undefined) setPhone(updates.phone);
        // Shown immediately from the local device URI the picker just
        // returned, for instant feedback — swapped for the real uploaded
        // URL below once that finishes, without making the person wait to
        // see their new photo at all.
        if (updates.avatarUrl !== undefined) setAvatarUrl(updates.avatarUrl);

        if (isSupabaseConfigured) {
          if (!userId) return;
          (async () => {
            try {
              const dbUpdates: Record<string, string | null> = {};
              if (updates.name !== undefined) dbUpdates.name = updates.name;
              if (updates.about !== undefined) dbUpdates.about = updates.about;
              if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
              if (updates.avatarUrl !== undefined) {
                // Real Storage URL, not the device-local `file://...` URI the
                // picker hands back — see `src/utils/photoUpload.ts`.
                const uploadedUrl = await uploadAvatarPhoto(updates.avatarUrl, userId);
                dbUpdates.avatar_url = uploadedUrl;
                setAvatarUrl(uploadedUrl);
              }
              const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
              if (error) {
                // eslint-disable-next-line no-console
                console.warn('[ParkNext] Failed to save profile updates:', error.message);
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn(
                '[ParkNext] Failed to upload avatar photo:',
                err instanceof Error ? err.message : err
              );
            }
          })();
          return;
        }

        Object.assign(MOCK_RENTERS[CURRENT_USER_ID], {
          ...updates,
          avatarUrl: updates.avatarUrl === undefined ? undefined : updates.avatarUrl ?? undefined,
        });
      },
    }),
    [name, about, phone, avatarUrl, userId]
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