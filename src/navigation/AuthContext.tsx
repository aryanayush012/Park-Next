import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../data/supabaseClient';
import { CURRENT_USER_ID } from '../data/mockData';

interface AuthContextValue {
  /** The signed-in user's id — a real `auth.users` UUID once Supabase is
   * configured, or the fixed mock persona id (`'u9'`) otherwise. Every
   * screen that used to import `CURRENT_USER_ID` directly should read this
   * instead, so it always reflects whoever is actually signed in. */
  userId: string;
  /** Real email once a Supabase session exists; always `null` in mock mode. */
  email: string | null;
  /** False only while checking AsyncStorage for an existing Supabase session
   * on cold start — `RootNavigator` shows a brief loading view during this,
   * so nothing else needs to guard against a not-yet-known auth state. Always
   * `true` immediately in mock mode (there's nothing to check). */
  isReady: boolean;
  /** Whether there's someone signed in right now. Drives which screens
   * `RootNavigator` renders. Starts `false` in both modes — the existing
   * Splash/Onboarding/Sign-in flow is unchanged; the only difference is
   * *what* flips it to `true` (a real Supabase session vs. finishing one of
   * the mocked sign-in paths). */
  isSignedIn: boolean;
  /**
   * True from the moment a password-reset code is verified until the new
   * password is actually set (or the person backs out) — see
   * `ForgotPasswordOTPScreen.tsx`/`ResetPasswordScreen.tsx`.
   *
   * This exists as an *explicit, locally-owned* flag rather than something
   * derived from whatever event Supabase's `onAuthStateChange` happens to
   * fire, because that part of Supabase's own SDKs has historically been
   * inconsistent about it — `verifyOtp({ type: 'recovery' })` establishes a
   * real (if short-lived) session either way, but different SDK versions
   * have fired a plain `SIGNED_IN` for that instead of the dedicated
   * `PASSWORD_RECOVERY` event a caller would naturally reach for here. Since
   * this app's `RootNavigator` already treats `isSignedIn` as "show the main
   * app," relying on that alone would drop someone straight into Main mid
   * password-reset instead of letting them actually set a new password
   * first. Checking this flag *ahead of* `isSignedIn` in `RootNavigator`
   * sidesteps the ambiguity entirely, regardless of which event Supabase
   * fires under the hood.
   */
  isPasswordRecovery: boolean;
  /** Called by `ForgotPasswordOTPScreen` the moment a reset code verifies
   * successfully — see `isPasswordRecovery` above for why this is a
   * deliberate, explicit flag rather than something inferred from an auth
   * event. */
  beginPasswordRecovery: () => void;
  /** Called by `ResetPasswordScreen` once the new password is actually set,
   * or if the person backs out of the flow without changing it. Clears the
   * recovery flag and — once Supabase is configured — signs out of the
   * short-lived recovery session too, so they land back on a normal Sign In
   * screen and log in fresh with (or without, if they cancelled) their new
   * password, rather than being silently left signed in from the recovery
   * session itself. A no-op beyond clearing the local flag in mock mode,
   * since there's no real session to end. */
  endPasswordRecovery: () => Promise<void>;
  /** Mock-mode only: called by the Sign In/Sign Up/Google screens once their
   * simulated sign-in "succeeds", instead of the old `navigation.reset(...)`.
   * No-op (and unnecessary) once Supabase is configured, since a real
   * session flips `isSignedIn` on its own via `onAuthStateChange`. */
  signInMock: () => void;
  /** Signs out. Calls the real `supabase.auth.signOut()` when configured
   * (which flips `isSignedIn` back to `false` via `onAuthStateChange`); in
   * mock mode just flips the local flag, giving you a real way to get back
   * to the sign-in screens without reloading the whole app. */
  signOut: () => Promise<void>;
  /**
   * Permanently deletes the signed-in account and everything belonging to
   * it, then signs out. Required by Google Play for any app with account
   * creation, and promised by the privacy policy.
   *
   * The work happens in the `delete-account` Edge Function, because removing
   * a row from `auth.users` needs the service role key — which must never
   * reach a client. Throws with the server's own message if it fails, so the
   * caller can say what went wrong rather than claiming a deletion that
   * didn't happen.
   */
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * supabase-js collapses every non-2xx from an Edge Function into the same
 * generic "Edge Function returned a non-2xx status code" and hangs the real
 * response off `context`. For an irreversible action the actual reason is
 * worth surfacing, so dig it out of the body when it's there.
 */
async function describeFunctionError(error: unknown): Promise<string> {
  const response = (error as { context?: Response }).context;
  if (response && typeof response.json === 'function') {
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === 'string' && body.error) {
        return body.error;
      }
    } catch {
      // Not a JSON body — fall through to whatever the error itself says.
    }
  }
  return error instanceof Error ? error.message : 'Account deletion failed';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState(isSupabaseConfigured ? '' : CURRENT_USER_ID);
  const [email, setEmail] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(!isSupabaseConfigured);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      setUserId(session?.user.id ?? '');
      setEmail(session?.user.email ?? null);
      setIsSignedIn(Boolean(session));
      setIsReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user.id ?? '');
      setEmail(session?.user.email ?? null);
      setIsSignedIn(Boolean(session));
      setIsReady(true);
      // A session disappearing entirely (a real sign-out, or the recovery
      // session simply expiring) means there's nothing left to recover a
      // password against — fall back to the normal Sign In screen rather
      // than getting stuck showing Reset Password with no session behind it.
      if (!session) {
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInMock = () => {
    if (isSupabaseConfigured) return;
    setIsSignedIn(true);
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      return;
    }
    setIsSignedIn(false);
  };

  const deleteAccount = async () => {
    if (!isSupabaseConfigured) {
      // Mock mode has no account and no stored data, so signing out really
      // is the whole operation rather than a fallback pretending to be one.
      setIsSignedIn(false);
      return;
    }

    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      throw new Error(await describeFunctionError(error));
    }

    // `scope: 'local'` because the account this session belonged to no longer
    // exists — a default (global) sign-out would try to revoke a session
    // server-side for a user that is gone and fail. All that is left to do is
    // clear the stored session, which flips `isSignedIn` and sends
    // RootNavigator back to the sign-in stack.
    await supabase.auth.signOut({ scope: 'local' });
  };

  const beginPasswordRecovery = () => {
    setIsPasswordRecovery(true);
  };

  const endPasswordRecovery = async () => {
    setIsPasswordRecovery(false);
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
        email,
        isReady,
        isSignedIn,
        isPasswordRecovery,
        beginPasswordRecovery,
        endPasswordRecovery,
        signInMock,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}