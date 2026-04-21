/**
 * Cross-tenant RLS isolation suite.
 *
 * Seeds two orgs (A and B), each with an admin + manager + barber plus a
 * location, rota, shift, and leave request. Then, for every interesting
 * (role × table × verb) combination, asserts that a user in org A cannot
 * see or modify anything in org B.
 *
 * Runs red before Phase 3 (RLS rewrite) and green after. Prefer vitest's
 * default reporter so individual failing cases show the table+role clearly.
 *
 * Supabase REST has a hard ceiling on what a user-scoped client can do; we
 * use the service role only to seed/clean. All assertions use user-scoped
 * clients.
 *
 * Side effects: creates and deletes real rows in the configured Supabase
 * project. Do NOT run against prod in a context where those rows could
 * leak into customer views. Rows are namespaced with a timestamp nonce.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error(
    "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  );
}

const TEST_PASSWORD = "isolation-test-abc123!X";
const nonce = Date.now();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function userClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL!, ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type TestUser = { id: string; email: string; token: string };
type TestOrg = {
  id: string;
  slug: string;
  location_id: string;
  rota_id: string;
  shift_id: string;
  leave_id: string;
  admin: TestUser;
  manager: TestUser;
  barber: TestUser;
};

async function signIn(email: string): Promise<string> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error || !data.session) throw new Error(`signIn(${email}): ${error?.message}`);
  return data.session.access_token;
}

async function createTestUser(
  label: string,
  orgId: string,
  role: "admin" | "manager" | "barber",
  locationId: string | null
): Promise<TestUser> {
  const email = `${label}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { org_id: orgId, role, full_name: label },
  });
  if (error || !data.user) throw new Error(`createUser(${email}): ${error?.message}`);

  // Trigger created the profile with role+org_id; set location_id now.
  const { error: upErr } = await admin
    .from("profiles")
    .update({ location_id: locationId })
    .eq("id", data.user.id);
  if (upErr) throw new Error(`update profile location: ${upErr.message}`);

  const token = await signIn(email);
  return { id: data.user.id, email, token };
}

async function seedOrg(label: "A" | "B"): Promise<TestOrg> {
  const slug = `test-${label.toLowerCase()}-${nonce}`;
  const { data: org, error: orgErr } = await admin
    .from("organisations")
    .insert({ slug, name: `Test Org ${label}` })
    .select()
    .single();
  if (orgErr || !org) throw new Error(`create org: ${orgErr?.message}`);

  const { data: loc, error: locErr } = await admin
    .from("locations")
    .insert({ name: `${label} Shop`, org_id: org.id })
    .select()
    .single();
  if (locErr || !loc) throw new Error(`create location: ${locErr?.message}`);

  const adminU = await createTestUser(`test-${slug}-admin`, org.id, "admin", loc.id);
  const managerU = await createTestUser(`test-${slug}-manager`, org.id, "manager", loc.id);
  const barberU = await createTestUser(`test-${slug}-barber`, org.id, "barber", loc.id);

  const { data: rota, error: rotaErr } = await admin
    .from("rotas")
    .insert({
      location_id: loc.id,
      week_start: "2026-04-27",
      created_by: adminU.id,
      org_id: org.id,
    })
    .select()
    .single();
  if (rotaErr || !rota) throw new Error(`create rota: ${rotaErr?.message}`);

  const { data: shift, error: shiftErr } = await admin
    .from("shifts")
    .insert({
      rota_id: rota.id,
      employee_id: barberU.id,
      date: "2026-04-27",
      start_time: "09:00",
      end_time: "17:00",
      org_id: org.id,
    })
    .select()
    .single();
  if (shiftErr || !shift) throw new Error(`create shift: ${shiftErr?.message}`);

  const { data: leave, error: leaveErr } = await admin
    .from("leave_requests")
    .insert({
      employee_id: barberU.id,
      start_date: "2026-05-01",
      end_date: "2026-05-03",
      reason: "test",
      org_id: org.id,
    })
    .select()
    .single();
  if (leaveErr || !leave) throw new Error(`create leave: ${leaveErr?.message}`);

  return {
    id: org.id,
    slug,
    location_id: loc.id,
    rota_id: rota.id,
    shift_id: shift.id,
    leave_id: leave.id,
    admin: adminU,
    manager: managerU,
    barber: barberU,
  };
}

async function cleanupOrg(org: TestOrg) {
  // Delete FK children first (org_id FK is ON DELETE RESTRICT).
  const tables = [
    "shift_swaps",
    "shifts",
    "leave_requests",
    "rota_template_shifts",
    "rota_templates",
    "rotas",
    "documents",
    "notifications",
    "employee_details",
  ];
  for (const t of tables) await admin.from(t).delete().eq("org_id", org.id);
  await admin.from("profiles").delete().eq("org_id", org.id);
  for (const u of [org.admin, org.manager, org.barber]) {
    await admin.auth.admin.deleteUser(u.id);
  }
  await admin.from("locations").delete().eq("org_id", org.id);
  await admin.from("organisations").delete().eq("id", org.id);
}

let orgA: TestOrg;
let orgB: TestOrg;

beforeAll(async () => {
  orgA = await seedOrg("A");
  orgB = await seedOrg("B");
}, 60_000);

afterAll(async () => {
  if (orgA) await cleanupOrg(orgA);
  if (orgB) await cleanupOrg(orgB);
}, 60_000);

// Helpers for generating parameterised tests.
const ROLES = ["admin", "manager", "barber"] as const;

describe("Cross-org read isolation", () => {
  const tables = [
    "profiles",
    "locations",
    "employee_details",
    "rotas",
    "shifts",
    "leave_requests",
    "shift_swaps",
    "documents",
    "notifications",
    "rota_templates",
    "rota_template_shifts",
  ];

  for (const table of tables) {
    for (const role of ROLES) {
      it(`org A ${role} cannot see org B ${table}`, async () => {
        const user = orgA[role];
        const c = userClient(user.token);
        const { data, error } = await c.from(table).select("id, org_id");
        // Either RLS returns zero rows from org B, or an empty result. Both fine.
        // What MUST NOT happen: any row with org_id === orgB.id visible.
        expect(error).toBeNull();
        const leaked = (data ?? []).filter((r: { org_id: string }) => r.org_id === orgB.id);
        expect(leaked).toEqual([]);
      });
    }
  }
});

describe("Cross-org write protection", () => {
  it("org A admin cannot insert location into org B", async () => {
    const c = userClient(orgA.admin.token);
    const { error } = await c
      .from("locations")
      .insert({ name: "Hacked", org_id: orgB.id });
    // Either RLS blocks with an error, or the row is silently scoped away.
    // Any way we slice it, org B must not gain a row named "Hacked".
    const { data: check } = await admin
      .from("locations")
      .select("id")
      .eq("org_id", orgB.id)
      .eq("name", "Hacked");
    expect(check ?? []).toEqual([]);
    // Error is expected (not required, but strongly preferred).
    if (!error) {
      // Fall through — the post-check already proved no leak.
    }
  });

  it("org A admin cannot update org B's location", async () => {
    const c = userClient(orgA.admin.token);
    await c.from("locations").update({ name: "Hijacked" }).eq("id", orgB.location_id);
    const { data } = await admin
      .from("locations")
      .select("name")
      .eq("id", orgB.location_id)
      .single();
    expect(data?.name).not.toBe("Hijacked");
  });

  it("org A admin cannot delete org B's location", async () => {
    const c = userClient(orgA.admin.token);
    await c.from("locations").delete().eq("id", orgB.location_id);
    const { data } = await admin
      .from("locations")
      .select("id")
      .eq("id", orgB.location_id)
      .single();
    expect(data?.id).toBe(orgB.location_id);
  });

  it("org A barber cannot create a leave request in org B", async () => {
    const c = userClient(orgA.barber.token);
    await c.from("leave_requests").insert({
      employee_id: orgB.barber.id,
      start_date: "2026-06-01",
      end_date: "2026-06-02",
      reason: "cross-tenant",
      org_id: orgB.id,
    });
    const { data } = await admin
      .from("leave_requests")
      .select("id")
      .eq("org_id", orgB.id)
      .eq("reason", "cross-tenant");
    expect(data ?? []).toEqual([]);
  });
});

describe("Sanity: own-org access still works", () => {
  it("org A admin can see own org locations", async () => {
    const c = userClient(orgA.admin.token);
    const { data, error } = await c.from("locations").select("id").eq("id", orgA.location_id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("org A barber can see own shifts", async () => {
    const c = userClient(orgA.barber.token);
    const { data, error } = await c.from("shifts").select("id").eq("id", orgA.shift_id);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });
});
