/**
 * Migration runner — applies any .sql files in supabase/migrations/ that
 * haven't been run yet, tracked in a _migrations table.
 *
 * Usage:  npm run migrate
 *
 * Requires in .env.local:
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Get one at: https://supabase.com/dashboard/account/tokens
 * (Settings → Access Tokens → Generate new token)
 *
 * The _migrations tracking table is created in the public schema via
 * a one-time bootstrap query through the Management API.
 */

import fs from "fs";
import path from "path";

// ── env loader ──────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ── config ───────────────────────────────────────────────────────────────────
const PROJECT_REF = "gyennfqrhcllyzahiddp";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error(
    "\n❌  SUPABASE_ACCESS_TOKEN is not set.\n" +
    "    1. Go to: https://supabase.com/dashboard/account/tokens\n" +
    "    2. Click 'Generate new token', give it a name (e.g. RotaFlow dev)\n" +
    "    3. Copy the token (starts with sbp_...)\n" +
    "    4. Add to .env.local:  SUPABASE_ACCESS_TOKEN=sbp_...\n"
  );
  process.exit(1);
}

// ── run SQL via Management API ───────────────────────────────────────────────
async function sql(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Management API ${res.status}: ${body}`);
  }

  const data = await res.json();
  // API returns an array of rows directly
  return Array.isArray(data) ? data : [];
}

// ── main ─────────────────────────────────────────────────────────────────────
async function run() {
  // Bootstrap tracking table
  await sql(`
    create table if not exists public._migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  // Find all migration files sorted by name
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Fetch already-applied migrations
  const applied = await sql("select filename from public._migrations");
  const appliedSet = new Set(applied.map((r) => r.filename as string));

  const pending = files.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log("✅  All migrations are up to date.");
    return;
  }

  console.log(`\n📦  Running ${pending.length} pending migration(s)...\n`);

  for (const file of pending) {
    const sqlText = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    process.stdout.write(`  ⏳  ${file} … `);
    try {
      await sql(sqlText);
      await sql(`insert into public._migrations (filename) values ('${file.replace(/'/g, "''")}') on conflict do nothing`);
      console.log("✅");
    } catch (err) {
      console.log("❌");
      console.error(`\n     Error: ${(err as Error).message}\n`);
      process.exit(1);
    }
  }

  console.log("\n✅  Done.\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
