import { createBrowserClient } from "@supabase/ssr";
// NOTE: Replace this import with generated types after running:
//   supabase gen types typescript --local > lib/supabase/database.types.ts
// import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
