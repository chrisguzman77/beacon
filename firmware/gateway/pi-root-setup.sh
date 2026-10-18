#!/usr/bin/env bash
# The Pi setup steps that need root, so Chris's session can do everything else through the tunnel. Run once on the Pi:
#   sudo bash ~/beacon/firmware/gateway/pi-root-setup.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run it with sudo"; exit 1; }
PI_USER=${SUDO_USER:-beacon}
here=$(cd "$(dirname "$0")" && pwd)

echo "Installing espeak-ng (the voice fallback)..."
apt-get update -qq && apt-get install -y -qq espeak-ng >/dev/null

# Installed, not started: it starts once firmware/gateway/.env is on the Pi
cp "$here/beacon-gateway.service" /etc/systemd/system/
systemctl daemon-reload

# PI_USER may start, stop and restart the gateway without a password, nothing else (flashing the pod or UNO needs
# the gateway off their serial ports). Checked with visudo before it is installed, so a typo cannot break sudo.
tmp=$(mktemp)
echo "$PI_USER ALL=(root) NOPASSWD: /usr/bin/systemctl start beacon-gateway, /usr/bin/systemctl stop beacon-gateway, /usr/bin/systemctl restart beacon-gateway, /usr/bin/systemctl enable beacon-gateway, /usr/bin/systemctl disable beacon-gateway" > "$tmp"
visudo -cqf "$tmp" && install -m 440 "$tmp" /etc/sudoers.d/beacon-gateway
rm -f "$tmp"

echo "Done: espeak-ng installed, beacon-gateway.service installed (not started), $PI_USER can start and stop it."
