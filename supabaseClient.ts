import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ── Critical fix ──────────────────────────────────────────────────────────────
// The original `throw new Error(...)` here was a MODULE-LEVEL throw.
// Because App.tsx → AdminPanel → globalStateManager → supabaseClient all use
// static imports, the throw propagated before React ever mounted, making the
// entire page a blank white screen that no error boundary could catch.
//
// Instead we warn and export `null` so callers can guard with `if (supabase)`.
// ─────────────────────────────────────────────────────────────────────────────
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Real-time sync will be disabled. The app will still work in local/offline mode. ' +
    'Add these variables to your Netlify environment settings and redeploy.'
  );
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
        auth: {
          persistSession: false,
        },
      })
    : null;

// Only authenticate realtime if a client was actually created
if (supabase && supabaseAnonKey) {
  supabase.realtime.setAuth(supabaseAnonKey);
}
