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
| `AIVEN_CA_CERT` | *Optional.* Contents of the CA cert from the Aiven console. Leave empty to use the system trust store (works for Aiven's Let's Encrypt chain). |
| `AIVEN_CLIENT_CERT` | Contents of the mTLS access certificate (`service.cert` from the Aiven console). Required for mTLS-only services (the Aiven default). Leave empty to use SASL instead. |
| `AIVEN_CLIENT_KEY` | Contents of the mTLS access key (`service.key` from the Aiven console). Must be set together with `AIVEN_CLIENT_CERT`. |

## Aiven Kafka

1. **Create the service** in the Aiven console (free `Business-0` plan is
   enough for a single producer).
2. **Create the topic** before the first deploy (default
   `stonks.raw.quotes`, 1 partition is fine on the free tier). Auto-create
   is usually disabled, so doing it up front avoids a startup error.
3. **Get the connection info** under the service's *Connection details*:
   - *Service URI* → split into `AIVEN_KAFKA_HOST` and `AIVEN_KAFKA_PORT`
     (the port varies; pick the *SASL* or *SSL* URI as appropriate)
   - *User* and *Password* → `AIVEN_KAFKA_USERNAME` / `_PASSWORD`
     *(only required if your service uses SASL — see step 5)*
4. **(Optional) Download the CA cert** from the Aiven console and paste
   its full contents into the `AIVEN_CA_CERT` secret. If you skip this,
   the system trust store on Ubuntu (`ca-certificates`) will validate
   the chain — Aiven's broker cert chains to Let's Encrypt, so it works
   out of the box.
5. **mTLS access cert + key (default for Aiven).** Aiven ships every
   Kafka service with mTLS access certs, and many services are
   configured mTLS-only. Download `service.cert` and `service.key`
   from the Aiven console (Overview → Connection information →
   Certificates) and paste each into the `AIVEN_CLIENT_CERT` and
   `AIVEN_CLIENT_KEY` secrets. With these set, the deploy workflow
   uses `security.protocol=SSL` (mTLS) and ignores the SASL
   username/password. If your service is SASL-only instead, leave the
   two secrets empty and set `AIVEN_KAFKA_USERNAME` /
   `AIVEN_KAFKA_PASSWORD` in the workflow to switch to `SASL_SSL`.

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

The service binds to `0.0.0.0:8000`, so you also need a Hetzner Cloud
firewall rule allowing inbound TCP on port 8000 from the public internet
(or a narrower CIDR if you prefer). Add it in the Hetzner Cloud console
under **Firewalls → your firewall → Inbound rules**:

| Protocol | Port | Source |
|---|---|---|
| TCP | 8000 | `0.0.0.0/0` (or your IP/CIDR) |

Without this rule the OS-level `ss` will show port 8000 listening, but
external traffic will be dropped at the Hetzner edge.
