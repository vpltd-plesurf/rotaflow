# Synology Deployment

RotaFlow runs on Synology NAS via Docker, port **3004**. GitHub Actions deploys automatically on every push to `main` via Tailscale VPN + SSH.

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
