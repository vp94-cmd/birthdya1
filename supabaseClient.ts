import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ── No module-level throw ────────────────────────────────────────────────────
// The original code had:
//   if (!supabaseUrl || !supabaseAnonKey) { throw new Error(...) }
//
// Because App → AdminPanel → globalStateManager → realtimeSync → supabaseClient
// are all STATIC imports, that throw propagated before React ever mounted —
// giving a silent blank white screen that no ErrorBoundary can catch.
//
// Fix: warn + export null so every caller can guard with `if (!supabase)`.
// ─────────────────────────────────────────────────────────────────────────────
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
    'Real-time sync disabled. Add them to Netlify → Site settings → Environment variables and redeploy.'
  );
}

function tryCreateClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth:     { persistSession: false },
    });
  } catch (e) {
    // e.g. malformed URL — still must not throw at module level
    console.error('[supabaseClient] createClient failed:', e);
    return null;
  }
}

export const supabase: SupabaseClient | null = tryCreateClient();

if (supabase && supabaseAnonKey) {
  supabase.realtime.setAuth(supabaseAnonKey);
}
