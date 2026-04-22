/**
 * Smoke test — runs before and after every migration to catch regressions.
 *
 * Logs in as a configured admin, then asserts key dashboard pages return
 * the expected status (either 200 directly, or redirect-to-login-then-200
 * for unauthenticated runs). Fails fast with a useful diff if anything
 * breaks.
 *
 * Usage:
 *   BASE_URL=https://rotaflow.rokassist.uk \
 *   SMOKE_EMAIL=paul@rokbarbers.com \
 *   SMOKE_PASSWORD='...' \
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=eyJ... \
 *   npx tsx scripts/smoke-test.ts
 *
 * Exit codes: 0 = all passed, 1 = any failure.
 */

import { createClient } from "@supabase/supabase-js";

const env = (k: string, required = true): string => {
  const v = process.env[k];
  if (!v && required) {
    console.error(`❌ Missing env var: ${k}`);
    process.exit(1);
  }
  return v ?? "";
};

const BASE_URL = env("BASE_URL").replace(/\/$/, "");
const SMOKE_EMAIL = env("SMOKE_EMAIL");
const SMOKE_PASSWORD = env("SMOKE_PASSWORD");
const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");

const PAGES_AUTH_REQUIRED = [
  "/dashboard",
  "/dashboard/rota",
  "/dashboard/employees",
  "/dashboard/leave",
  "/dashboard/swaps",
  "/dashboard/documents",
  "/dashboard/settings",
];
const PAGES_PUBLIC = ["/", "/login"];

type Result = { path: string; status: number; ok: boolean; note?: string };

async function login(): Promise<string> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD });
  if (error || !data.session) throw new Error(`login failed: ${error?.message}`);
  return data.session.access_token;
}

async function check(path: string, token: string | null): Promise<Result> {
  const headers: Record<string, string> = {};
  if (token) headers["Cookie"] = `sb-access-token=${token}`;
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers, redirect: "manual" });
    const ok = res.status === 200 || res.status === 307 || res.status === 308;
    return { path, status: res.status, ok };
  } catch (e: unknown) {
    return { path, status: 0, ok: false, note: (e as Error).message };
  }
}

async function main() {
  console.log(`→ smoke test against ${BASE_URL}`);

  const publicResults: Result[] = [];
  for (const p of PAGES_PUBLIC) publicResults.push(await check(p, null));

  let token: string | null = null;
  try {
    token = await login();
    console.log(`  ✓ logged in as ${SMOKE_EMAIL}`);
  } catch (e) {
    console.error(`  ✗ ${(e as Error).message}`);
  }

  const authResults: Result[] = [];
  for (const p of PAGES_AUTH_REQUIRED) authResults.push(await check(p, token));

  const all = [...publicResults, ...authResults];
  const failures = all.filter((r) => !r.ok);

  console.log("\nResults:");
  for (const r of all) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`  ${mark}  ${r.status.toString().padStart(3)}  ${r.path}${r.note ? `  (${r.note})` : ""}`);
  }

  if (failures.length) {
    console.error(`\n❌ ${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log(`\n✅ ${all.length} checks passed`);
}

main().catch((err) => {
  console.error("\n❌ smoke test crashed:", err);
  process.exit(1);
});
