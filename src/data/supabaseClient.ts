// Must run before `@supabase/supabase-js` is touched — React Native/Hermes
// doesn't ship a full `URL`/`URLSearchParams` implementation, and
// supabase-js relies on both internally.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * The single switch the whole app uses to decide real backend vs mock data —
 * both the `DataSource` factory (see `dataSource.ts`) and the Email OTP auth
 * screens branch on this exact flag. True only once a real Supabase project
 * URL + anon key have been copied into `.env` (see `supabase/README.md`).
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Always a real `SupabaseClient` instance — so importing this module never
 * throws even when unconfigured — but nothing should actually call into it
 * unless `isSupabaseConfigured` is true. When it's not, it points at a
 * harmless placeholder so `createClient`'s own URL validation doesn't throw
 * at import time (which would crash the app in mock mode).
 */
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(
    isSupabaseConfigured
      ? '[ParkNext] Supabase configured — using SupabaseDataSource (real backend).'
      : '[ParkNext] Supabase not configured — using MockDataSource (in-memory mock data). See supabase/README.md to connect a real project.'
  );
}
