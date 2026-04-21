# Synology Deployment

ROKRota runs on Synology NAS via Docker, port **3004** (Docker service names on disk remain `rotaflow` during Phase 0 — infra rename is deferred). GitHub Actions deploys automatically on every push to `main` via Tailscale VPN + SSH.

## GitHub Secrets required

Set these at https://github.com/vpltd-plesurf/rotaflow/settings/secrets/actions — same values as windsmeres-libram:

| Secret | Description |
|--------|-------------|
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth client ID for CI |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Tailscale OAuth client secret for CI |
| `DEPLOY_KEY` | SSH private key for Synology access |
| `SYNOLOGY_TAILSCALE_HOST` | Synology Tailscale IP/hostname |

## One-time Synology setup

```bash
# SSH into Synology, then:
mkdir -p /volume1/docker/rotaflow

# Create /volume1/docker/rotaflow/.env.local with:
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_ACCESS_TOKEN=sbp_<token>
RESEND_API_KEY=re_<key>
ALLOWED_ORIGIN=<synology-tailscale-ip>:3004
```

The `.env.local` file lives only on the Synology — it is never committed to git.

## Accessing the app

From any Tailscale device: `http://<synology-tailscale-ip>:3004`

## Manual rebuild (if needed)

```bash
ssh paullesurf@<synology-tailscale-ip>
cd /volume1/docker/rotaflow
sudo /usr/local/bin/docker compose down
sudo /usr/local/bin/docker compose up -d --build
```

## Public URL & Cloudflare Tunnel

Public at `https://rotaflow.rokassist.uk` via the shared tunnel at `/volume1/docker/cloudflared/` (see project memory). Until the multi-tenant rebrand ships (Phase 5), ROK continues to use this URL; it will be 301-redirected to `rok.rokrota.com/login` once the tenant-subdomain setup goes live.

---

# Staging Supabase project (Phase 0)

Phase 0 of the multi-tenant work requires a second Supabase project (separate from prod) where Phase 1–3 migrations can be rehearsed safely.

## Create the staging project (one-time, Supabase dashboard)

1. Log in to https://supabase.com/dashboard
2. **New project** → organisation = same as prod, name = `rokrota-staging`, region = London, plan = Free.
3. Once provisioned, grab from **Project Settings → API**:
   - `Project URL` → `STAGING_SUPABASE_URL`
   - `service_role` key → `STAGING_SERVICE_ROLE_KEY`
   - `anon` key → `STAGING_SUPABASE_ANON_KEY`
4. Under **Settings → Database → Connection string → URI (transaction pooler)**: copy for `STAGING_DATABASE_URL`.
5. Create a Personal Access Token at https://supabase.com/dashboard/account/tokens named `ROKRota staging` → `STAGING_SUPABASE_ACCESS_TOKEN`.

## Add to `.env.local`

```
STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co
STAGING_SUPABASE_ANON_KEY=eyJ...
STAGING_SERVICE_ROLE_KEY=eyJ...
STAGING_SUPABASE_ACCESS_TOKEN=sbp_...
STAGING_ADMIN_PASSWORD=some-throwaway-password-for-smoke-tests
```

## Apply schema to staging

```bash
SUPABASE_ACCESS_TOKEN=$STAGING_SUPABASE_ACCESS_TOKEN \
NEXT_PUBLIC_SUPABASE_URL=$STAGING_SUPABASE_URL \
npm run migrate
```

This runs every file in `supabase/migrations/` against staging.

## Clone anonymised prod data to staging

```bash
PROD_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
PROD_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
STAGING_SUPABASE_URL=$STAGING_SUPABASE_URL \
STAGING_SERVICE_ROLE_KEY=$STAGING_SERVICE_ROLE_KEY \
STAGING_ADMIN_PASSWORD=$STAGING_ADMIN_PASSWORD \
npx tsx scripts/clone-to-staging.ts
```

What it does: wipes staging, copies locations verbatim, recreates every auth user with anonymised email (`user1@example.test`, …) and scrambles names/phones. Outputs the first admin email you can sign in with for smoke tests.

## Smoke test

```bash
# against local dev
BASE_URL=http://localhost:3000 \
SMOKE_EMAIL=paul@rokbarbers.com \
SMOKE_PASSWORD='...' \
SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
npx tsx scripts/smoke-test.ts

# against staging
BASE_URL=https://staging.rokrota.com \
SMOKE_EMAIL=user1@example.test \
SMOKE_PASSWORD=$STAGING_ADMIN_PASSWORD \
SUPABASE_URL=$STAGING_SUPABASE_URL \
SUPABASE_ANON_KEY=$STAGING_SUPABASE_ANON_KEY \
npx tsx scripts/smoke-test.ts
```

Exit code 0 = green. Run before and after every migration from here on.

## Backup / restore dry-run (prod safety net)

Before any prod migration: **Supabase dashboard → Database → Backups → Download**. Save locally. To restore: **Database → Backups → Restore** (restores to a new branch project; then you swap env vars).

Test the round-trip once on staging first so you know it works before you need it in anger.
