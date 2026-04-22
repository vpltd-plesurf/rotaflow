/**
 * Clone prod Supabase → staging Supabase with anonymised data.
 *
 * Assumes the staging schema is already applied (run `DATABASE_URL=<staging pg url>
 * npm run migrate` first). This script ONLY copies data — not schema.
 *
 * Auth users are recreated fresh on staging (Supabase Auth owns auth.users;
 * we can't simply INSERT into it). The first recreated admin is given the
 * password from STAGING_ADMIN_PASSWORD so the smoke test can sign in.
 *
 * Usage:
 *   PROD_SUPABASE_URL=https://xxx.supabase.co \
 *   PROD_SERVICE_ROLE_KEY=eyJ... \
 *   STAGING_SUPABASE_URL=https://yyy.supabase.co \
 *   STAGING_SERVICE_ROLE_KEY=eyJ... \
 *   STAGING_ADMIN_PASSWORD='smoke-test-2026!' \
 *   npx tsx scripts/clone-to-staging.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = (k: string): string => {
  const v = process.env[k];
  if (!v) {
    console.error(`❌ Missing env var: ${k}`);
    process.exit(1);
  }
  return v;
};

const PROD_URL = env("PROD_SUPABASE_URL");
const PROD_KEY = env("PROD_SERVICE_ROLE_KEY");
const STAGING_URL = env("STAGING_SUPABASE_URL");
const STAGING_KEY = env("STAGING_SERVICE_ROLE_KEY");
const STAGING_ADMIN_PASSWORD = env("STAGING_ADMIN_PASSWORD");

if (PROD_URL === STAGING_URL) {
  console.error("❌ PROD_SUPABASE_URL and STAGING_SUPABASE_URL are identical. Refusing to run.");
  process.exit(1);
}

const prod = createClient(PROD_URL, PROD_KEY, { auth: { persistSession: false } });
const staging = createClient(STAGING_URL, STAGING_KEY, { auth: { persistSession: false } });

const anonEmail = (i: number) => `user${i}@example.test`;
const anonName = (i: number, role: string) => `${role[0].toUpperCase()}${role.slice(1)} ${i}`;

async function wipeStaging() {
  console.log("→ wiping staging tables (in FK-safe order)");
  const tables = [
    "shift_swaps",
    "leave_requests",
    "shifts",
    "rotas",
    "rota_template_shifts",
    "rota_templates",
    "documents",
    "notifications",
    "employee_details",
    "profiles",
    "locations",
  ];
  for (const t of tables) {
    const { error } = await staging.from(t).delete().gte("created_at", "1900-01-01");
    if (error && !error.message.includes("created_at")) {
      // Table may not have created_at — fall back to delete-all hack
      const { error: e2 } = await staging.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e2) console.warn(`  ! could not clear ${t}: ${e2.message}`);
    }
  }

  // Delete all auth users on staging
  const { data: users } = await staging.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users?.users ?? []) {
    await staging.auth.admin.deleteUser(u.id);
  }
}

async function copyLocations() {
  console.log("→ copying locations (verbatim)");
  const { data, error } = await prod.from("locations").select("*");
  if (error) throw error;
  if (data && data.length) {
    const { error: e2 } = await staging.from("locations").insert(data);
    if (e2) throw e2;
  }
  console.log(`  ✓ ${data?.length ?? 0} locations`);
}

async function copyUsersAndProfiles() {
  console.log("→ copying users + profiles (anonymised)");
  const { data: profiles, error } = await prod.from("profiles").select("*");
  if (error) throw error;

  const { data: prodAuth } = await prod.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId = new Map<string, string>();
  for (const u of prodAuth?.users ?? []) if (u.email) emailByUserId.set(u.id, u.email);

  let i = 0;
  let firstAdminEmail: string | null = null;
  for (const p of profiles ?? []) {
    i++;
    const fakeEmail = anonEmail(i);
    const fakeName = anonName(i, p.role);

    const { data: created, error: authErr } = await staging.auth.admin.createUser({
      email: fakeEmail,
      password: STAGING_ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (authErr || !created?.user) {
      console.warn(`  ! could not create staging user for profile ${p.id}: ${authErr?.message}`);
      continue;
    }

    const stagingId = created.user.id;
    const { error: profErr } = await staging.from("profiles").insert({
      ...p,
      id: stagingId,
      full_name: fakeName,
      phone: null,
    });
    if (profErr) console.warn(`  ! insert profile failed: ${profErr.message}`);

    if (p.role === "admin" && !firstAdminEmail) firstAdminEmail = fakeEmail;
  }

  console.log(`  ✓ ${i} users`);
  if (firstAdminEmail) {
    console.log(`  → smoke-test login: ${firstAdminEmail} / <STAGING_ADMIN_PASSWORD>`);
  }
}

async function copyLightBusinessData() {
  console.log("→ copying employee_details (scrubbed)");
  const { data } = await prod.from("employee_details").select("*");
  for (const row of data ?? []) {
    const { error } = await staging.from("employee_details").upsert({
      ...row,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      notes: null,
    });
    if (error) console.warn(`  ! ${error.message}`);
  }
  console.log(`  ✓ ${data?.length ?? 0} employee_detail rows`);
}

async function main() {
  console.log(`Cloning ${PROD_URL} → ${STAGING_URL}`);
  console.log("(anonymising user data; skipping shifts/rotas/leave for speed)\n");
  await wipeStaging();
  await copyLocations();
  await copyUsersAndProfiles();
  await copyLightBusinessData();
  console.log("\n✅ staging clone complete");
}

main().catch((err) => {
  console.error("\n❌ clone failed:", err);
  process.exit(1);
});
