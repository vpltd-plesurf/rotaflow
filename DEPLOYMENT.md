# Synology Deployment

ROKRota runs on Synology NAS via Docker, port **3004**. GitHub Actions deploys automatically on every push to `main` via Tailscale VPN + SSH.

> **Naming note**: Docker service name, container names, and the path `/volume1/docker/rotaflow` still use the old `rotaflow` identifiers. Renaming them requires Synology-side filesystem work and is deferred. The user-facing product name has already changed to `ROKRota`.

## GitHub Actions secrets

Set at https://github.com/vpltd-plesurf/rotaflow/settings/secrets/actions.

### Deploy (required for auto-deploy)

| Secret | Description |
|--------|-------------|
| `TAILSCALE_AUTH_KEY` | Reusable ephemeral Tailscale auth key |
| `DEPLOY_KEY` | SSH private key (ed25519); public key lives in Synology `~/.ssh/authorized_keys` |
| `SYNOLOGY_TAILSCALE_HOST` | Synology Tailscale IP (currently `100.68.231.46`) |

### CI (required for isolation tests in CI)

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same value as in local `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same value as in local `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Same value as in local `.env.local` |

Without the CI secrets the brand check and typecheck still run, but the 39-case RLS isolation suite fails.

## One-time Synology setup

```bash
ssh paullesurf@100.68.231.46
mkdir -p /volume1/docker/rotaflow
```

Create `/volume1/docker/rotaflow/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://gyennfqrhcllyzahiddp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ACCESS_TOKEN=sbp_<personal-access-token>
RESEND_API_KEY=re_<key>
```

The `.env.local` lives only on the Synology — never committed. `.dockerignore` must NOT exclude `.env*.local` (the file needs to be in the build context so `NEXT_PUBLIC_*` vars bake in at build time).

## Accessing the app

- **Public (current)**: https://rotaflow.rokassist.uk via Cloudflare Tunnel (shared tunnel at `/volume1/docker/cloudflared/`)
- **Public (future, Phase 5)**: `https://rok.rokrota.com` — multi-tenant subdomain routing. Legacy URL will 301-redirect
- **Direct over Tailscale**: http://100.68.231.46:3004

## Manual rebuild

```bash
ssh paullesurf@100.68.231.46
cd /volume1/docker/rotaflow
sudo /usr/local/bin/docker compose down
sudo /usr/local/bin/docker compose up -d --build
```

## Database migrations

All DDL lives in `supabase/migrations/*.sql` (sorted by filename). Runner: `scripts/migrate.ts` (tracks applied files in `public._migrations`).

```bash
npm run migrate        # applies every pending migration to the configured Supabase project
```

Requires `SUPABASE_ACCESS_TOKEN` (Personal Access Token, `sbp_...`) in `.env.local`. Get one at https://supabase.com/dashboard/account/tokens.

Pre-customer workflow (current): migrate directly against prod (`gyennfqrhcllyzahiddp`), run smoke test + isolation tests, accept the risk that Free-tier Supabase has no automated backups (data is re-importable from `/Exports/` CSVs).

Post-customer workflow (from Phase 5 onwards): spin up a staging Supabase project, use `scripts/clone-to-staging.ts` to copy anonymised data, rehearse migrations there first. Scaffolding already in repo — parked until a second tenant exists.

## Smoke test

```bash
BASE_URL=http://localhost:3000 \
SMOKE_EMAIL=paul@rokbarbers.com \
SMOKE_PASSWORD='<password>' \
SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
npx tsx scripts/smoke-test.ts
```

Logs in and GETs every dashboard page. Exit 0 = green.

## RLS isolation test suite

```bash
npm test
```

Seeds two ephemeral orgs via service-role, asserts cross-tenant reads/writes are blocked for every (role × table × verb) combination (39 cases), cleans up. ~14s. Runs on every push in CI.

## Cloudflare Tunnel setup

The shared tunnel lives at `/volume1/docker/cloudflared/` on the Synology (its own `docker-compose.yml`, config, and credentials). It serves 6 apps across `*.rokassist.uk` plus `barberdesk.uk`. Attached to 6 external docker networks (one per app's compose-default network) so it can resolve each service by name.

**Adding a new tenant hostname**:
1. Add `hostname: <slug>.rokrota.com → service: http://rotaflow:3000` to `/volume1/docker/cloudflared/config.yml`
2. `docker compose up -d` inside `/volume1/docker/cloudflared/` — no restart of apps needed

**Never put cloudflared inside an app's compose.** Full-project syncs (GitHub Actions `tar xzf`, DSM Container Manager redeploy, rsync from Mac) will overwrite the compose and strip cross-network attachments, killing the tunnel for every app that isn't in that compose's own network. This happened 2026-04-21 and is the reason cloudflared lives in its own folder today.
