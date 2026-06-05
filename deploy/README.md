# Deploy

Files in this directory run `stonks-in-motion` as a `systemd` service on a
fresh Ubuntu Hetzner Cloud server, with CI/CD handled by GitHub Actions.

## One-time setup

1. **Generate a deploy key** locally:
   ```bash
   bash scripts/generate_deploy_key.sh
   ```
   This writes `deploy_key` (private) and `deploy_key.pub` (public) at the
   repo root, both git-ignored. **Do not commit `deploy_key`.**

2. **Provision a Hetzner Cloud server** in Helsinki (`eu-central`):
   - Ubuntu 24.04 or 26.04
   - Any size; CX22 is plenty for a single-producer stream
   - **SSH key**: paste the contents of `deploy_key.pub` into the Hetzner
     "SSH key" field when creating the server. This is the only time you
     need it for Hetzner.

3. **Bootstrap the server** (run as root over SSH):
   ```bash
   scp -r deploy root@<server-ip>:/tmp/
   scp deploy_key.pub root@<server-ip>:/tmp/
   ssh root@<server-ip> "bash /tmp/deploy/bootstrap.sh /tmp/deploy_key.pub"
   ```
   This:
   - Installs `python3`, `python3-venv`, `python3-pip`
   - Creates the `stonks` user
   - Grants `stonks` passwordless `sudo` for the three `systemctl`
     subcommands used by the deploy workflow
   - Copies the public key into `stonks`'s `authorized_keys`
   - Creates `/opt/stonks-in-motion` (owned by `stonks`)
   - Installs and enables `stonks-in-motion.service`

## GitHub Secrets

Add the following in **Settings → Secrets and variables → Actions** for the
repo. Use **Repository secrets** (not environment):

| Secret | Source |
|---|---|
| `SSH_PRIVATE_KEY` | Contents of the local `deploy_key` file |
| `SERVER_HOST` | Hetzner server's public IPv4 |
| `SERVER_USER` | `stonks` |
| `FINNHUB_API_KEY` | From <https://finnhub.io/> |
| `AIVEN_KAFKA_HOST` | From the Aiven console: Connection info |
| `AIVEN_KAFKA_PORT` | From the Aiven console (usually `13038` for SASL_SSL) |
| `AIVEN_KAFKA_USERNAME` | From the Aiven console |
| `AIVEN_KAFKA_PASSWORD` | From the Aiven console |
| `AIVEN_KAFKA_TOPIC` | `stonks.raw.quotes` (or whatever you create) |

## Aiven Kafka

In the Aiven console, **create the topic** before the first deploy
(default name `stonks.raw.quotes`, 1 partition is fine on the free tier).
Auto-create is usually disabled, so doing it up front avoids a startup
error.

## Daily use

- **Push to `main`** → the `Deploy` workflow runs (CI must pass first).
- **Manual deploy**: Actions tab → `Deploy` → Run workflow.
- **Tail logs**: `ssh stonks@<server-ip> "sudo journalctl -u stonks-in-motion -f"`.
- **Restart manually**: `ssh stonks@<server-ip> "sudo systemctl restart stonks-in-motion"`.
- **Inspect the env file**: `ssh stonks@<server-ip> "sudo cat /opt/stonks-in-motion/.env"` (you'll need `stonks` to have read access — by default mode 600, only `stonks` can read).

## What's in `.env`

The deploy workflow writes a fresh `.env` from the secrets above on every
run. It is `chmod 600` and owned by `stonks`. To override locally for
debugging, edit the file directly on the server — your edits will be
overwritten on the next deploy, so prefer the GitHub Secrets path.

## Firewall

The service binds to `127.0.0.1:8000`. To expose it publicly, either:
- Put it behind nginx/Caddy and open `:443` in the Hetzner firewall, or
- Change the `ExecStart` to bind to `0.0.0.0` and open `:8000`.

For a resume-friendly setup I'd recommend the nginx + Let's Encrypt path
once you're past V1.
