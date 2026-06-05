#!/usr/bin/env bash
# Generate an ed25519 keypair used by GitHub Actions to SSH into the
# Hetzner server as the `stonks` user. Writes:
#   deploy_key      -> PRIVATE key (NEVER commit; goes into GitHub Secrets)
#   deploy_key.pub  -> PUBLIC key (paste into Hetzner cloud-init and
#                      optionally append to stonks's authorized_keys)
set -euo pipefail

KEY_DIR="${KEY_DIR:-.}"
PRIVATE="$KEY_DIR/deploy_key"
PUBLIC="$KEY_DIR/deploy_key.pub"
COMMENT="stonks-in-motion-deploy"

if [[ -f "$PRIVATE" || -f "$PUBLIC" ]]; then
  echo "Refusing to overwrite existing $PRIVATE / $PUBLIC." >&2
  echo "Delete them first if you want to regenerate." >&2
  exit 1
fi

ssh-keygen -t ed25519 -C "$COMMENT" -f "$PRIVATE" -N ""
chmod 600 "$PRIVATE"
chmod 644 "$PUBLIC"

cat <<EOF

Generated:
  $PRIVATE   (private, 600)
  $PUBLIC    (public, 644)

Next steps:
  1. Add $PUBLIC to your Hetzner server's "SSH key" field when creating
     the box in Helsinki (eu-central).
  2. After the server is up, add the public key to the stonks user:
       ssh root@<server-ip> "bash /tmp/bootstrap.sh /tmp/deploy_key.pub"
  3. Add the private key as a GitHub repo secret named SSH_PRIVATE_KEY:
       cat $PRIVATE
     (paste the full output, including the BEGIN/END lines).
  4. Delete the local copy of $PRIVATE once it's in GitHub Secrets:
       shred -u $PRIVATE      # or just: rm $PRIVATE
EOF
