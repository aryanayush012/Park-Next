import { Platform } from 'react-native';
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
 * exact app via its own URL scheme (`GOOGLE_REDIRECT_URI` below), then
 * parse the access/refresh tokens Supabase appended to
 * that redirect URL and hand them to the client with `setSession` — no
 * server-side code needed on this app's side at all.
 *
 * Requires a real Google Cloud OAuth client wired into Supabase's Google
 * provider first (see `supabase/README.md`'s Google Sign-In section) — this
 * function doesn't fail differently before vs. after that one-time setup is
 * done, it just can't succeed yet; Supabase's own error message
 * (surfaced via the `'error'` status below) will say so either way.
 */
/**
 * Where Supabase sends the browser back to once Google is done. Must match an
 * entry in Authentication → URL Configuration → Redirect URLs *exactly*, or
 * Supabase ignores it and falls back to the project's Site URL — the
 * "localhost:3000 refused to connect" tab.
 *
 * A fixed string on native rather than `makeRedirectUri()` on purpose: inside
 * a development build that helper splices the Metro dev-server host into the
 * URL (`parknext://192.168.1.7:8081`), which changes with your LAN IP and
 * port, so it can never be allowlisted. Hard-coding the app's own scheme
 * (`app.json`'s `"scheme": "parknext"`) makes the value identical across dev,
 * preview and production builds, so it only has to be added once.
 *
 * Consequence: Google sign-in needs a real build — it cannot work in Expo Go,
 * which can't own the `parknext://` scheme.
 */
export const GOOGLE_REDIRECT_URI = 'parknext://auth-callback';

/**
 * How long to wait for the browser tab to come back before giving up.
 *
 * `openAuthSessionAsync` resolves on exactly two events: the browser reaching
 * `GOOGLE_REDIRECT_URI`, or the person dismissing the tab. If Supabase sends
 * the browser anywhere else — which is what happens when
 * `GOOGLE_REDIRECT_URI` is not in Authentication → URL Configuration →
 * Redirect URLs, since it then falls back to the Site URL — neither ever
 * happens and the promise simply never settles. The sign-in button spins
 * with no error, forever, which is the least debuggable failure this flow
 * can produce.
 *
 * Generous on purpose: a real sign-in can involve picking an account, a
 * password, and 2FA. This is a backstop against a silent hang, not a
 * patience limit.
 */
const AUTH_SESSION_TIMEOUT_MS = 180_000;

type BrowserOutcome =
  | WebBrowser.WebBrowserAuthSessionResult
  | { type: 'timeout'; url?: undefined };

/**
 * `openAuthSessionAsync`, but it always settles.
 *
 * On timeout the tab is dismissed explicitly — which also resolves the
 * original promise, so nothing is left dangling behind the race.
 */
async function openAuthSessionWithTimeout(
  authUrl: string,
  redirectTo: string
): Promise<BrowserOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<BrowserOutcome>((resolve) => {
    timer = setTimeout(() => {
      WebBrowser.dismissAuthSession();
      resolve({ type: 'timeout' });
    }, AUTH_SESSION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([WebBrowser.openAuthSessionAsync(authUrl, redirectTo), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  // Web has no custom scheme; there the computed origin-based URL is right.
  const redirectTo = Platform.OS === 'web' ? makeRedirectUri() : GOOGLE_REDIRECT_URI;

  if (__DEV__) {
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

  const result = await openAuthSessionWithTimeout(data.url, redirectTo);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    // Only the 'success' variant carries a url.
    console.log(
      '[ParkNext] Google sign-in browser result:',
      result.type,
      'url' in result ? result.url : ''
    );
  }

  if (result.type === 'timeout') {
    return {
      status: 'error',
      message:
        `The browser never returned to the app. Check that "${redirectTo}" is listed under ` +
        'Authentication → URL Configuration → Redirect URLs in Supabase, and that you are ' +
        'running a development or preview build rather than Expo Go.',
    };
  }

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
    // Landed back in the app, but without the tokens Supabase appends on a
    // successful sign-in. Usually an `error=` / `error_description=` on the
    // callback URL, so say what actually came back rather than "try again".
    const described = params.error_description || params.error;
    return {
      status: 'error',
      message: described
        ? decodeURIComponent(described).replace(/\+/g, ' ')
        : 'Google sign-in did not return a session. Try again.',
    };
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