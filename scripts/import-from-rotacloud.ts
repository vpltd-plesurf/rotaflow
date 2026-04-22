/**
 * Import script: RotaCloud CSV exports → ROKRota Supabase
 *
 * Usage:
 *   1. Make sure local Supabase is running: supabase start
 *   2. Set env vars (or copy from .env.local):
 *        SUPABASE_URL=http://127.0.0.1:54321
 *        SUPABASE_SERVICE_ROLE_KEY=<local service role key from `supabase status`>
 *   3. Run: npx tsx scripts/import-from-rotacloud.ts
 *
 * What it imports:
 *   - Locations (from Locations.csv)
 *   - Employees as auth users + profiles (from Employees.csv)
 *   - Leave request history (from Leave.csv)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌  SUPABASE_SERVICE_ROLE_KEY not set.");
  console.error("    Run `supabase status` to find the service_role key, then:");
  console.error("    SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/import-from-rotacloud.ts");
  process.exit(1);
}

// Use service role client to bypass RLS and create auth users
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EXPORTS_DIR = join(process.cwd(), "Exports");

function readCsv(filename: string): Record<string, string>[] {
  const content = readFileSync(join(EXPORTS_DIR, filename), "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

// ---- Main ----------------------------------------------------------------

async function main() {
  console.log("🚀  ROKRota import starting...\n");

  // ---- 1. Locations -------------------------------------------------------
  console.log("📍  Importing locations...");
  const locCsv = readCsv("Locations.csv");

  // Fetch existing locations to build a name → id map
  const { data: existingLocations } = await supabase.from("locations").select("id, name");
  const locationByName: Record<string, string> = {};
  (existingLocations ?? []).forEach((l: { id: string; name: string }) => {
    locationByName[l.name.trim()] = l.id;
  });

  // Map RotaCloud location name → internal ID
  // (Locations are already seeded in migration; this handles extras)
  const rotacloudIdToName: Record<string, string> = {};
  for (const row of locCsv) {
    const rcName = row["Name"]?.trim();
    const rcId = row["Location ID"]?.trim();
    if (rcName && rcId) rotacloudIdToName[rcId] = rcName;

    if (!locationByName[rcName]) {
      const { data } = await supabase
        .from("locations")
        .upsert({ name: rcName, address: row["Address"] || null }, { onConflict: "name" })
        .select("id")
        .single();
      if (data) locationByName[rcName] = data.id;
      console.log(`   + Location: ${rcName}`);
    }
  }

  // Refresh
  const { data: allLocations } = await supabase.from("locations").select("id, name");
  (allLocations ?? []).forEach((l: { id: string; name: string }) => {
    locationByName[l.name.trim()] = l.id;
  });

  console.log(`   ✓ ${Object.keys(locationByName).length} locations ready\n`);

  // ---- 2. Employees -------------------------------------------------------
  console.log("👤  Importing employees...");
  const empCsv = readCsv("Employees.csv");

  // Track RotaCloud Employee ID → new profile UUID for leave import
  const rotacloudEmpIdToProfileId: Record<string, string> = {};

  // Default password for imported users (they should change this)
  const DEFAULT_PASSWORD = "ROK-changeme-2026!";

  for (const row of empCsv) {
    const empId = row["Employee ID"]?.trim();
    const email = row["Email"]?.trim();
    const firstName = row["First Name"]?.trim();
    const lastName = row["Last Name"]?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const accountType = row["Account Type"]?.trim().toLowerCase();
    const defaultRole = row["Default Role"]?.trim().toLowerCase();
    const locationsRaw = row["Locations"]?.trim();

    if (!email || !fullName) {
      console.log(`   ⚠ Skipping row (no email/name): ${JSON.stringify(row).slice(0, 60)}`);
      continue;
    }

    // Determine ROKRota role
    let role: "admin" | "manager" | "barber" = "barber";
    if (accountType === "admin") role = "admin";
    else if (defaultRole?.includes("office staff")) role = "manager";

    // Find primary location (first location listed, ignore multi-location for now)
    const firstLocation = locationsRaw?.split(",")[0]?.trim();
    const locationId = firstLocation ? (locationByName[firstLocation] ?? null) : null;

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`   ~ Existing: ${fullName} <${email}>`);
    } else {
      // Create auth user
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      });

      if (error) {
        console.error(`   ✗ Failed to create ${fullName}: ${error.message}`);
        continue;
      }
      userId = created.user.id;
      console.log(`   + Created: ${fullName} <${email}> [${role}]`);
    }

    rotacloudEmpIdToProfileId[empId] = userId;

    // Upsert profile
    const profileData = {
      id: userId,
      full_name: fullName,
      phone: row["Telephone"]?.trim() || null,
      role,
      location_id: locationId,
      hourly_rate: null, // not in the CSV (wages omitted from export)
    };

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });
    if (profileErr) {
      console.error(`   ✗ Profile upsert error for ${fullName}: ${profileErr.message}`);
    }

    // Upsert employee_details (barbers only)
    if (role === "barber") {
      const emergencyName = row["Emergency Contact Name"]?.trim() || null;
      const emergencyPhone = row["Emergency Phone Number"]?.trim() || null;

      const { error: detailErr } = await supabase
        .from("employee_details")
        .upsert(
          {
            id: userId,
            emergency_contact_name: emergencyName,
            emergency_contact_phone: emergencyPhone,
            notes: null,
            status: "active",
          },
          { onConflict: "id" }
        );
      if (detailErr) {
        console.error(`   ✗ Detail upsert error for ${fullName}: ${detailErr.message}`);
      }
    }
  }

  console.log(`   ✓ Employees imported\n`);

  // ---- 3. Leave history --------------------------------------------------
  console.log("📅  Importing leave history...");
  const leaveCsv = readCsv("Leave.csv");

  // We need employee IDs — load them from profiles by full name
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const profileByName: Record<string, string> = {};
  (profiles ?? []).forEach((p: { id: string; full_name: string }) => {
    profileByName[p.full_name.trim().toLowerCase()] = p.id;
  });

  // Also map by first+last from CSV (in case full name doesn't match exactly)
  const profileByRcId: Record<string, string> = rotacloudEmpIdToProfileId;

  let leaveImported = 0;
  let leaveSkipped = 0;

  for (const row of leaveCsv) {
    const empId = row["Employee ID"]?.trim();
    const startDate = row["Start Date"]?.trim().slice(0, 10); // YYYY-MM-DD
    const endDate = row["End Date"]?.trim().slice(0, 10);
    const leaveType = row["Leave Type"]?.trim();
    const approvedBy = row["Approved By"]?.trim() || null;

    // We treat all historical leave as already-approved unpaid leave
    const profileId = profileByRcId[empId];
    if (!profileId) {
      leaveSkipped++;
      continue;
    }

    if (!startDate || !endDate) {
      leaveSkipped++;
      continue;
    }

    const { error } = await supabase.from("leave_requests").insert({
      employee_id: profileId,
      start_date: startDate,
      end_date: endDate,
      reason: leaveType !== "Holiday" ? leaveType : null,
      status: "approved",
      // reviewed_by left null since we don't have their profile IDs yet
      reviewed_at: new Date().toISOString(),
    });

    if (error && !error.message.includes("duplicate")) {
      console.error(`   ✗ Leave insert error: ${error.message}`);
      leaveSkipped++;
    } else {
      leaveImported++;
    }
  }

  console.log(`   ✓ ${leaveImported} leave records imported, ${leaveSkipped} skipped\n`);

  // ---- Summary ------------------------------------------------------------
  console.log("✅  Import complete!");
  console.log(`\n🔑  Default password for all imported users: ${DEFAULT_PASSWORD}`);
  console.log("    Remind staff to change their passwords after first login.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
