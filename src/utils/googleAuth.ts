import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { supabase } from '../data/supabaseClient';

// Required once per app so a completed auth session properly closes its
// popup on web — a no-op on iOS/Android, but harmless (and this app also
// builds for web via `expo export --platform web`, so it's worth calling
// regardless). Matches Supabase's own Expo/React Native OAuth guide.
WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * Real Google Sign-In via Supabase's hosted OAuth flow — the standard
 * pattern for Expo apps (Supabase's own "Native Mobile Deep Linking" guide):
 * ask Supabase for the Google `authorize` URL without letting the SDK try
 * to redirect a (nonexistent, in React Native) browser window itself
 * (`skipBrowserRedirect`), open that URL in a real system browser tab via
 * `expo-web-browser` so the OS can hand the eventual redirect back to this
 * exact app via its own URL scheme (`app.json`'s `"scheme": "parknext"`,
 * resolved automatically by `makeRedirectUri()` — this also transparently
 * does the right thing when testing in Expo Go, where there's no custom
 * scheme yet), then parse the access/refresh tokens Supabase appended to
 * that redirect URL and hand them to the client with `setSession` — no
 * server-side code needed on this app's side at all.
 *
 * Requires a real Google Cloud OAuth client wired into Supabase's Google
 * provider first (see `supabase/README.md`'s Google Sign-In section) — this
 * function doesn't fail differently before vs. after that one-time setup is
 * done, it just can't succeed yet; Supabase's own error message
 * (surfaced via the `'error'` status below) will say so either way.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const redirectTo = makeRedirectUri();

  if (__DEV__) {
    // If Google sign-in ends with the browser tab showing something like
    // "localhost:3000 refused to connect", it means Supabase couldn't match
    // this exact URL against Authentication → URL Configuration → Redirect
    // URLs, so it fell back to the project's default Site URL instead
    // (localhost:3000) — copy the value logged here and add it there
    // (or a wildcard covering it, e.g. `exp://**` for Expo Go) and try again.
    // eslint-disable-next-line no-console
    console.log('[ParkNext] Google sign-in redirectTo:', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { status: 'error', message: error?.message ?? 'Could not start Google sign-in.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    // 'cancel'/'dismiss' — the person closed the browser tab themselves.
    // Not a real error, so there's nothing to show; they can just try again.
    return { status: 'cancelled' };
  }

  const { params, errorCode } = getQueryParams(result.url);
  if (errorCode) {
    return { status: 'error', message: errorCode };
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (!accessToken || !refreshToken) {
    return { status: 'error', message: 'Google sign-in did not complete. Try again.' };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    return { status: 'error', message: sessionError.message };
  }

  // No manual navigation here — a successful `setSession` fires Supabase's
  // own `onAuthStateChange`, flipping `AuthContext`'s `isSignedIn` and
  // letting `RootNavigator` swap to Main/Complete Your Profile on its own,
  // exactly like every other real sign-in path in this app.
  return { status: 'success' };
}