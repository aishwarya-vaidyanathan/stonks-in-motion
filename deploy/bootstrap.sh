#!/usr/bin/env bash
# First-time setup for a fresh Ubuntu 24.04 / 26.04 Hetzner Cloud server.
# Run as root (or with sudo) once, immediately after the server is created.
#
# Usage:
#   sudo bash deploy/bootstrap.sh [path/to/deploy_key.pub]
#
# If a public key path is provided, its contents are appended to the
# `stonks` user's authorized_keys (mode 600, owned by stonks:stonks).
# This lets the GitHub Actions deploy workflow SSH in as `stonks`
# without sharing the root key.
set -euo pipefail

PUBKEY_PATH="${1:-}"

if [[ $EUID -ne 0 ]]; then
  echo "Must be run as root (or via sudo)." >&2
  exit 1
fi

APP_DIR="/opt/stonks-in-motion"
APP_USER="stonks"

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  python3 \
  python3-venv \
  python3-pip \
  ca-certificates \
  curl

echo "==> Creating application user ($APP_USER)"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi

echo "==> Granting $APP_USER limited sudo for systemctl"
SUDOERS_FILE="/etc/sudoers.d/stonks-in-motion"
cat > "$SUDOERS_FILE" <<'EOF'
stonks ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart stonks-in-motion
stonks ALL=(ALL) NOPASSWD: /usr/bin/systemctl status stonks-in-motion
stonks ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active stonks-in-motion
stonks ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u stonks-in-motion *
EOF
chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE"

echo "==> Preparing $APP_DIR"
mkdir -p "$APP_DIR/logs"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 750 "$APP_DIR"

if [[ -n "$PUBKEY_PATH" ]]; then
  if [[ ! -f "$PUBKEY_PATH" ]]; then
    echo "Public key file not found: $PUBKEY_PATH" >&2
    exit 1
  fi
  echo "==> Adding deploy public key to $APP_USER"
  SSHDIR="/home/$APP_USER/.ssh"
  mkdir -p "$SSHDIR"
  chmod 700 "$SSHDIR"
  cat "$PUBKEY_PATH" >> "$SSHDIR/authorized_keys"
  chmod 600 "$SSHDIR/authorized_keys"
  chown -R "$APP_USER:$APP_USER" "$SSHDIR"
else
  echo "==> No public key provided; skipping authorized_keys setup"
  echo "    You can add it later with:"
  echo "      sudo -u stonks mkdir -p /home/stonks/.ssh && sudo -u stonks tee -a /home/stonks/.ssh/authorized_keys"
fi

echo "==> Installing systemd unit"
install -m 644 deploy/stonks-in-motion.service /etc/systemd/system/stonks-in-motion.service
systemctl daemon-reload
systemctl enable stonks-in-motion.service

echo
echo "Bootstrap complete."
echo "Next steps:"
echo "  1. Push to main, or run the 'Deploy' workflow manually from the Actions tab."
echo "  2. The first deploy will:"
echo "     - rsync the repo to $APP_DIR"
echo "     - write .env from GitHub Secrets (mode 600, owned by $APP_USER)"
echo "     - create .venv and pip install -r requirements.txt"
echo "     - restart $APP_USER-stonks-in-motion.service"
echo "  3. Tail logs with:    sudo journalctl -u stonks-in-motion -f"
