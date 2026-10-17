#!/usr/bin/env bash
# Remote access to the beacon Pi from anywhere: a reverse SSH tunnel to the Vultr server, kept up by a service.
# Run once on the Pi:
#   curl -fsSL https://raw.githubusercontent.com/chrisguzman77/beacon/dev/firmware/gateway/tunnel-setup.sh | sudo bash
# Then send Chris the one line it prints (the Pi's public key). Chris's session authorizes it on the server, and from
# then on reaches the Pi with:  ssh -J root@155.138.207.138 -p 2222 beacon@localhost
# On the server the Pi's key can only open port 2222 on the server's own localhost: no shell, nothing else.
set -euo pipefail
SERVER=155.138.207.138
PORT=2222
PI_USER=${SUDO_USER:-beacon}
CHRIS_KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK1k0N9v0MIqgEyDdfcWh6yXJTOUQjyL5cwwluT7cyeP christopherguzman@ChristohersMBP6'

[ "$(id -u)" = 0 ] || { echo "run it with sudo"; exit 1; }
echo "Installing autossh..."
apt-get update -qq && apt-get install -y -qq autossh >/dev/null

# Chris's laptop may log in as the Pi user (reachable only through the tunnel; the Pi opens no ports)
home=$(getent passwd "$PI_USER" | cut -d: -f6)
install -d -m 700 -o "$PI_USER" -g "$PI_USER" "$home/.ssh"
touch "$home/.ssh/authorized_keys"
grep -qxF "$CHRIS_KEY" "$home/.ssh/authorized_keys" || echo "$CHRIS_KEY" >> "$home/.ssh/authorized_keys"
chown "$PI_USER:$PI_USER" "$home/.ssh/authorized_keys" && chmod 600 "$home/.ssh/authorized_keys"

# The Pi's own key, used only for the tunnel
install -d -m 700 /root/.ssh
[ -f /root/.ssh/beacon_tunnel ] || ssh-keygen -q -t ed25519 -N '' -C beacon-pi-tunnel -f /root/.ssh/beacon_tunnel

cat > /etc/systemd/system/beacon-tunnel.service <<EOF
[Unit]
Description=Reverse SSH tunnel so Chris can reach the beacon Pi
After=network-online.target
Wants=network-online.target

[Service]
Environment=AUTOSSH_GATETIME=0
ExecStart=/usr/bin/autossh -M 0 -N -i /root/.ssh/beacon_tunnel -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new -R ${PORT}:localhost:22 tunnel@${SERVER}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now beacon-tunnel >/dev/null 2>&1

echo
echo "Done. The tunnel keeps retrying until Chris authorizes this Pi. Send Chris this one line:"
echo
cat /root/.ssh/beacon_tunnel.pub
