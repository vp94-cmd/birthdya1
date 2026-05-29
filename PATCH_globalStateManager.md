# globalStateManager.ts — required patch

This file was not included in the upload, but it **must** be updated to match
the nullable `supabase` export in `supabaseClient.ts`, otherwise it will throw
at runtime when Supabase credentials are missing.

## Pattern to apply everywhere inside globalStateManager.ts

Before (crashes when supabase is null):

```ts
import { supabase } from '../supabaseClient';

// anywhere supabase is used without a guard:
await supabase.channel('...').send({ ... });
supabase.realtime.connect();
```

After (safe, degrades gracefully):

```ts
import { supabase } from '../supabaseClient';

// Guard every call site:
if (!supabase) {
  console.warn('[globalStateManager] Supabase not available – skipping realtime op.');
  return;         // or return false / null / whatever fits the function signature
}
await supabase.channel('...').send({ ... });
```

## isRealtimeConnected() method

AdminPanel calls `globalStateManager.isRealtimeConnected()`.
Make sure it returns `false` (not throws) when `supabase` is null:

```ts
isRealtimeConnected(): boolean {
  if (!supabase) return false;
  return supabase.realtime.isConnected();   // adjust to your actual API
}
```

## broadcast() method

AdminPanel calls `globalStateManager.broadcast(key, value)`.
Make sure it resolves cleanly (not throws) when `supabase` is null:

```ts
async broadcast(key: string, value: unknown): Promise<void> {
  if (!supabase) {
    console.warn(`[globalStateManager] broadcast('${key}') skipped – no Supabase client.`);
    return;
  }
  // ... normal realtime send logic
}
```

Once these guards are in place, the app will work in full offline/local mode
when Supabase env vars are absent, and will use live sync when they are present.
