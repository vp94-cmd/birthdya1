import { createClient } from "@supabase/supabase-js";

// Safe fallbacks so the app doesn't throw a fatal error when env vars are
// missing (e.g. Netlify deploy without env vars set, or during SSR/pre-render).
const supabaseUrl: string =
  (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey: string =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
      "Supabase features will not work. Check your Netlify environment variables."
  );
}

// createClient won't throw even with empty strings – it will only fail on
// actual network calls, which is the correct behaviour.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
