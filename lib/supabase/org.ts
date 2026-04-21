import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./server";
import type { OrgContext, OrgStatus, UserRole } from "./types";

/**
 * Resolve the current user's org in a single DB round-trip.
 *
 * Returns null when no user is signed in. Throws only on unexpected DB errors;
 * consumer is expected to handle null as "unauthenticated" (usually redirect
 * to /login).
 *
 * Use from server components, server actions, and route handlers:
 *   const ctx = await getCurrentOrg();
 *   if (!ctx) redirect('/login');
 *
 * Accepts an optional pre-made client so callers that already have one
 * (middleware, repeated calls in the same request) can avoid duplicate
 * cookie parsing.
 */
export async function getCurrentOrg(
  supabase?: SupabaseClient
): Promise<OrgContext | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = supabase ?? (await createClient());

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("role, is_superuser, org_id, organisations!inner(id, slug, name, status)")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    userId: user.id,
    role: data.role as UserRole,
    isSuperuser: data.is_superuser === true,
    org: {
      id: data.organisations.id,
      slug: data.organisations.slug,
      name: data.organisations.name,
      status: data.organisations.status as OrgStatus,
    },
  };
}
